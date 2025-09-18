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
    // RAG 핸들러 제거: 의미 없는 벡터 검색 대신 실제 DB 데이터 활용
    // this.actionHandlers.set('rag', new RAGHandler());
    this.actionHandlers.set('searchRealEstate', new SearchRealEstateHandler());
    this.actionHandlers.set('searchPOI', new SearchPOIHandler());
    this.actionHandlers.set('webSearch', new WebSearchHandler());
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

      // 2. Critic 검증 (성공/실패 상관없이 항상 실행)
      if (this.criticEnabled) {
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
        } else {
          // 이슈가 없어도 Critic 결과를 저장
          execution.criticResult = criticResult;
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
 * RAG 핸들러 - 외부 지식 검색 (비활성화됨)
 * 의미 없는 벡터 검색 대신 실제 DB 데이터에 집중
 */
/*
class RAGHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { topics } = action.parameters || {};
    
    // 스켈레톤 구현: SQL 실행 실패 후에도 무의미하게 실행됨
    console.log('🔍 RAG 검색 (비활성화됨):', topics);
    
    return {
      documents: [],
      summary: '관련 문서를 찾지 못했습니다.',
      confidence: 0.5
    };
  }
}
*/

/**
 * 부동산 검색 핸들러
 */
class SearchRealEstateHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots } = context;
    
    console.log('🏠 실제 부동산 데이터 검색:', {
      apartmentName: slots.apartmentName,
      apartmentMetadata: slots.apartmentMetadata,
      dealType: slots.dealType,
      area: slots.area
    });
    
    // 실제 searchRealEstateDeals 함수 호출
    try {
      const { searchRealEstateDeals } = await import('../handlers/searchRealEstateDeals');
      
      // 슬롯에서 검색 파라미터 구성
      const searchArgs: any = {};

      // 아파트 메타데이터가 있으면 활용
      if (slots.apartmentMetadata?.id) {
        searchArgs.apartmentId = slots.apartmentMetadata.id;
      } else if (slots.apartmentName) {
        searchArgs.apartmentName = slots.apartmentName;
      }

      if (slots.dealType && slots.dealType !== '전체') {
        searchArgs.dealType = slots.dealType;
      }

      if (slots.area) {
        searchArgs.area = slots.area.toString();
      }

      if (slots.period) {
        searchArgs.period = slots.period;
      }

      // 🆕 첨부된 아파트 정보 전달 (세션 기반 메모리)
      if (context.persistentAttachedApartments && context.persistentAttachedApartments.length > 0) {
        searchArgs.persistentAttachedApartments = context.persistentAttachedApartments;
      }

      // 기존 아파트 추출 데이터 호환성
      if (context.extractedApartments) {
        searchArgs.contextAptData = context.extractedApartments;
      }
      
      console.log('🔍 검색 파라미터:', searchArgs);
      
      const result = await searchRealEstateDeals(searchArgs);
      
      console.log('📊 검색 결과:', {
        success: result.success,
        dealCount: result.data?.deals?.length || 0,
        totalCount: result.data?.totalCount || 0
      });
      
      return result.data || {
        deals: [],
        totalCount: 0,
        searchConditions: searchArgs,
        error: result.error
      };
      
    } catch (error: any) {
      console.error('❌ 부동산 검색 실패:', error.message);
      return {
        deals: [],
        totalCount: 0,
        searchConditions: slots,
        error: error.message
      };
    }
  }
}

/**
 * POI 검색 핸들러
 */
class SearchPOIHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { radius, categories } = action.parameters || {};
    const { slots } = context;
    
    console.log('📍 실제 POI 검색:', { 
      apartmentName: slots.apartmentName,
      apartmentMetadata: slots.apartmentMetadata,
      coordinates: slots.coordinates,
      radius,
      categories 
    });
    
    // 디버깅: 슬롯 상태 상세 출력
    console.log('🔍 POI 검색 - 슬롯 상태 상세:', {
      hasApartmentName: !!slots.apartmentName,
      hasApartmentMetadata: !!slots.apartmentMetadata,
      hasCoordinates: !!slots.coordinates,
      apartmentMetadataKeys: slots.apartmentMetadata ? Object.keys(slots.apartmentMetadata) : [],
      coordinatesKeys: slots.coordinates ? Object.keys(slots.coordinates) : []
    });
    
    // 실제 searchNearbyPOI 함수 호출
    try {
      const { searchNearbyPOI } = await import('../handlers/searchNearbyPOI');
      
      // 아파트 좌표가 슬롯에 있는지 확인
      let lat, lng;
      
      if (slots.apartmentMetadata?.lat && slots.apartmentMetadata?.lon) {
        lat = slots.apartmentMetadata.lat;
        lng = slots.apartmentMetadata.lon;
      } else if (slots.coordinates) {
        lat = slots.coordinates.lat;
        lng = slots.coordinates.lng;
      } else if (slots.apartmentName) {
        // 데이터베이스에서 좌표 조회
        console.log('🔍 데이터베이스에서 좌표 조회 시도:', slots.apartmentName);
        try {
          const { db } = await import('../../lib/db');
          const result = await db
            .selectFrom('oi.apt_info')
            .select(['lat', 'lon', 'apt_nm'])
            .where('apt_nm', 'ilike', `%${slots.apartmentName}%`)
            .limit(1)
            .execute();

          if (result && result.length > 0) {
            lat = result[0].lat;
            lng = result[0].lon;
            console.log('✅ 데이터베이스에서 좌표 획득:', { apt_nm: result[0].apt_nm, lat, lng });
            
            // 슬롯에도 저장 (다음 검색 시 재사용)
            slots.coordinates = { lat, lng };
            if (slots.apartmentMetadata) {
              slots.apartmentMetadata.lat = lat;
              slots.apartmentMetadata.lon = lng;
            }
          } else {
            console.log('❌ 데이터베이스에서 좌표를 찾을 수 없음:', slots.apartmentName);
            return {
              pois: [],
              categories: categories || [],
              radius: radius || 1000,
              error: `${slots.apartmentName} 아파트의 위치 정보를 찾을 수 없습니다`
            };
          }
        } catch (dbError: any) {
          console.error('❌ 좌표 데이터베이스 조회 오류:', dbError);
          return {
            pois: [],
            categories: categories || [],
            radius: radius || 1000,
            error: '위치 정보 조회 중 오류가 발생했습니다'
          };
        }
      } else {
        console.log('❌ 좌표 정보가 없어 POI 검색 불가');
        return {
          pois: [],
          categories: categories || [],
          radius: radius || 1000,
          error: '아파트 위치 정보가 필요합니다'
        };
      }
      
      const searchArgs: any = {
        lat: lat.toString(),
        lng: lng.toString(),
        radius: (radius || 1000).toString(),
        poiType: 'all'
      };
      
      console.log('🔍 POI 검색 파라미터:', searchArgs);
      
      const result = await searchNearbyPOI(searchArgs);
      
      console.log('📍 POI 검색 결과:', {
        success: result.success,
        poiCount: result.pois?.length || 0,
        totalCount: result.totalCount || 0
      });
      
      // searchNearbyPOI가 직접 데이터를 반환하므로 result 자체를 반환
      if (result.success) {
        return result;
      } else {
        return {
          pois: [],
          categories: categories || [],
          radius: radius || 1000,
          error: result.error || 'POI 검색에 실패했습니다'
        };
      }
      
    } catch (error: any) {
      console.error('❌ POI 검색 실패:', error.message);
      return {
        pois: [],
        categories: categories || [],
        radius: radius || 1000,
        error: error.message
      };
    }
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
    const { slots } = context;

    console.log('⚖️ 비교 분석:', { comparisonType, includeMetrics });

    try {
      // 실제 compareMultipleApartments 함수 호출
      const { compareMultipleApartments } = await import('../handlers/compareMultipleApartments.enhanced');

      // 비교할 아파트 목록 구성
      const apartmentList = this.extractApartmentListForComparison(context);

      console.log('🔍 비교할 아파트 목록:', apartmentList);

      if (apartmentList.length < 2) {
        return {
          comparison: null,
          error: '비교하려면 최소 2개 이상의 아파트가 필요합니다.',
          suggestion: '다른 아파트를 추가로 언급해주세요.',
          apartmentList
        };
      }

      // 비교 분석 실행
      const comparisonArgs = {
        apartmentList,
        region: slots.region,
        dealType: slots.dealType || '매매',
        period: slots.period,
        area: slots.area,
        limit: 50,
        persistentAttachedApartments: context.persistentAttachedApartments
      };

      console.log('🔍 비교 분석 파라미터:', comparisonArgs);

      const result = await compareMultipleApartments(comparisonArgs);

      return {
        comparison: result,
        apartmentList,
        metrics: result?.metrics,
        conclusion: `${apartmentList.join(' vs ')} 비교 분석이 완료되었습니다.`
      };

    } catch (error: any) {
      console.error('❌ 비교 분석 실패:', error.message);
      return {
        comparison: null,
        error: `비교 분석 중 오류가 발생했습니다: ${error.message}`,
        apartmentList: []
      };
    }
  }

  /**
   * 컨텍스트에서 비교할 아파트 목록 추출
   */
  private extractApartmentListForComparison(context: PlanContext): string[] {
    const apartments: string[] = [];

    // 1. 현재 언급된 아파트 (최우선)
    if (context.slots.apartmentName) {
      apartments.push(context.slots.apartmentName);
    }

    // 2. 첨부된 아파트들 (세션 메모리)
    if (context.persistentAttachedApartments) {
      context.persistentAttachedApartments.forEach(apt => {
        if (!apartments.includes(apt.name)) {
          apartments.push(apt.name);
        }
      });
    }

    // 3. 메타데이터의 아파트들
    if (context.slots.apartmentMetadata) {
      const metaAptName = context.slots.apartmentMetadata.apt_nm || context.slots.apartmentMetadata.name;
      if (metaAptName && !apartments.includes(metaAptName)) {
        apartments.push(metaAptName);
      }
    }

    return apartments;
  }
}

