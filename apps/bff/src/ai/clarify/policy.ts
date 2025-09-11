// apps/bff/src/ai/clarify/policy.ts
// Clarify 정책 엔진 - 질문 생성 및 응답 처리

import { 
  IClarifyPolicy, 
  ClarifyableSlot, 
  ClarifyContext, 
  ClarifyQuestion, 
  ClarifyResponse,
  ClarifyConfig,
  DEFAULT_CLARIFY_CONFIG,
  ApartmentCandidate,
  SLOT_PRIORITY_MAP,
  INTENT_REQUIRED_SLOTS
} from './types';
import { ConversationSlots } from '../types/slots';
import { clarifyTemplates } from './templates';
import { apartmentMatcher } from './matcher';

/**
 * Clarify 정책 구현
 */
export class ClarifyPolicy implements IClarifyPolicy {
  private config: ClarifyConfig;

  constructor(config: Partial<ClarifyConfig> = {}) {
    this.config = { ...DEFAULT_CLARIFY_CONFIG, ...config };
  }

  /**
   * 특정 슬롯에 대한 Clarify 질문 생성
   */
  async generateQuestion(slot: ClarifyableSlot, context: ClarifyContext): Promise<ClarifyQuestion> {
    if (this.config.debugMode) {
      console.log('🤔 Clarify 질문 생성:', { slot, reason: context.reason });
    }

    const template = clarifyTemplates[slot];
    if (!template) {
      throw new Error(`No clarify template found for slot: ${slot}`);
    }

    // 슬롯별 특별 처리
    await this.enhanceContext(slot, context);

    // 템플릿으로 질문 생성
    const question = template(context);

    // 제안 옵션 수 제한
    if (question.suggestions && question.suggestions.length > this.config.maxSuggestions) {
      question.suggestions = question.suggestions.slice(0, this.config.maxSuggestions);
    }

    if (this.config.debugMode) {
      console.log('✅ Clarify 질문 생성 완료:', {
        question: question.question.slice(0, 50) + '...',
        suggestionsCount: question.suggestions?.length || 0
      });
    }

    return question;
  }

  /**
   * 누락된 슬롯들을 분석하여 우선순위별 Clarify 질문 생성
   */
  async analyzeMissingSlots(slots: ConversationSlots, intent?: any): Promise<ClarifyQuestion[]> {
    const questions: ClarifyQuestion[] = [];

    // 의도별 필수 슬롯 확인
    const requiredSlots = this.getRequiredSlots(intent);
    const missingSlots = this.identifyMissingSlots(slots, requiredSlots);

    if (this.config.debugMode) {
      console.log('🔍 누락 슬롯 분석:', {
        intentCategory: intent?.category,
        requiredSlots,
        missingSlots
      });
    }

    // 우선순위별로 정렬
    missingSlots.sort((a, b) => SLOT_PRIORITY_MAP[a] - SLOT_PRIORITY_MAP[b]);

    // 첫 번째 누락 슬롯만 처리 (UX 향상)
    if (missingSlots.length > 0) {
      const firstMissingSlot = missingSlots[0];
      
      const context: ClarifyContext = {
        currentSlots: slots,
        reason: 'missing',
        userProfile: undefined // 필요시 외부에서 전달
      };

      const question = await this.generateQuestion(firstMissingSlot, context);
      questions.push(question);
    }

    return questions;
  }

  /**
   * 아파트 후보 검색
   */
  async searchApartmentCandidates(partialName: string, region?: string): Promise<ApartmentCandidate[]> {
    return apartmentMatcher.searchCandidates(partialName, region);
  }

