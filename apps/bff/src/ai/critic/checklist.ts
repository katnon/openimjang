// apps/bff/src/ai/critic/checklist.ts
// Critic 체크리스트 메인 엔진 - 결과 검증 및 품질 관리

import { 
  ICriticChecklist, 
  CriticContext, 
  CriticResult, 
  CriticRule,
  CriticConfig,
  DEFAULT_CRITIC_CONFIG,
  PERIOD_EXTENSION_MAP
} from './types';
import { defaultCriticRules } from './rules';
import { ConversationSlots } from '../types/slots';

/**
 * Critic 체크리스트 구현체
 */
export class CriticChecklist implements ICriticChecklist {
  private rules: Map<string, CriticRule> = new Map();
  private config: CriticConfig;

  constructor(config: Partial<CriticConfig> = {}) {
    this.config = { ...DEFAULT_CRITIC_CONFIG, ...config };
    
    // 기본 규칙들 등록
    defaultCriticRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    if (this.config.debugMode) {
      console.log('🔍 Critic 체크리스트 초기화:', {
        rulesCount: this.rules.size,
        config: this.config
      });
    }
  }

  /**
   * 액션 결과를 검증합니다
   */
  async validateResults(context: CriticContext): Promise<CriticResult> {
    if (this.config.debugMode) {
      console.log('🔍 Critic 검증 시작:', {
        actionsCount: context.actionResults.length,
        currentSlots: context.currentSlots
      });
    }

    try {
      // 모든 활성화된 규칙 실행
      const allResults = await this.runAllChecks(context);
      
      if (allResults.length === 0) {
        return {
          hasIssue: false,
          needsRetry: false,
          confidence: 1.0,
          explanation: '모든 검증 통과'
        };
      }

      // 이슈가 있는 규칙들 필터링
      const issueResults = allResults.filter(result => result.hasIssue);

      if (issueResults.length === 0) {
        return {
          hasIssue: false,
          needsRetry: false,
          confidence: this.calculateOverallConfidence(allResults),
          explanation: '모든 검증 통과'
        };
      }

      // 우선순위가 가장 높은 이슈 선택
      const primaryIssue = this.selectPrimaryIssue(issueResults);

      if (this.config.debugMode) {
        console.log('🔍 Critic 검증 완료:', {
          totalChecks: allResults.length,
          issuesFound: issueResults.length,
          primaryIssue: primaryIssue.issueType
        });
      }

      return primaryIssue;

    } catch (error: any) {
      console.error('❌ Critic 검증 오류:', error);
      return {
        hasIssue: true,
        issueType: 'quality',
        needsRetry: false,
        confidence: 0.1,
        explanation: `검증 중 오류 발생: ${error.message}`
      };
    }
  }

  /**
   * 특정 규칙을 실행합니다
   */
  async executeRule(ruleId: string, context: CriticContext): Promise<CriticResult> {
    const rule = this.rules.get(ruleId);
    
    if (!rule) {
      throw new Error(`규칙을 찾을 수 없습니다: ${ruleId}`);
    }

    if (!rule.enabled) {
      return {
        hasIssue: false,
        needsRetry: false,
        confidence: 1.0,
        explanation: `규칙 비활성화: ${ruleId}`
      };
    }

    try {
      // 조건 확인
      if (!rule.condition(context)) {
        return {
          hasIssue: false,
          needsRetry: false,
          confidence: 1.0,
          explanation: `조건 불만족: ${rule.name}`
        };
      }

      // 규칙 실행
      const result = rule.check(context);
      
      if (this.config.debugMode) {
        console.log(`🔍 규칙 실행: ${rule.name}`, {
          hasIssue: result.hasIssue,
          issueType: result.issueType,
          confidence: result.confidence
        });
      }

      return result;

    } catch (error: any) {
      console.error(`❌ 규칙 실행 오류 [${ruleId}]:`, error);
      return {
        hasIssue: true,
        issueType: 'quality',
        needsRetry: false,
        confidence: 0.1,
        explanation: `규칙 실행 오류: ${error.message}`
      };
    }
  }

  /**
   * 모든 활성화된 규칙을 실행합니다
   */
  async runAllChecks(context: CriticContext): Promise<CriticResult[]> {
    const enabledRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority); // 우선순위 순으로 정렬

    const results: CriticResult[] = [];

    for (const rule of enabledRules) {
      try {
        const result = await this.executeRule(rule.id, context);
        results.push(result);
      } catch (error: any) {
        console.error(`❌ 규칙 [${rule.id}] 실행 실패:`, error);
        results.push({
          hasIssue: true,
          issueType: 'quality',
          needsRetry: false,
          confidence: 0.1,
          explanation: `규칙 실행 실패: ${rule.name}`
        });
      }
    }