/**
 * 웹 검색 핸들러 - 트렌드, 핫플레이스, 맛집 등 외부 정보 검색
 */
class WebSearchHandler implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext): Promise<any> {
    const { query, searchType, region } = action.parameters || {};
    const { slots } = context;

    console.log('🌐 웹 검색 실행:', { query, searchType, region });

    try {
      // 기존 webSearchService 활용
      const { webSearchService } = await import('../../utils/webSearchService');

      // LLM 기반 지능형 검색어 생성
      const intelligentQuery = await this.generateIntelligentSearchQuery(
        query || action.description,
        context,
        region
      );

      console.log('🔍 최종 검색 쿼리:', intelligentQuery);

      // 웹 검색 실행
      const webResults = await webSearchService.search(intelligentQuery);

      console.log('🔍 webSearchService 응답 구조:', {
        hasResults: !!webResults,
        hasResultsArray: !!webResults?.results,
        resultsCount: webResults?.results?.length || 0,
        resultCount: webResults?.resultCount || 0,
        sampleResult: webResults?.results?.[0]
      });

      if (webResults && webResults.results && webResults.results.length > 0) {
        console.log('✅ 웹 검색 성공:', {
          resultCount: webResults.results.length,
          totalCount: webResults.resultCount,
          searchQuery
        });

        return {
          type: 'web_search_results',
          query: intelligentQuery,
          results: webResults.results,
          totalCount: webResults.results.length,
          searchType: searchType || 'general',
          region: region || slots.region,
          source: 'web_search',
          confidence: 0.8
        };
      } else {
        console.log('❌ 웹 검색 결과 없음:', intelligentQuery);

        return {
          type: 'web_search_results',
          query: intelligentQuery,
          results: [],
          totalCount: 0,
          searchType: searchType || 'general',
          region: region || slots.region,
          source: 'web_search',
          error: '관련 정보를 찾을 수 없습니다.',
          confidence: 0.3
        };
      }

    } catch (error: any) {
      console.error('❌ 웹 검색 실패:', error.message);

      return {
        type: 'web_search_results',
        query: action.description,
        results: [],
        totalCount: 0,
        searchType: searchType || 'general',
        source: 'web_search',
        error: `웹 검색 중 오류가 발생했습니다: ${error.message}`,
        confidence: 0.1
      };
    }
  }

  /**
   * LLM 기반 지능형 검색어 생성
   */
  private async generateIntelligentSearchQuery(
    userQuery: string,
    context: PlanContext,
    region?: string
  ): Promise<string> {
    try {
      const { slots } = context;

      // 아파트 정보 수집
      const apartmentInfo = this.extractApartmentInfo(context);

      console.log('🏠 아파트 정보 추출:', apartmentInfo);

      // 지역 정보가 이미 있으면 단순 결합
      if (region) {
        return `${region} ${userQuery}`;
      }

      // 아파트 정보가 있으면 LLM으로 지능형 검색어 생성
      if (apartmentInfo.hasApartment) {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const prompt = `사용자가 "${userQuery}"라고 질문했습니다.

현재 컨텍스트:
- 아파트: ${apartmentInfo.name}
- 주소: ${apartmentInfo.address || '정보 없음'}
- 지역: ${apartmentInfo.region || '정보 없음'}

사용자 질문의 의도를 파악하여 해당 아파트 주변 지역을 포함한 효과적인 검색어를 생성해주세요.

예시:
- "놀만한 곳 있어?" → "${apartmentInfo.region || apartmentInfo.name} 주변 놀거리 데이트코스 볼거리"
- "맛집 추천해줘" → "${apartmentInfo.region || apartmentInfo.name} 근처 맛집 추천 맛있는집"
- "카페 어디 있어?" → "${apartmentInfo.region || apartmentInfo.name} 카페 분위기좋은 추천"

검색어만 반환해주세요:`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        });

        const intelligentQuery = completion.choices[0]?.message?.content?.trim();

        if (intelligentQuery) {
          console.log('🧠 LLM 생성 검색어:', intelligentQuery);
          return intelligentQuery;
        }
      }

      // 폴백: 원본 쿼리 반환
      return userQuery;

    } catch (error) {
      console.error('❌ 지능형 검색어 생성 실패:', error);
      return userQuery;
    }
  }

  /**
   * 컨텍스트에서 아파트 정보 추출
   */
  private extractApartmentInfo(context: PlanContext) {
    const { slots } = context;

    // persistentAttachedApartments에서 정보 추출
    if (context.persistentAttachedApartments && context.persistentAttachedApartments.length > 0) {
      const apt = context.persistentAttachedApartments[0];
      return {
        hasApartment: true,
        name: apt.name,
        address: apt.address,
        region: this.extractRegionFromAddress(apt.address)
      };
    }

    // apartmentMetadata에서 정보 추출
    if (slots.apartmentMetadata) {
      const metadata = slots.apartmentMetadata;
      return {
        hasApartment: true,
        name: metadata.apt_nm || metadata.name,
        address: metadata.address || metadata.jibun_address,
        region: this.extractRegionFromAddress(metadata.address || metadata.jibun_address)
      };
    }

    // apartmentName에서 정보 추출
    if (slots.apartmentName) {
      return {
        hasApartment: true,
        name: slots.apartmentName,
        address: null,
        region: null
      };
    }

    return {
      hasApartment: false,
      name: null,
      address: null,
      region: null
    };
  }

  /**
   * 주소에서 지역명 추출
   */
  private extractRegionFromAddress(address?: string): string | null {
    if (!address) return null;

    // "서울 강남구" 형태로 추출
    const addressParts = address.split(' ');
    if (addressParts.length >= 2) {
      return addressParts.slice(0, 2).join(' ');
    }

    // 구 단위만 추출
    const districtMatch = address.match(/([\uAC00-\uD7A3]+구)/);
    if (districtMatch) {
      return `서울 ${districtMatch[1]}`;
    }

    return null;
  }
}

/**
 * 기본 액션 실행기 인스턴스
 */
export const defaultExecutor = new ActionExecutor();