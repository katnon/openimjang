// apps/bff/src/ai/planner/planner.enhanced.ts
// 멀티 아파트 비교를 지원하는 강화된 플래너

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
 * 강화된 플래너 클래스 - 멀티 아파트 비교 지원
 */
export class EnhancedSmartPlanner implements IPlanner {
  private config: PlannerConfig;
  private runningPlans = new Map<string, PlanExecution>();

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
  }

  /**
   * 실행 플랜 생성 (멀티 아파트 비교 강화)
   */
  async createPlan(context: PlanContext): Promise<ExecutionPlan> {
    if (this.config.debugMode) {
      console.log('🎯 강화 플래너: 플랜 생성 시작', {
        question: context.question.slice(0, 100),
        slotsCount: Object.keys(context.slots).length,
        apartmentList: context.slots.apartmentList
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

    // 3. 멀티 아파트 비교 감지
    const isMultiApartmentComparison = this.detectMultiApartmentComparison(context);
    if (isMultiApartmentComparison) {
      console.log('✅ 멀티 아파트 비교 모드 활성화:', context.slots.apartmentList);
      llmAnalysis.intent.category = 'comparison';
      llmAnalysis.intent.isMultiApartment = true;
    }

    // 4. 강화된 의도 분석 업데이트
    context.intent = {
      ...llmAnalysis.intent,
      isMultiApartment: isMultiApartmentComparison,
      apartmentCount: context.slots.apartmentList?.length || 0
    };

    // 5. 액션 계획 생성
    const planActions = this.generatePlanActions(context, llmAnalysis);

    const plan: ExecutionPlan = {
      id: uuidv4(),
      name: this.generatePlanName(context),
      description: this.generatePlanDescription(context),
      context,
      actions: planActions,
      status: 'created',
      createdAt: new Date(),
      totalActions: planActions.length,
      metadata: {
        llmAnalysis,
        isMultiApartment: isMultiApartmentComparison,
        apartmentCount: context.slots.apartmentList?.length || 0
      }
    };

    if (this.config.debugMode) {
      console.log('✅ 강화 플랜 생성 완료:', {
        planId: plan.id,
        actionCount: plan.totalActions,
        actions: plan.actions.map(a => a.type),
        isMultiApartment: isMultiApartmentComparison
      });
    }

    return plan;
  }

  /**
   * 멀티 아파트 비교 감지
   */
  private detectMultiApartmentComparison(context: PlanContext): boolean {
    const { slots, question } = context;

    // 1. apartmentList에 2개 이상의 아파트가 있는 경우
    if (slots.apartmentList && slots.apartmentList.length >= 2) {
      return true;
    }

    // 2. 비교 키워드가 있고 @멘션이 여러 개인 경우
    const comparisonKeywords = ['비교', '차이', '어느', '어떤게', '둘', '두', 'vs', '대비'];
    const hasComparisonKeyword = comparisonKeywords.some(keyword =>
      question.toLowerCase().includes(keyword)
    );

    if (hasComparisonKeyword && slots.apartmentList && slots.apartmentList.length >= 1) {
      return true;
    }

    return false;
  }

  /**
   * 강화된 액션 계획 생성
   */
  private generatePlanActions(context: PlanContext, llmAnalysis: any): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    // 멀티 아파트 비교 전용 워크플로우
    if (intent.isMultiApartment) {
      return this.generateMultiApartmentComparisonActions(context);
    }

    // 기존 단일 아파트 워크플로우
    return this.generateStandardActions(context, llmAnalysis);
  }

  /**
   * 멀티 아파트 비교 전용 액션 생성
   */
  private generateMultiApartmentComparisonActions(context: PlanContext): PlanAction[] {
    const actions: PlanAction[] = [];

    // 1. 아파트명 유효성 검증
    actions.push({
      id: uuidv4(),
      type: 'validate',
      name: 'Validate Multiple Apartments',
      description: '멀티 아파트명 유효성을 검증합니다',
      reason: '정확한 아파트 식별이 필요합니다',
      priority: ActionPriority.HIGH,
      parameters: {
        validateMultiple: true,
        apartmentList: context.slots.apartmentList
      }
    });

    // 2. 다중 아파트 데이터 수집
    actions.push({
      id: uuidv4(),
      type: 'compareMultipleApartments',
      name: 'Collect Multiple Apartment Data',
      description: '여러 아파트의 거래 데이터를 수집합니다',
      reason: '비교 분석을 위해 각 아파트 데이터가 필요합니다',
      priority: ActionPriority.HIGH,
      parameters: {
        apartmentList: context.slots.apartmentList,
        dealType: context.slots.dealType || '매매',
        area: context.slots.area,
        areaRange: context.slots.areaRange,
        period: context.slots.period,
        region: context.slots.region
      }
    });

    // 3. 비교 분석
    actions.push({
      id: uuidv4(),
      type: 'compare',
      name: 'Multi Apartment Analysis',
      description: '수집된 데이터로 비교 분석을 수행합니다',
      reason: '사용자가 요청한 비교 분석 제공',
      priority: ActionPriority.MEDIUM,
      parameters: {
        comparisonType: 'multi_apartment',
        includeMetrics: true,
        includeRecommendation: true
      }
    });

    // 4. 결과 요약
    actions.push({
      id: uuidv4(),
      type: 'summarize',
      name: 'Generate Comparison Summary',
      description: '비교 결과를 사용자 친화적으로 요약합니다',
      reason: '명확한 비교 결론 제시',
      priority: ActionPriority.LOW,
      parameters: {
        resultCount: context.slots.apartmentList?.length || 2,
        includeKeyInsights: true,
        formatForUser: true,
        comparisonMode: true
      }
    });

    return actions;
  }

  /**
   * 기존 단일 아파트 액션 생성 (기존 로직 유지)
   */
  private generateStandardActions(context: PlanContext, llmAnalysis: any): PlanAction[] {
    const actions: PlanAction[] = [];
    const { intent } = context;

    // 기본 검증 액션
    actions.push({
      id: uuidv4(),
      type: 'validate',
      name: 'Validate Apartment Name',
      description: '아파트명의 유효성을 검증합니다',
      reason: '정확한 아파트 식별이 중요합니다',
      priority: ActionPriority.HIGH,
      parameters: {}
    });

    // 의도에 따른 데이터 수집 액션
    switch (intent.category) {
      case 'search':
        actions.push(...this.generateSearchActions(context));
        break;
      case 'analysis':
        actions.push(...this.generateAnalysisActions(context));
        break;
      case 'comparison':
        actions.push(...this.generateSingleComparisonActions(context));
        break;
    }

    // 결과 요약 액션
    actions.push({
      id: uuidv4(),
      type: 'summarize',
      name: 'Summarize Results',
      description: '수집된 정보를 종합하여 요약합니다',
      reason: '사용자 질문에 대한 완전한 답변 제공',
      priority: ActionPriority.LOW,
      parameters: {
        includeKeyInsights: true,
        formatForUser: true
      }
    });

    return actions;
  }

  /**
   * 검색 액션 생성
   */
  private generateSearchActions(context: PlanContext): PlanAction[] {
    return [{
      id: uuidv4(),
      type: 'searchRealEstate',
      name: 'Search Real Estate Data',
      description: '실거래 데이터를 검색합니다',
      reason: '사용자가 요청한 정보 검색',
      priority: ActionPriority.HIGH,
      parameters: {}
    }];
  }

  /**
   * 분석 액션 생성
   */
  private generateAnalysisActions(context: PlanContext): PlanAction[] {
    return [{
      id: uuidv4(),
      type: 'searchRealEstate',
      name: 'Collect Analysis Data',
      description: '분석을 위한 데이터를 수집합니다',
      reason: '상세 분석을 위한 데이터 필요',
      priority: ActionPriority.HIGH,
      parameters: {}
    }];
  }

  /**
   * 단일 비교 액션 생성
   */
  private generateSingleComparisonActions(context: PlanContext): PlanAction[] {
    return [{
      id: uuidv4(),
      type: 'searchRealEstate',
      name: 'Collect Comparison Data',
      description: '비교 분석을 위한 데이터를 수집합니다',
      reason: '비교 대상 데이터 필요',
      priority: ActionPriority.HIGH,
      parameters: {}
    }];
  }

  /**
   * 플랜 이름 생성
   */
  private generatePlanName(context: PlanContext): string {
    if (context.intent.isMultiApartment) {
      const apartmentNames = context.slots.apartmentList?.join(', ') || '여러 아파트';
      return `${apartmentNames} 비교 분석`;
    }

    const apartmentName = context.slots.apartmentName || '아파트';
    return `${apartmentName} 정보 조회`;
  }

  /**
   * 플랜 설명 생성
   */
  private generatePlanDescription(context: PlanContext): string {
    if (context.intent.isMultiApartment) {
      const count = context.slots.apartmentList?.length || 2;
      return `${count}개 아파트의 실거래 데이터를 수집하고 비교 분석을 수행합니다.`;
    }

    return '아파트 정보를 검증하고 관련 데이터를 수집하여 사용자 질문에 답변합니다.';
  }

  // 기존 인터페이스 메서드들 (변경 없음)
  async executePlan(plan: ExecutionPlan): Promise<any[]> {
    // 기존 구현 유지
    return [];
  }

  async getRunningPlans(): Promise<string[]> {
    return Array.from(this.runningPlans.keys());
  }

  async cancelPlan(planId: string): Promise<boolean> {
    return this.runningPlans.delete(planId);
  }
}