// apps/bff/src/ai/clarify/responseHandler.ts
// Clarify 응답 처리 및 세션 관리

import { defaultClarifyPolicy } from './policy';
import { ClarifyContext, ClarifyableSlot, ClarifyResponse } from './types';
import { ConversationSlots } from '../types/slots';

/**
 * Clarify 응답 처리기
 */
export class ClarifyResponseHandler {
  
  /**
   * 사용자의 Clarify 응답을 처리하고 슬롯 업데이트
   */
  async processUserResponse(
    userMessage: string,
    pendingClarifyField: string,
    currentSlots: ConversationSlots,
    userProfile?: any
  ): Promise<{
    success: boolean;
    updatedSlots?: Partial<ConversationSlots>;
    needsMoreClarification?: boolean;
    nextClarifyField?: string;
    error?: string;
  }> {
    try {
      console.log('🤔 Clarify 응답 처리:', {
        field: pendingClarifyField,
        message: userMessage.slice(0, 50) + '...'
      });

      // Clarify 컨텍스트 생성
      const context: ClarifyContext = {
        currentSlots,
        reason: 'missing',
        userProfile
      };

      // 응답 처리
      const response = await defaultClarifyPolicy.processResponse(
        pendingClarifyField as ClarifyableSlot,
        userMessage,
        context
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Clarify 응답 처리 실패'
        };
      }

      // 슬롯 업데이트
      let updatedSlots = response.updatedSlots || {};

      // 추가 Clarify가 필요한지 확인
      if (response.needsMoreClarification) {
        // 동일 필드에 대해 추가 질문 생성
        const nextQuestion = await this.generateFollowUpQuestion(
          pendingClarifyField as ClarifyableSlot,
          userMessage,
          currentSlots,
          userProfile
        );

        if (nextQuestion) {
          return {
            success: true,
            updatedSlots,
            needsMoreClarification: true,
            nextClarifyField: pendingClarifyField
          };
        }
      }

      // 업데이트된 슬롯으로 다음 누락 필드 확인
      const mergedSlots = { ...currentSlots, ...updatedSlots };
      const nextMissingField = this.findNextMissingField(mergedSlots);

      return {
        success: true,
        updatedSlots,
        needsMoreClarification: !!nextMissingField,
        nextClarifyField: nextMissingField
      };

    } catch (error: any) {
      console.error('❌ Clarify 응답 처리 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 후속 질문 생성 (부분 일치나 애매한 응답인 경우)
   */
  private async generateFollowUpQuestion(
    field: ClarifyableSlot,
    userResponse: string,
    currentSlots: ConversationSlots,
    userProfile?: any
  ): Promise<boolean> {
    
    // 아파트명의 경우 후보 검색
    if (field === 'apartmentName') {
      const candidates = await defaultClarifyPolicy.searchApartmentCandidates(userResponse);
      
      if (candidates.length > 1) {
        // 여러 후보가 있으면 추가 질문 필요
        return true;
      }
      
      if (candidates.length === 1 && candidates[0].score < 0.8) {
        // 낮은 신뢰도면 확인 필요
        return true;
      }
    }

    return false;
  }

  /**
   * 다음 누락 필드 찾기
   */
  private findNextMissingField(slots: ConversationSlots): string | undefined {
    // 우선순위별 필수 필드 확인
    const priorityFields = [
      'apartmentName',
      'dealType',
      'area',
      'region'
    ];

    for (const field of priorityFields) {
      const value = (slots as any)[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return field;
      }
    }

    return undefined;
  }

  /**
   * Clarify 상태 확인
   */
  isInClarifyMode(sessionData: any): boolean {
    return !!(sessionData?.pendingClarify?.field);
  }

  /**
   * Clarify 상태 설정
   */
  setClarifyMode(sessionData: any, field: string, question: string): void {
    if (!sessionData.pendingClarify) {
      sessionData.pendingClarify = {};
    }
    
    sessionData.pendingClarify.field = field;
    sessionData.pendingClarify.question = question;
    sessionData.pendingClarify.timestamp = new Date();
  }

  /**
   * Clarify 상태 클리어
   */
  clearClarifyMode(sessionData: any): void {
    if (sessionData?.pendingClarify) {
      delete sessionData.pendingClarify;
    }
  }
}

/**
 * 기본 Clarify 응답 핸들러 인스턴스
 */
export const clarifyResponseHandler = new ClarifyResponseHandler();