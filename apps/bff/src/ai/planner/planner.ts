// apps/bff/src/ai/planner/planner.ts
// 핵심 플래너 구현 - 질문과 슬롯을 기반으로 실행 계획 생성

import { v4 as uuidv4 } from 'uuid';
import { 
  IPlanner, 
  PlanContext, 
  ExecutionPlan, 
  PlanAction, 
  ActionType, 
  ActionPriority,
  PlanExecution,
  PlannerConfig,
  DEFAULT_PLANNER_CONFIG
} from './types';
import { analyzewithLLM, mergeLLMSlots } from './llmAnalyzer';
import { ConversationSlots } from '../types/slots';

/**
 * 메인 플래너 클래스
 */
export class SmartPlanner implements IPlanner {
  private config: PlannerConfig;
  private runningPlans = new Map<string, PlanExecution>();

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
  }

  /**
   * 실행 플랜 생성
   */
  async createPlan(context: PlanContext): Promise<ExecutionPlan> {
    if (this.config.debugMode) {
      console.log('🎯 플래너: 플랜 생성 시작', {
        question: context.question.slice(0, 100),
        slotsCount: Object.keys(context.slots).length
      });
    }

    // 1. LLM 기반 통합 분석 (의도 + 슬롯 + 액션 추천)
    const llmAnalysis = await analyzewithLLM(
      context.question,
      context.slots,
      context.userProfile,
      context.sessionHistory?.messageHistory
    );

    // 2. 슬롯 업데이트 (LLM이 추출한 정보로)
    context.slots = mergeLLMSlots(context.slots, llmAnalysis.slots);

    // 3. 의도 업데이트 (기존 분석된 의도가 web_search면 보존)
    if (context.intent && context.intent.category === 'web_search') {
      console.log('🌐 기존 web_search 의도 보존:', context.intent);
      // web_search 의도는 보존하되, 추천 액션만 업데이트
      context.intent = {
        ...context.intent,
        actions: context.intent.actions || ['webSearch']
      };
    } else {
      context.intent = {
        ...llmAnalysis.intent,
        entities: [] // 기존 호환성을 위해
      };
    }

    if (this.config.debugMode) {
      console.log('🧠 LLM 분석 완료:', {
        category: llmAnalysis.intent.category,
        subcategory: llmAnalysis.intent.subcategory,
        confidence: llmAnalysis.intent.confidence.toFixed(2),
        recommendedActions: llmAnalysis.recommendedActions,
        updatedSlots: Object.keys(llmAnalysis.slots)
      });
    }

    // 2. 액션 생성
    const actions = await this.generateActions(context);

    // 3. 액션 정렬 및 최적화
    const optimizedActions = this.optimizeActions(actions, context);

    // 4. 플랜 메타데이터 계산
    const totalSteps = optimizedActions.length;
    const estimatedDuration = this.estimateDuration(optimizedActions);

    const plan: ExecutionPlan = {
      id: uuidv4(),
      actions: optimizedActions,
      totalSteps,
      estimatedDuration,
      createdAt: new Date(),
      strategy: this.config.strategy
    };

    if (this.config.debugMode) {
      console.log('📋 생성된 플랜:', {
        planId: plan.id,
        totalSteps,
        estimatedDuration: estimatedDuration + 'ms',
        actionTypes: optimizedActions.map(a => a.type)
      });
    }

    return plan;
  }

  /**
   * LLM 분석 기반 액션 생성 (중복 분석 제거)
   */
  private async generateActions(context: PlanContext): Promise<PlanAction[]> {
    const actions: PlanAction[] = [];
    const { intent, slots } = context;
    
    // 이미 createPlan에서 LLM 분석을 완료했으므로 intent.actions 사용
    const recommendedActions = intent.actions || [];
    
    console.log('🎯 LLM 추천 액션 (캐시됨):', recommendedActions);
    
    // LLM이 추천한 액션들을 기반으로 PlanAction 생성
    for (const actionType of recommendedActions) {
      switch (actionType) {
        case 'searchNearbyPOI':
        case 'searchPOI':
          if (slots.apartmentName || slots.apartmentMetadata) {
            actions.push({
              id: uuidv4(),
              type: 'searchPOI',
              name: 'Search Nearby POIs',
              description: '주변 편의시설을 검색합니다',
              reason: intent.reasoning || 'LLM이 POI 검색을 추천했습니다',
              priority: ActionPriority.HIGH,
              parameters: {
                apartmentName: slots.apartmentName,
                apartmentMetadata: slots.apartmentMetadata,
                radius: 1000,
                categories: ['편의점', '마트', '병원', '학교', '지하철역']
              }
            });
          }
          break;

        case 'webSearch':
          actions.push({
            id: uuidv4(),
            type: 'webSearch',
            name: 'Web Search for Trends',
            description: '웹 검색으로 최신 트렌드 정보를 찾습니다',
            reason: intent.reasoning || 'DB에 없는 최신/주관적 정보가 필요합니다',
            priority: ActionPriority.HIGH,
            parameters: {
              query: context.question,
              apartmentContext: slots.apartmentName || slots.apartmentMetadata?.aptName,
              searchType: 'local_trends'
            }
          });
          break;

        case 'searchRealEstate':
          actions.push({
            id: uuidv4(),
            type: 'searchRealEstate',
            name: 'Search Real Estate Data',
            description: '부동산 실거래 데이터를 검색합니다',
            reason: intent.reasoning || 'LLM이 부동산 검색을 추천했습니다',
            priority: ActionPriority.HIGH,
            parameters: {
              includeHistory: true,
              maxResults: 50
            }
          });
          break;
          
        case 'getBuildingInfo':
          if (slots.apartmentName) {
            actions.push({
              id: uuidv4(),
              type: 'getBuildingInfo',
              name: 'Get Building Information',
              description: '건물 기본 정보를 조회합니다',
              reason: intent.reasoning || 'LLM이 건물 정보 조회를 추천했습니다',
              priority: ActionPriority.MEDIUM,
              parameters: {
                apartmentName: slots.apartmentName
              }
            });
          }
          break;
      }
    }
    
    // LLM이 액션을 추천하지 않은 경우, 기본 로직 사용
    if (actions.length === 0) {
      console.log('⚠️ LLM 추천 액션 없음, 기본 로직 사용');
      // 기존 로직을 간소화하여 유지
      if (intent.category === 'search' && intent.subcategory?.includes('poi')) {
        if (slots.apartmentName || slots.apartmentMetadata) {
          actions.push({
            id: uuidv4(),
            type: 'searchPOI',
            name: 'Search Nearby POIs (Fallback)',
            description: '주변 편의시설을 검색합니다',
            reason: '폴백: 기본 POI 검색 로직',
            priority: ActionPriority.MEDIUM,
            parameters: {
              apartmentName: slots.apartmentName,
              apartmentMetadata: slots.apartmentMetadata,
              radius: 1000
            }
          });
        }
      }
    }
    
    if (actions.length > 0) {
      return actions;
    }

    // 2. Clarify 단계 확인
    const clarifyActions = this.generateClarifyActions(context);
    if (clarifyActions.length > 0) {
      actions.push(...clarifyActions);
      // Clarify가 필요하면 다른 액션들은 보류
      return actions;
    }

    // 2. 검증 단계
    const validationActions = this.generateValidationActions(context);
    actions.push(...validationActions);

    // 3. 데이터 수집 단계
    const dataActions = this.generateDataActions(context);
    actions.push(...dataActions);

    // 4. 분석 단계
    const analysisActions = this.generateAnalysisActions(context);
    actions.push(...analysisActions);

    // 5. 출력 단계
    const outputActions = this.generateOutputActions(context);
    actions.push(...outputActions);

    return actions;
  }

  /**
   * Clarify 액션 생성
   */
  private generateClarifyActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { slots, intent } = context;
    const missingSlots = this.identifyMissingSlots(context);

    if (missingSlots.length === 0) {
      return actions; // 모든 필수 정보가 있음
    }

    // 가장 중요한 미싱 슬롯 하나씩만 처리 (UX 향상)
    const criticalSlot = this.selectMostCriticalSlot(missingSlots, intent.category);
    
    if (criticalSlot) {
      actions.push({
        id: uuidv4(),
        type: 'clarify',
        name: `Clarify ${criticalSlot}`,
        description: `사용자에게 ${criticalSlot} 정보를 요청합니다`,
        reason: `${criticalSlot} 정보가 없어서 요청을 완료할 수 없습니다`,
        priority: ActionPriority.CRITICAL,
        parameters: {
          missingField: criticalSlot,
          suggestionContext: this.generateSuggestionContext(criticalSlot, context)
        }
      });
    }

    return actions;
  }

  /**
   * 누락된 슬롯 식별
   */
  private identifyMissingSlots(context: PlanContext): string[] {
    const { slots, intent } = context;
    const missing: string[] = [];

    // POI 검색의 경우 아파트 이름만 있으면 됨
    if (intent.subcategory === 'poi_search') {
      if (!slots.apartmentName) {
        missing.push('apartmentName');
      }
      return missing; // POI 검색은 dealType 불필요
    }

    // 의도별 필수 슬롯 정의
    const requiredSlots = this.getRequiredSlots(intent.category, intent.subcategory);

    for (const slot of requiredSlots) {
      const value = (slots as any)[slot];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missing.push(slot);
      }
    }

    return missing;
  }

  /**
   * 의도별 필수 슬롯 정의
   */
  private getRequiredSlots(category: string, subcategory?: string): string[] {
    const slotRequirements: Record<string, string[]> = {
      'search': ['apartmentName'],
      'general_search': ['apartmentName', 'dealType'], // 일반적인 검색은 아파트명과 거래유형 필요
      'price_search': ['apartmentName', 'dealType'],
      'apartment_search': ['apartmentName'], // 아파트 검색은 아파트명 필수
      'poi_search': ['apartmentName'], // 또는 region
      'analysis': ['apartmentName'],
      'general_analysis': ['apartmentName', 'dealType'], // 일반 분석도 구체적 정보 필요
      'trend_analysis': ['apartmentName', 'dealType'],
      'statistical_analysis': ['apartmentName'],
      'comparison': ['apartmentName'], // 비교 대상들
      'apartment_comparison': ['apartmentName'],
      'region_comparison': ['region'],
      'recommendation': [], // 추천은 슬롯이 없어도 가능
      'investment_recommendation': ['apartmentName'],
      'living_recommendation': ['region']
    };

    const key = subcategory || category;
    return slotRequirements[key] || slotRequirements[category] || [];
  }

  /**
   * 가장 중요한 누락 슬롯 선택
   */
  private selectMostCriticalSlot(missingSlots: string[], category: string): string | null {
    // 우선순위 정의
    const slotPriority: Record<string, number> = {
      'apartmentName': 1,
      'region': 2,
      'dealType': 3,
      'area': 4,
      'period': 5
    };

    const sortedSlots = missingSlots.sort((a, b) => 
      (slotPriority[a] || 99) - (slotPriority[b] || 99)
    );

    return sortedSlots[0] || null;
  }

  /**
   * 제안 컨텍스트 생성
   */
  private generateSuggestionContext(missingField: string, context: PlanContext): any {
    const { slots, intent } = context;
    
    switch (missingField) {
      case 'apartmentName':
        return {
          type: 'apartment',
          suggestions: intent.entities
            .filter(e => e.type === 'apartment')
            .map(e => e.value),
          region: slots.region // 지역이 있으면 해당 지역의 아파트 제안 가능
        };
        
      case 'dealType':
        return {
          type: 'dealType',
          options: ['매매', '전세', '월세'],
          default: '매매'
        };
        
      case 'region':
        return {
          type: 'region',
          suggestions: intent.entities
            .filter(e => e.type === 'region')
            .map(e => e.value)
        };
        
      case 'area':
        return {
          type: 'area',
          unit: '㎡',
          commonSizes: [59, 84, 114] // 일반적인 아파트 면적
        };
        
      default:
        return { type: missingField };
    }
  }

  /**
   * 검증 액션 생성
   */
  private generateValidationActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { slots } = context;

    // 아파트명이 있으면 유효성 검증
    if (slots.apartmentName) {
      actions.push({
        id: uuidv4(),
        type: 'validate',
        name: 'Validate Apartment Name',
        description: '아파트명의 유효성을 검증합니다',
        reason: '정확한 아파트 정보 조회를 위해 검증이 필요합니다',
        priority: ActionPriority.HIGH,
        parameters: {
          field: 'apartmentName',
          value: slots.apartmentName
        }
      });
    }

    return actions;
  }

  /**
   * 데이터 수집 액션 생성
   */
  private generateDataActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    // 의도에 따른 데이터 수집 액션 결정
    switch (intent.category) {
      case 'search':
        actions.push(...this.generateSearchActions(context));
        break;
      case 'analysis':
        actions.push(...this.generateAnalysisDataActions(context));
        break;
      case 'comparison':
        actions.push(...this.generateComparisonDataActions(context));
        break;
      case 'recommendation':
        actions.push(...this.generateRecommendationDataActions(context));
        break;
    }

    return actions;
  }

  /**
   * 검색 액션 생성 (LLM 추천 우선)
   */
  private generateSearchActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    // 🧠 LLM 추천 액션 우선 처리 (단, comparison 의도는 예외)
    if (intent.actions && intent.actions.length > 0 && intent.category !== 'comparison') {
      console.log('🎯 LLM 추천 액션:', intent.actions);
      
      intent.actions.forEach(actionName => {
        if (actionName === 'searchNearbyPOI' || actionName === 'searchPOI') {
          actions.push({
            id: uuidv4(),
            type: 'searchPOI',
            name: 'Search Nearby POI',
            description: '주변 편의시설 정보를 검색합니다',
            reason: 'LLM이 POI 검색을 추천했습니다',
            priority: ActionPriority.HIGH,
            parameters: {
              radius: 1000,
              poiType: '전체'
            }
          });
        } else if (actionName === 'searchRealEstate' || actionName === 'searchRealEstateDeals') {
          actions.push({
            id: uuidv4(),
            type: 'searchRealEstate',
            name: 'Search Real Estate Data',
            description: '부동산 실거래 데이터를 검색합니다',
            reason: 'LLM이 실거래 검색을 추천했습니다',
            priority: ActionPriority.HIGH,
            parameters: {
              includeHistory: true,
              maxResults: 50
            }
          });
        } else if (actionName === 'webSearch') {
          actions.push({
            id: uuidv4(),
            type: 'webSearch',
            name: 'Web Search',
            description: '트렌드 정보, 핫플레이스, 맛집 등을 웹에서 검색합니다',
            reason: 'LLM이 웹 검색을 추천했습니다',
            priority: ActionPriority.HIGH,
            parameters: {
              query: context.question,
              searchType: 'trend'
            }
          });
        }
      });
      
      // LLM 추천이 있으면 기존 규칙 기반 로직은 생략
      if (actions.length > 0) {
        return actions;
      }
    }

    // 🔄 폴백: 기존 규칙 기반 로직 (LLM 추천이 없는 경우에만)
    if (intent.subcategory === 'price_search' || !intent.subcategory) {
      actions.push({
        id: uuidv4(),
        type: 'searchRealEstate',
        name: 'Search Real Estate Data',
        description: '부동산 실거래 데이터를 검색합니다',
        reason: '사용자가 요청한 부동산 정보를 조회하기 위해',
        priority: ActionPriority.HIGH,
        parameters: {
          includeHistory: true,
          maxResults: 50
        }
      });
    }

    if (intent.category === 'web_search') {
      actions.push({
        id: uuidv4(),
        type: 'webSearch',
        name: 'Web Search for Trends',
        description: '웹 검색으로 최신 트렌드 정보를 찾습니다',
        reason: '기존 DB에 없는 최신/주관적 정보가 필요합니다',
        priority: ActionPriority.HIGH,
        parameters: {
          query: context.question,
          apartmentContext: slots.apartmentName || slots.apartmentMetadata?.aptName,
          searchType: 'local_trends'
        }
      });
    }

    if (intent.subcategory === 'poi_search' || intent.actions.includes('searchPOI')) {
      actions.push({
        id: uuidv4(),
        type: 'searchPOI',
        name: 'Search Nearby POI',
        description: '주변 편의시설 정보를 검색합니다',
        reason: '주변 환경 정보가 요청되었습니다',
        priority: ActionPriority.MEDIUM,
        parameters: {
          radius: 1000, // 1km
          categories: ['subway', 'bus', 'school', 'hospital', 'mart']
        }
      });
    }

    return actions;
  }

  /**
   * 분석 데이터 액션 생성 (면적별 비교 지원)
   */
  private generateAnalysisDataActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { slots, sessionHistory } = context;
    
    // 면적별 비교 패턴 감지
    const hasAreaComparison = this.detectAreaComparisonPattern(context);
    
    if (hasAreaComparison && slots.apartmentName) {
      console.log('🔄 면적별 비교 분석 모드 감지:', {
        apartment: slots.apartmentName,
        currentArea: slots.area,
        dealType: slots.dealType
      });
      
      // 현재 면적 데이터 수집
      if (slots.area) {
        actions.push({
          id: uuidv4(),
          type: 'searchRealEstate',
          name: `Collect ${slots.area}㎡ Data`,
          description: `${slots.area}㎡ 면적 부동산 데이터를 수집합니다`,
          reason: `현재 질문한 ${slots.area}㎡ 면적 데이터 필요`,
          priority: ActionPriority.HIGH,
          parameters: {
            includeHistory: true,
            specificArea: slots.area,
            apartmentName: slots.apartmentName,
            dealType: slots.dealType
          }
        });
      }
      
      // 이전 대화에서 언급된 다른 면적들도 수집
      const previousAreas = this.extractPreviousAreas(sessionHistory);
      previousAreas.forEach(area => {
        if (area !== slots.area) {
          actions.push({
            id: uuidv4(),
            type: 'searchRealEstate',
            name: `Collect ${area}㎡ Comparison Data`,
            description: `비교를 위한 ${area}㎡ 면적 데이터를 수집합니다`,
            reason: `이전에 언급된 ${area}㎡와 비교 분석을 위해`,
            priority: ActionPriority.MEDIUM,
            parameters: {
              includeHistory: true,
              specificArea: area,
              apartmentName: slots.apartmentName,
              dealType: slots.dealType || 'all'
            }
          });
        }
      });
    } else {
      // 일반 분석 데이터 수집
      actions.push({
        id: uuidv4(),
        type: 'searchRealEstate',
        name: 'Collect Analysis Data',
        description: '분석을 위한 부동산 데이터를 수집합니다',
        reason: '분석 작업에 필요한 데이터를 준비하기 위해',
        priority: ActionPriority.HIGH,
        parameters: {
          includeHistory: true,
          includeStatistics: true,
          extendedPeriod: true
        }
      });
    }

    return actions;
  }
  
  /**
   * 면적별 비교 패턴 감지
   */
  private detectAreaComparisonPattern(context: PlanContext): boolean {
    const { sessionHistory } = context;
    
    if (!sessionHistory?.messageHistory || sessionHistory.messageHistory.length < 2) {
      return false;
    }
    
    // 최근 2개 메시지에서 면적 변경 패턴 찾기
    const recentMessages = sessionHistory.messageHistory.slice(-2);
    const hasAreaInMessages = recentMessages.some(msg => {
      const slots = msg.extractedSlots || {};
      return slots.area || /\d+형|\d+㎡/.test(msg.message || '');
    });
    
    // "84형은 어때", "59형 어떤지", "그럼 다른 평수는" 같은 패턴
    const comparisonPatterns = [
      /\d+형[은는]?\s*어때/,
      /\d+㎡[은는]?\s*어떤지/,
      /그럼?\s*다른\s*평수/,
      /비교해서\s*봐/,
      /다른\s*면적/
    ];
    
    const hasComparisonKeywords = recentMessages.some(msg => 
      comparisonPatterns.some(pattern => pattern.test(msg.message || ''))
    );
    
    return hasAreaInMessages && (hasComparisonKeywords || recentMessages.length >= 2);
  }
  
  /**
   * 이전 대화에서 언급된 면적들 추출
   */
  private extractPreviousAreas(sessionHistory: any): number[] {
    if (!sessionHistory?.messageHistory) return [];
    
    const areas = new Set<number>();
    
    sessionHistory.messageHistory.forEach((msg: any) => {
      const slots = msg.extractedSlots || {};
      if (slots.area && typeof slots.area === 'number') {
        areas.add(slots.area);
      }
      
      // 메시지 텍스트에서도 면적 추출
      const message = msg.message || '';
      const areaMatches = message.match(/\b(\d+)(형|㎡)\b/g) || [];
      areaMatches.forEach(match => {
        const areaNum = parseInt(match.match(/\d+/)?.[0] || '0');
        if (areaNum > 0 && areaNum < 300) { // 합리적인 면적 범위
          areas.add(areaNum);
        }
      });
    });
    
    return Array.from(areas);
  }

  /**
   * 비교 데이터 액션 생성
   */
  private generateComparisonDataActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];

    // 비교 분석 액션 생성
    actions.push({
      id: uuidv4(),
      type: 'compare',
      name: 'Compare Multiple Apartments',
      description: '여러 아파트의 시세와 특성을 비교 분석합니다',
      reason: '사용자가 아파트 비교를 요청했습니다',
      priority: ActionPriority.HIGH,
      parameters: {
        comparisonType: 'price_analysis',
        includeMetrics: true,
        includeMarketTrend: true
      }
    });

    return actions;
  }

  /**
   * 추천 데이터 액션 생성 (RAG 검색 제거)
   */
  private generateRecommendationDataActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];

    // 추천을 위한 종합 데이터 수집 (DB 데이터만 사용)
    actions.push({
      id: uuidv4(),
      type: 'searchRealEstate',
      name: 'Collect Recommendation Data',
      description: '추천을 위한 종합 데이터를 수집합니다',
      reason: '추천 근거가 될 실거래 데이터가 필요합니다',
      priority: ActionPriority.HIGH,
      parameters: {
        includeMarketTrends: true,
        includeInvestmentMetrics: true
      }
    });

    // RAG 검색 제거: 의미 없는 외부 지식 검색 대신 실제 DB 데이터에 집중
    // actions.push({
    //   type: 'rag', // 제거됨: SQL 실행 실패 후에도 계속 실행되어 무의미
    // });

    return actions;
  }

  /**
   * 분석 액션 생성
   */
  private generateAnalysisActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    if (intent.category === 'analysis' || intent.actions.includes('calculateStats')) {
      actions.push({
        id: uuidv4(),
        type: 'calculateStats',
        name: 'Statistical Analysis',
        description: '데이터에 대한 통계 분석을 수행합니다',
        reason: '분석 결과를 위한 통계 계산이 필요합니다',
        priority: ActionPriority.MEDIUM,
        dependencies: ['searchRealEstate'],
        parameters: {
          metrics: ['average', 'median', 'trend', 'volatility']
        }
      });
    }

    if (intent.category === 'comparison') {
      actions.push({
        id: uuidv4(),
        type: 'compare',
        name: 'Comparison Analysis',
        description: '수집된 데이터를 비교 분석합니다',
        reason: '비교 결과를 생성하기 위해',
        priority: ActionPriority.MEDIUM,
        dependencies: ['searchRealEstate'],
        parameters: {
          comparisonType: 'detailed',
          includeMetrics: true
        }
      });
    }

    return actions;
  }

  /**
   * 출력 액션 생성
   */
  private generateOutputActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    // 시각화가 요청된 경우
    if (intent.actions.includes('visualize')) {
      actions.push({
        id: uuidv4(),
        type: 'visualize',
        name: 'Data Visualization',
        description: '결과를 그래프나 차트로 시각화합니다',
        reason: '시각적 표현이 요청되었습니다',
        priority: ActionPriority.MEDIUM,
        parameters: {
          chartType: 'auto', // 데이터에 맞게 자동 선택
          includeAnnotations: true
        }
      });
    }

    // 추천인 경우
    if (intent.category === 'recommendation') {
      actions.push({
        id: uuidv4(),
        type: 'recommend',
        name: 'Generate Recommendations',
        description: '분석 결과를 바탕으로 추천사항을 생성합니다',
        reason: '사용자에게 도움이 될 추천을 제공하기 위해',
        priority: ActionPriority.MEDIUM,
        parameters: {
          includeReasoning: true,
          maxRecommendations: 3
        }
      });
    }

    // 모든 경우에 요약 제공
    actions.push({
      id: uuidv4(),
      type: 'summarize',
      name: 'Summarize Results',
      description: '수집된 정보와 분석 결과를 요약합니다',
      reason: '사용자에게 이해하기 쉬운 답변을 제공하기 위해',
      priority: ActionPriority.MEDIUM,
      parameters: {
        includeKeyInsights: true,
        formatForUser: true
      }
    });

    return actions;
  }

  /**
   * 액션 최적화 및 정렬
   */
  private optimizeActions(actions: PlanAction[], context: PlanContext): PlanAction[] {
    // 1. 의존성 기반 정렬
    const sortedActions = this.topologicalSort(actions);
    
    // 2. 우선순위 적용
    const prioritizedActions = sortedActions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 같은 우선순위면 의존성 고려
      return 0;
    });

    // 3. 제약 조건 적용
    return this.applyConstraints(prioritizedActions, context);
  }

  /**
   * 위상 정렬 (의존성 해결)
   */
  private topologicalSort(actions: PlanAction[]): PlanAction[] {
    const result: PlanAction[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const actionMap = new Map(actions.map(a => [a.id, a]));

    const visit = (action: PlanAction) => {
      if (visiting.has(action.id)) {
        throw new Error(`Circular dependency detected: ${action.id}`);
      }
      if (visited.has(action.id)) {
        return;
      }

      visiting.add(action.id);

      // 의존성이 있는 액션들을 먼저 방문
      if (action.dependencies) {
        for (const depId of action.dependencies) {
          // dependencies는 액션 타입으로 지정되므로 타입으로 찾기
          const depAction = actions.find(a => a.type === depId);
          if (depAction) {
            visit(depAction);
          }
        }
      }

      visiting.delete(action.id);
      visited.add(action.id);
      result.push(action);
    };

    for (const action of actions) {
      if (!visited.has(action.id)) {
        visit(action);
      }
    }

    return result;
  }

  /**
   * 제약 조건 적용
   */
  private applyConstraints(actions: PlanAction[], context: PlanContext): PlanAction[] {
    const { constraints } = context;
    
    if (!constraints) return actions;

    // 최대 액션 수 제한
    let constrainedActions = actions.slice(0, constraints.maxActions);

    // 권한 확인
    if (constraints.userPermissions) {
      constrainedActions = constrainedActions.filter(action => 
        this.hasPermission(action.type, constraints.userPermissions)
      );
    }

    return constrainedActions;
  }

  /**
   * 권한 확인 (RAG 제거됨)
   */
  private hasPermission(actionType: ActionType, permissions: string[]): boolean {
    const permissionMap: Record<ActionType, string> = {
      'clarify': 'basic',
      'validate': 'basic',
      // 'rag': 'advanced', // 제거됨: 더 이상 지원하지 않음
      'generateSQL': 'data_access',
      'executeSQL': 'data_access',
      'searchRealEstate': 'data_access',
      'searchPOI': 'data_access',
      'calculateStats': 'analysis',
      'visualize': 'analysis',
      'summarize': 'basic',
      'recommend': 'analysis',
      'compare': 'analysis',
      'monitor': 'advanced'
    };

    const requiredPermission = permissionMap[actionType] || 'basic';
    return permissions.includes(requiredPermission) || permissions.includes('admin');
  }

  /**
   * 실행 시간 추정 (RAG 제거됨)
   */
  private estimateDuration(actions: PlanAction[]): number {
    const baseDurations: Record<ActionType, number> = {
      'clarify': 0,          // 사용자 응답 대기이므로 시간 계산 안함
      'validate': 500,
      // 'rag': 2000,        // 제거됨: 더 이상 지원하지 않음
      'generateSQL': 1000,
      'executeSQL': 1500,
      'searchRealEstate': 2000,
      'searchPOI': 1500,
      'calculateStats': 1000,
      'visualize': 3000,
      'summarize': 2000,
      'recommend': 2500,
      'compare': 2000,
      'monitor': 1000
    };

    return actions.reduce((total, action) => {
      const baseDuration = baseDurations[action.type] || 1000;
      const timeout = action.timeout || baseDuration;
      return total + Math.min(baseDuration, timeout);
    }, 0);
  }

  /**
   * 플랜 실행 (스켈레톤)
   */
  async executePlan(plan: ExecutionPlan, context: PlanContext): Promise<PlanExecution> {
    const execution: PlanExecution = {
      planId: plan.id,
      status: 'running',
      currentActionIndex: 0,
      startedAt: new Date(),
      results: [],
      errorCount: 0
    };

    this.runningPlans.set(plan.id, execution);

    if (this.config.debugMode) {
      console.log('🚀 플랜 실행 시작:', plan.id);
    }

    return execution;
  }

  /**
   * 플랜 취소
   */
  async cancelPlan(planId: string): Promise<boolean> {
    const execution = this.runningPlans.get(planId);
    if (execution) {
      execution.status = 'cancelled';
      execution.completedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * 플랜 상태 조회
   */
  async getPlanStatus(planId: string): Promise<PlanExecution | null> {
    return this.runningPlans.get(planId) || null;
  }
}

/**
 * 기본 플래너 인스턴스 생성
 */
export const defaultPlanner = new SmartPlanner();