    return results;
  }

  /**
   * 재시도 권장사항을 생성합니다
   */
  async generateRetryRecommendation(context: CriticContext): Promise<CriticResult> {
    const retryCount = context.sessionMetadata?.retryCount || 0;
    
    if (retryCount >= this.config.maxRetries) {
      return {
        hasIssue: true,
        issueType: 'quality',
        recommendedAction: 'terminate',
        needsRetry: false,
        userMessage: '여러 번 시도했지만 만족스러운 결과를 찾지 못했습니다. 다른 검색 조건을 시도해보시겠어요?',
        confidence: 0.9,
        explanation: `최대 재시도 횟수 도달: ${retryCount}/${this.config.maxRetries}`
      };
    }

    // 현재 상황 분석
    const validationResult = await this.validateResults(context);
    
    if (!validationResult.hasIssue || !validationResult.needsRetry) {
      return validationResult;
    }

    // 재시도 전략 결정
    const retryStrategy = this.determineRetryStrategy(validationResult, context);

    return {
      ...validationResult,
      ...retryStrategy,
      explanation: `재시도 ${retryCount + 1}/${this.config.maxRetries}: ${validationResult.explanation}`
    };
  }

  /**
   * 규칙 추가
   */
  addRule(rule: CriticRule): void {
    this.rules.set(rule.id, rule);
    
    if (this.config.debugMode) {
      console.log('✅ 규칙 추가:', rule.name);
    }
  }

  /**
   * 규칙 제거
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    
    if (this.config.debugMode) {
      console.log(removed ? '✅ 규칙 제거:' : '⚠️ 규칙 없음:', ruleId);
    }
    
    return removed;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<CriticConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.debugMode) {
      console.log('✅ Critic 설정 업데이트:', this.config);
    }
  }

  // Private 헬퍼 메서드들

  private selectPrimaryIssue(issues: CriticResult[]): CriticResult {
    // 1. needsRetry가 true인 것 우선
    const retryableIssues = issues.filter(issue => issue.needsRetry);
    if (retryableIssues.length > 0) {
      return retryableIssues.reduce((primary, current) => 
        (current.confidence || 0) > (primary.confidence || 0) ? current : primary
      );
    }

    // 2. 가장 신뢰도가 높은 이슈 선택
    return issues.reduce((primary, current) => 
      (current.confidence || 0) > (primary.confidence || 0) ? current : primary
    );
  }

  private calculateOverallConfidence(results: CriticResult[]): number {
    if (results.length === 0) return 1.0;

    const totalConfidence = results.reduce((sum, result) => sum + (result.confidence || 0), 0);
    return totalConfidence / results.length;
  }

  private determineRetryStrategy(validationResult: CriticResult, context: CriticContext): Partial<CriticResult> {
    const { issueType } = validationResult;

    switch (issueType) {
      case 'no_results':
        return this.handleNoResultsRetry(context);
      
      case 'insufficient':
        return this.handleInsufficientDataRetry(context);
      
      default:
        return {
          recommendedAction: 'continue',
          needsRetry: false
        };
    }
  }

  private handleNoResultsRetry(context: CriticContext): Partial<CriticResult> {
    const { currentSlots, sessionMetadata } = context;

    // 1. 기간 확장 시도
    if (this.config.enablePeriodExtension && 
        currentSlots.period && 
        !sessionMetadata?.periodExtended) {
      
      const extendedPeriod = PERIOD_EXTENSION_MAP[currentSlots.period];
      if (extendedPeriod) {
        return {
          recommendedAction: 'expand_period',
          needsRetry: true,
          adjustedSlots: { period: extendedPeriod },
          userMessage: `${currentSlots.period}에서 ${extendedPeriod}로 기간을 확장하여 다시 검색해보겠습니다.`
        };
      }
    }

    // 2. 조건 완화 시도
    if (this.config.enableConditionRelaxation && 
        !sessionMetadata?.conditionsRelaxed) {
      
      const relaxedSlots: Partial<ConversationSlots> = {};
      let relaxationMessage = '검색 조건을 완화하여 다시 찾아보겠습니다.';

      if (currentSlots.area) {
        relaxedSlots.area = undefined;
        relaxationMessage = '면적 조건을 제외하고 다시 검색해보겠습니다.';
      }

      if (Object.keys(relaxedSlots).length > 0) {
        return {
          recommendedAction: 'relax_conditions',
          needsRetry: true,
          adjustedSlots: relaxedSlots,
          userMessage: relaxationMessage
        };
      }
    }

    // 3. 대안 제시
    return {
      recommendedAction: 'suggest_alternative',
      needsRetry: false,
      userMessage: '요청하신 조건으로는 결과를 찾을 수 없습니다. 다른 아파트나 지역을 시도해보시겠어요?'
    };
  }

  private handleInsufficientDataRetry(context: CriticContext): Partial<CriticResult> {
    const { currentSlots, sessionMetadata } = context;

    // 기간 확장으로 데이터 확보 시도
    if (this.config.enablePeriodExtension && 
        currentSlots.period && 
        !sessionMetadata?.periodExtended) {
      
      const extendedPeriod = PERIOD_EXTENSION_MAP[currentSlots.period];
      if (extendedPeriod) {
        return {
          recommendedAction: 'expand_period',
          needsRetry: true,
          adjustedSlots: { period: extendedPeriod },
          userMessage: `더 정확한 분석을 위해 ${extendedPeriod}로 기간을 확장하여 검색해보겠습니다.`
        };
      }
    }

    // 현재 데이터로 제한적 분석 제공
    return {
      recommendedAction: 'provide_context',
      needsRetry: false,
      userMessage: '데이터가 제한적이지만 현재 정보로 분석을 제공해드리겠습니다.'
    };
  }
}

/**
 * 기본 Critic 체크리스트 인스턴스
 */
export const defaultCriticChecklist = new CriticChecklist();

/**
 * 빠른 검증을 위한 헬퍼 함수
 */
export async function quickValidate(
  actionResults: any[], 
  currentSlots: ConversationSlots,
  options: { 
    enableDebug?: boolean;
    maxRetries?: number;
  } = {}
): Promise<CriticResult> {
  const checklist = new CriticChecklist({
    debugMode: options.enableDebug || false,
    maxRetries: options.maxRetries || 2
  });

  const context: CriticContext = {
    currentSlots,
    actionResults: actionResults.map((data, index) => ({
      actionId: `quick_${index}`,
      actionType: 'search',
      data,
      success: true,
      executedAt: new Date()
    }))
  };

  return await checklist.validateResults(context);
}