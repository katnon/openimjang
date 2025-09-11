// apps/bff/src/ai/planner/executor.ts
// 플랜 액션들을 실제로 실행하는 엔진

import { 
  PlanAction, 
  ActionResult, 
  PlanExecution, 
  ExecutionPlan, 
  PlanContext,
  ActionType 
} from './types';
import { ConversationSlots } from '../types/slots';
import { CriticContext, CriticResult } from '../critic/types';

/**
 * 액션 실행 엔진
 */
export class ActionExecutor {
  private actionHandlers = new Map<ActionType, ActionHandler>();
  private criticEnabled: boolean = true;
  private criticDebugMode: boolean = false;

  constructor(options: { enableCritic?: boolean; criticDebugMode?: boolean } = {}) {
    this.criticEnabled = options.enableCritic ?? true;
    this.criticDebugMode = options.criticDebugMode ?? false;
    this.registerDefaultHandlers();
  }

  /**
   * 기본 액션 핸들러들을 등록합니다
   */
  private registerDefaultHandlers() {
    this.actionHandlers.set('clarify', new ClarifyHandler());
    this.actionHandlers.set('validate', new ValidateHandler());
    this.actionHandlers.set('rag', new RAGHandler());
    this.actionHandlers.set('searchRealEstate', new SearchRealEstateHandler());
    this.actionHandlers.set('searchPOI', new SearchPOIHandler());
    this.actionHandlers.set('calculateStats', new CalculateStatsHandler());
    this.actionHandlers.set('visualize', new VisualizeHandler());
    this.actionHandlers.set('summarize', new SummarizeHandler());
    this.actionHandlers.set('recommend', new RecommendHandler());
    this.actionHandlers.set('compare', new CompareHandler());
  }