  /**
   * Clarify 응답 처리
   */
  async processResponse(
    slot: ClarifyableSlot, 
    userResponse: string, 
    context: ClarifyContext
  ): Promise<ClarifyResponse> {
    try {
      const normalizedResponse = userResponse.trim();
      const updatedSlots: Partial<ConversationSlots> = {};

      switch (slot) {
        case 'apartmentName':
          const processedApt = await this.processApartmentNameResponse(normalizedResponse, context);
          if (processedApt.apartmentName) {
            updatedSlots.apartmentName = processedApt.apartmentName;
          }
          if (processedApt.needsMoreClarification) {
            return {
              success: true,
              needsMoreClarification: true
            };
          }
          break;

        case 'dealType':
          updatedSlots.dealType = this.processDealTypeResponse(normalizedResponse);
          break;

        case 'area':
          const areaValue = this.processAreaResponse(normalizedResponse);
          if (areaValue) {
            updatedSlots.area = areaValue;
          }
          break;

        case 'period':
          updatedSlots.period = this.processPeriodResponse(normalizedResponse);
          break;

        case 'region':
          updatedSlots.region = normalizedResponse;
          break;

        case 'complexNumber':
          updatedSlots.complexNumber = normalizedResponse;
          break;

        default:
          console.warn('⚠️ 처리되지 않은 슬롯:', slot);
      }

      return {
        success: true,
        updatedSlots,
        needsMoreClarification: false
      };

    } catch (error: any) {
      console.error('❌ Clarify 응답 처리 실패:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 컨텍스트 향상 (슬롯별 특별 처리)
   */
  private async enhanceContext(slot: ClarifyableSlot, context: ClarifyContext): Promise<void> {
    switch (slot) {
      case 'apartmentName':
        if (context.partialValue) {
          const candidates = await this.searchApartmentCandidates(
            context.partialValue, 
            context.currentSlots.region
          );
          context.candidates = candidates.map(c => `${c.aptName} (${c.region})`);
        }
        break;

      case 'complexNumber':
        if (context.currentSlots.apartmentName) {
          const complexNumbers = await apartmentMatcher.searchComplexNumbers(
            context.currentSlots.apartmentName
          );
          context.candidates = complexNumbers;
        }
        break;

      case 'area':
        if (context.currentSlots.apartmentName) {
          const areas = await apartmentMatcher.getApartmentAreas(
            context.currentSlots.apartmentName
          );
          context.candidates = areas.map(area => `${area}㎡`);
        }
        break;
    }
  }

  /**
   * 의도별 필수 슬롯 가져오기
   */
  private getRequiredSlots(intent?: any): ClarifyableSlot[] {
    if (!intent?.category) {
      return ['apartmentName']; // 기본값
    }

    const subcategory = intent.subcategory || intent.category;
    return INTENT_REQUIRED_SLOTS[subcategory] || INTENT_REQUIRED_SLOTS[intent.category] || ['apartmentName'];
  }

  /**
   * 누락된 슬롯 식별
   */
  private identifyMissingSlots(slots: ConversationSlots, requiredSlots: ClarifyableSlot[]): ClarifyableSlot[] {
    const missing: ClarifyableSlot[] = [];

    for (const slot of requiredSlots) {
      const value = slots[slot];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missing.push(slot);
      }
    }

    return missing;
  }

  /**
   * 아파트명 응답 처리
   */
  private async processApartmentNameResponse(
    response: string, 
    context: ClarifyContext
  ): Promise<{ apartmentName?: string; needsMoreClarification: boolean }> {
    
    // 후보 선택인지 확인
    if (context.candidates && context.candidates.length > 0) {
      for (let i = 0; i < context.candidates.length; i++) {
        if (response.includes((i + 1).toString()) || response.includes(context.candidates[i])) {
          const candidate = context.candidates[i];
          const apartmentName = candidate.split(' (')[0]; // 지역 정보 제거
          return { apartmentName, needsMoreClarification: false };
        }
      }
    }

    // 새로운 아파트명 입력
    const candidates = await this.searchApartmentCandidates(response, context.currentSlots.region);
    
    if (candidates.length === 0) {
      return { needsMoreClarification: true };
    }

    if (candidates.length === 1 && candidates[0].score >= 0.8) {
      return { apartmentName: candidates[0].aptName, needsMoreClarification: false };
    }

    // 여러 후보가 있으면 추가 Clarify 필요
    return { needsMoreClarification: true };
  }

  /**
   * 거래유형 응답 처리
   */
  private processDealTypeResponse(response: string): '매매' | '전세' | '월세' | '전체' | undefined {
    const normalized = response.toLowerCase().trim();
    
    if (normalized.includes('매매') || normalized.includes('1')) {
      return '매매';
    }
    if (normalized.includes('전세') || normalized.includes('2')) {
      return '전세';
    }
    if (normalized.includes('월세') || normalized.includes('3')) {
      return '월세';
    }
    if (normalized.includes('전체') || normalized.includes('모든') || normalized.includes('4')) {
      return '전체';
    }

    return undefined;
  }

  /**
   * 면적 응답 처리
   */
  private processAreaResponse(response: string): number | undefined {
    // 숫자 추출
    const numberMatch = response.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1]);
    }

    return undefined;
  }

  /**
   * 기간 응답 처리
   */
  private processPeriodResponse(response: string): string {
    const normalized = response.toLowerCase().trim();
    
    if (normalized.includes('3개월') || normalized.includes('3')) {
      return '3개월';
    }
    if (normalized.includes('6개월') || normalized.includes('6')) {
      return '6개월';
    }
    if (normalized.includes('1년') || normalized.includes('12개월') || normalized.includes('1')) {
      return '1년';
    }
    if (normalized.includes('2년') || normalized.includes('24개월') || normalized.includes('2')) {
      return '2년';
    }

    // 기본값
    return response;
  }
}

/**
 * 기본 Clarify 정책 인스턴스
 */
export const defaultClarifyPolicy = new ClarifyPolicy();