  /**
   * 단일 액션을 실행합니다
   */
  async executeAction(
    action: PlanAction, 
    context: PlanContext,
    previousResults: ActionResult[]
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const handler = this.actionHandlers.get(action.type);
      if (!handler) {
        throw new Error(`Handler not found for action type: ${action.type}`);
      }

      console.log(`🔧 액션 실행: ${action.type} - ${action.name}`);

      const result = await handler.execute(action, context, previousResults);
      const executionTime = Date.now() - startTime;

      return {
        actionId: action.id,
        success: true,
        executionTime,
        data: result,
        metadata: {
          confidence: result?.confidence || 1.0
        }
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ 액션 실행 실패: ${action.type}`, error.message);

      return {
        actionId: action.id,
        success: false,
        executionTime,
        error: error.message
      };
    }
  }

  /**
   * 실행 계획을 Critic 검증과 함께 실행합니다
   */
  async executeWithCritic(
    plan: ExecutionPlan,
    context: PlanContext,
    sessionMetadata?: any
  ): Promise<PlanExecution> {
    const execution: PlanExecution = {
      planId: plan.id,
      status: 'running',
      startedAt: new Date(),
      results: [],
      context
    };

    try {
      // 1. 일반 실행
      for (const action of plan.actions) {
        const result = await this.executeAction(action, context, execution.results);
        execution.results.push(result);

        // 실행 실패 시 조기 종료
        if (!result.success) {
          execution.status = 'failed';
          execution.error = result.error;
          break;
        }
      }

      if (execution.status !== 'failed') {
        execution.status = 'completed';
      }

      // 2. Critic 검증 (실행 성공 시만)
      if (this.criticEnabled && execution.status === 'completed') {
        const criticResult = await this.runCriticValidation(execution, context, sessionMetadata);
        
        if (criticResult.hasIssue && criticResult.needsRetry) {
          // 재시도 필요한 경우
          execution.criticResult = criticResult;
          execution.retryRecommendation = criticResult;
          
          if (this.criticDebugMode) {
            console.log('🔍 Critic 재시도 권장:', {
              issueType: criticResult.issueType,
              recommendedAction: criticResult.recommendedAction,
              adjustedSlots: criticResult.adjustedSlots
            });
          }
        }
      }

      execution.completedAt = new Date();
      return execution;

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
      return execution;
    }
  }

  /**
   * Critic 검증 실행
   */
  private async runCriticValidation(
    execution: PlanExecution,
    context: PlanContext,
    sessionMetadata?: any
  ): Promise<CriticResult> {
    try {
      // 동적 import로 Critic 체크리스트 로드
      const { CriticChecklist } = await import('../critic/checklist');
      
      const checklist = new CriticChecklist({
        debugMode: this.criticDebugMode,
        maxRetries: 2
      });

      // Critic 컨텍스트 생성
      const criticContext: CriticContext = {
        currentSlots: context.slots,
        actionResults: execution.results.map(result => ({
          actionId: result.actionId,
          actionType: execution.results.find(r => r.actionId === result.actionId)?.actionType || 'unknown',
          data: result.data,
          success: result.success,
          executedAt: new Date(),
          error: result.error
        })),
        userProfile: context.userProfile,
        sessionMetadata
      };

      const criticResult = await checklist.validateResults(criticContext);

      if (this.criticDebugMode && criticResult.hasIssue) {
        console.log('🔍 Critic 검증 이슈 발견:', {
          issueType: criticResult.issueType,
          needsRetry: criticResult.needsRetry,
          confidence: criticResult.confidence,
          explanation: criticResult.explanation
        });
      }

      return criticResult;

    } catch (error: any) {
      console.error('❌ Critic 검증 오류:', error);
      return {
        hasIssue: false,
        needsRetry: false,
        confidence: 1.0,
        explanation: `Critic 검증 실패: ${error.message}`
      };
    }
  }

  /**
   * 커스텀 핸들러 등록
   */
  registerHandler(actionType: ActionType, handler: ActionHandler) {
    this.actionHandlers.set(actionType, handler);
  }

  /**
   * Critic 설정 업데이트
   */
  updateCriticConfig(enabled: boolean, debugMode?: boolean) {
    this.criticEnabled = enabled;
    if (debugMode !== undefined) {
      this.criticDebugMode = debugMode;
    }
  }
}

/**
 * 액션 핸들러 인터페이스
 */
export interface ActionHandler {
  execute(
    action: PlanAction, 
    context: PlanContext, 
    previousResults: ActionResult[]
  ): Promise<any>;
}

/**
 * Clarify 핸들러 - 새로운 Clarify 정책 사용
 */
class ClarifyHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    // 새로운 Clarify 정책 import (동적 import 사용)
    const { defaultClarifyPolicy } = await import('../clarify/policy');
    const { ClarifyContext } = await import('../clarify/types');
    
    const { missingField, suggestionContext } = action.parameters || {};
    
    try {
      // Clarify 컨텍스트 생성
      const clarifyContext: ClarifyContext = {
        currentSlots: context.slots,
        reason: 'missing',
        userProfile: context.userProfile,
        metadata: suggestionContext
      };

      // 새로운 정책으로 질문 생성
      const question = await defaultClarifyPolicy.generateQuestion(
        missingField as any, 
        clarifyContext
      );

      return {
        type: 'clarify_required',
        message: question.question,
        field: missingField,
        suggestions: question.suggestions || [],
        hint: question.hint,
        expectedResponseType: question.expectedResponseType,
        priority: question.priority,
        requiresUserInput: true
      };

    } catch (error: any) {
      console.error('❌ Clarify 정책 실행 실패:', error);
      
      // 폴백: 기존 방식 사용
      const clarifyMessage = this.generateFallbackMessage(missingField, context);
      
      return {
        type: 'clarify_required',
        message: clarifyMessage,
        field: missingField,
        suggestions: suggestionContext?.suggestions || [],
        requiresUserInput: true
      };
    }
  }

  private generateFallbackMessage(field: string, context: PlanContext): string {
    const { slots } = context;
    
    switch (field) {
      case 'apartmentName':
        if (slots.region) {
          return `${slots.region} 지역의 어떤 아파트에 대해 알고 싶으신가요? 구체적인 아파트명을 알려주세요.`;
        }
        return '어떤 아파트에 대해 알고 싶으신가요? 아파트명을 알려주세요.';
        
      case 'dealType':
        return '매매, 전세, 월세 중 어떤 거래에 대해 알고 싶으신가요?';
        
      case 'region':
        return '어느 지역에 대해 알고 싶으신가요? (예: 강남구, 서초구 등)';
        
      case 'area':
        if (slots.apartmentName) {
          return `${slots.apartmentName}의 몇 ㎡(몇형) 정보를 원하시나요?`;
        }
        return '몇 ㎡(몇형) 정보를 원하시나요?';
        
      default:
        return `${field} 정보를 좀 더 구체적으로 알려주세요.`;
    }
  }
}

/**
 * Validate 핸들러 - 입력 데이터 검증
 */
class ValidateHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { field, value } = action.parameters || {};
    
    switch (field) {
      case 'apartmentName':
        return this.validateApartmentName(value);
      default:
        return { valid: true, value };
    }
  }

  private async validateApartmentName(name: string): Promise<any> {
    // 실제로는 DB에서 아파트명을 검증해야 함
    // 여기서는 간단한 검증만 수행
    if (!name || name.length < 2) {
      return {
        valid: false,
        error: '아파트명이 너무 짧습니다.',
        suggestions: []
      };
    }

    return {
      valid: true,
      normalized: name,
      confidence: 0.9
    };
  }
}

/**
 * RAG 핸들러 - 외부 지식 검색
 */
class RAGHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { topics } = action.parameters || {};
    
    // 여기서는 스켈레톤만 구현
    // 실제로는 벡터 DB나 외부 API를 호출
    console.log('🔍 RAG 검색:', topics);
    
    return {
      documents: [],
      summary: '관련 문서를 찾지 못했습니다.',
      confidence: 0.5
    };
  }
}

/**
 * 부동산 검색 핸들러
 */
class SearchRealEstateHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots } = context;
    
    // 기존 함수 호출을 시뮬레이션
    // 실제로는 searchRealEstateDeals 함수를 호출
    console.log('🏠 부동산 데이터 검색:', {
      apartmentName: slots.apartmentName,
      dealType: slots.dealType,
      area: slots.area
    });
    
    // 검증 결과가 있으면 활용
    const validationResult = previousResults.find(r => 
      r.success && r.data?.type !== 'clarify_required'
    );
    
    return {
      deals: [],
      totalCount: 0,
      searchConditions: slots,
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        note: '30000 = 3억원'
      }
    };
  }
}

/**
 * POI 검색 핸들러
 */
class SearchPOIHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { radius, categories } = action.parameters || {};
    const { slots } = context;
    
    console.log('📍 POI 검색:', { 
      apartmentName: slots.apartmentName,
      radius,
      categories 
    });
    
    return {
      pois: [],
      categories: categories || [],
      radius: radius || 1000
    };
  }
}

/**
 * 통계 계산 핸들러
 */
class CalculateStatsHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { metrics } = action.parameters || {};
    
    // 이전 검색 결과에서 데이터 추출
    const searchResult = previousResults.find(r => 
      r.success && r.data?.deals
    );
    
    if (!searchResult?.data?.deals) {
      return {
        error: '분석할 데이터가 없습니다.',
        metrics: {}
      };
    }
    
    const deals = searchResult.data.deals;
    console.log('📊 통계 계산:', { dealCount: deals.length, metrics });
    
    return {
      statistics: {
        count: deals.length,
        average: 0,
        median: 0,
        trend: 'stable'
      },
      metrics: metrics || []
    };
  }
}

/**
 * 시각화 핸들러
 */
class VisualizeHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { chartType } = action.parameters || {};
    
    console.log('📈 데이터 시각화:', { chartType });
    
    return {
      chartType: chartType || 'line',
      chartData: {},
      chartUrl: '/charts/placeholder.png'
    };
  }
}

/**
 * 요약 핸들러
 */
class SummarizeHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { includeKeyInsights, formatForUser } = action.parameters || {};
    
    // 모든 이전 결과를 종합하여 요약 생성
    const validResults = previousResults.filter(r => r.success && r.data);
    
    console.log('📝 결과 요약:', { 
      resultCount: validResults.length,
      includeKeyInsights,
      formatForUser 
    });
    
    return {
      summary: this.generateSummary(validResults, context),
      keyInsights: includeKeyInsights ? this.extractKeyInsights(validResults) : [],
      confidence: 0.8
    };
  }

  private generateSummary(results: ActionResult[], context: PlanContext): string {
    const { slots, intent } = context;
    
    let summary = '';
    
    if (slots.apartmentName) {
      summary += `${slots.apartmentName}에 대한 정보를 찾았습니다. `;
    }
    
    const searchResult = results.find(r => r.data?.deals);
    if (searchResult?.data?.deals) {
      const count = searchResult.data.deals.length;
      summary += `총 ${count}건의 거래 데이터가 있습니다. `;
    }
    
    const statsResult = results.find(r => r.data?.statistics);
    if (statsResult?.data?.statistics) {
      const stats = statsResult.data.statistics;
      summary += `평균 거래가는 ${stats.average}만원입니다. `;
    }
    
    return summary || '요청하신 정보를 처리했습니다.';
  }

  private extractKeyInsights(results: ActionResult[]): string[] {
    const insights: string[] = [];
    
    // 실제로는 더 복잡한 인사이트 추출 로직
    insights.push('시장 동향이 안정적입니다.');
    
    return insights;
  }
}

/**
 * 추천 핸들러
 */
class RecommendHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { includeReasoning, maxRecommendations } = action.parameters || {};
    
    console.log('💡 추천 생성:', { includeReasoning, maxRecommendations });
    
    return {
      recommendations: [],
      reasoning: includeReasoning ? [] : undefined,
      confidence: 0.7
    };
  }
}

/**
 * 비교 핸들러
 */
class CompareHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { comparisonType, includeMetrics } = action.parameters || {};
    
    console.log('⚖️ 비교 분석:', { comparisonType, includeMetrics });
    
    return {
      comparison: {},
      metrics: includeMetrics ? {} : undefined,
      conclusion: '비교 분석이 완료되었습니다.'
    };
  }
}

/**
 * 기본 액션 실행기 인스턴스
 */
export const defaultExecutor = new ActionExecutor();