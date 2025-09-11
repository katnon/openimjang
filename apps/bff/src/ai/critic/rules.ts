// apps/bff/src/ai/critic/rules.ts
// Critic 체크리스트 규칙 엔진 - 결과 검증 및 품질 분석

import { CriticRule, CriticContext, CriticResult, MIN_DATA_REQUIREMENTS } from './types';
import { ConversationSlots } from '../types/slots';

/**
 * 결과 없음 체크 규칙
 */
const noResultsRule: CriticRule = {
  id: 'no_results',
  name: '결과 없음 검증',
  description: '액션 실행 결과 데이터가 없는 경우를 감지합니다',
  condition: (context: CriticContext) => {
    return context.actionResults.some(result => 
      !result.data || 
      (Array.isArray(result.data) && result.data.length === 0)
    );
  },
  check: (context: CriticContext): CriticResult => {
    const emptyResults = context.actionResults.filter(result => 
      !result.data || (Array.isArray(result.data) && result.data.length === 0)
    );

    if (emptyResults.length === 0) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    // 기간 확장 가능한지 확인
    const canExtendPeriod = context.currentSlots.period && 
      context.sessionMetadata?.periodExtended !== true;

    // 조건 완화 가능한지 확인
    const canRelaxConditions = !context.sessionMetadata?.conditionsRelaxed;

    let recommendedAction: any = 'suggest_alternative';
    let adjustedSlots: Partial<ConversationSlots> = {};

    if (canExtendPeriod) {
      recommendedAction = 'expand_period';
      adjustedSlots = {
        period: extendPeriod(context.currentSlots.period!)
      };
    } else if (canRelaxConditions) {
      recommendedAction = 'relax_conditions';
      // 면적 조건 완화
      if (context.currentSlots.area) {
        adjustedSlots.area = undefined;
      }
    }

    return {
      hasIssue: true,
      issueType: 'no_results',
      recommendedAction,
      needsRetry: canExtendPeriod || canRelaxConditions,
      adjustedSlots,
      userMessage: generateNoResultsMessage(context.currentSlots, recommendedAction),
      explanation: `검색 조건에 맞는 결과가 없습니다. ${emptyResults.length}개 액션에서 빈 결과 반환`,
      confidence: 0.95
    };
  },
  priority: 1,
  enabled: true
};

/**
 * 데이터 부족 체크 규칙
 */
const insufficientDataRule: CriticRule = {
  id: 'insufficient_data',
  name: '데이터 부족 검증',
  description: '분석에 필요한 최소 데이터 요구사항을 만족하지 않는 경우를 감지합니다',
  condition: (context: CriticContext) => {
    return context.actionResults.some(result => {
      if (!result.data || !Array.isArray(result.data)) return false;
      
      // 차트나 분석이 필요한 액션인지 확인
      const needsChart = result.actionType?.includes('chart') || result.actionType?.includes('trend');
      const needsStatistics = result.actionType?.includes('analysis') || result.actionType?.includes('compare');
      
      if (needsChart && result.data.length < MIN_DATA_REQUIREMENTS.chartMinPoints) return true;
      if (needsStatistics && result.data.length < MIN_DATA_REQUIREMENTS.statisticsMinSamples) return true;
      
      return false;
    });
  },
  check: (context: CriticContext): CriticResult => {
    const insufficientResults = context.actionResults.filter(result => {
      if (!result.data || !Array.isArray(result.data)) return false;
      
      const needsChart = result.actionType?.includes('chart') || result.actionType?.includes('trend');
      const needsStatistics = result.actionType?.includes('analysis') || result.actionType?.includes('compare');
      
      if (needsChart && result.data.length < MIN_DATA_REQUIREMENTS.chartMinPoints) return true;
      if (needsStatistics && result.data.length < MIN_DATA_REQUIREMENTS.statisticsMinSamples) return true;
      
      return false;
    });

    if (insufficientResults.length === 0) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const canExtendPeriod = context.currentSlots.period && 
      context.sessionMetadata?.periodExtended !== true;

    let recommendedAction: any = canExtendPeriod ? 'expand_period' : 'provide_context';
    let adjustedSlots: Partial<ConversationSlots> = {};

    if (canExtendPeriod) {
      adjustedSlots.period = extendPeriod(context.currentSlots.period!);
    }

    const totalDataPoints = insufficientResults.reduce((sum, r) => 
      sum + (Array.isArray(r.data) ? r.data.length : 0), 0
    );

    return {
      hasIssue: true,
      issueType: 'insufficient',
      recommendedAction,
      needsRetry: canExtendPeriod,
      adjustedSlots,
      userMessage: `데이터가 부족하여 정확한 분석이 어렵습니다. ${canExtendPeriod ? '기간을 확장하여 다시 검색해보겠습니다.' : '현재 ' + totalDataPoints + '개의 데이터로 제한적인 분석을 제공해드리겠습니다.'}`,
      explanation: `총 ${insufficientResults.length}개 액션에서 데이터 부족 (평균 ${Math.round(totalDataPoints / insufficientResults.length)}개 데이터포인트)`,
      confidence: 0.9
    };
  },
  priority: 2,
  enabled: true
};

/**
 * 모순 감지 규칙
 */
const inconsistencyRule: CriticRule = {
  id: 'inconsistency_check',
  name: '일관성 검증',
  description: '이전 검색 결과와 현재 결과 간의 모순을 감지합니다',
  condition: (context: CriticContext) => {
    return context.previousSlots !== undefined && context.previousResults !== undefined;
  },
  check: (context: CriticContext): CriticResult => {
    if (!context.previousSlots || !context.previousResults) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const inconsistencies = detectInconsistencies(
      context.previousSlots, 
      context.currentSlots,
      context.previousResults,
      context.actionResults
    );

    if (inconsistencies.length === 0) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const severity = calculateInconsistencySeverity(inconsistencies);

    return {
      hasIssue: true,
      issueType: 'inconsistent',
      recommendedAction: severity > 0.7 ? 'provide_context' : 'continue',
      needsRetry: false,
      userMessage: severity > 0.7 ? 
        `이전 검색 결과와 차이가 있습니다. ${inconsistencies[0].description}` : 
        undefined,
      explanation: `${inconsistencies.length}개 일관성 이슈 감지, 심각도: ${severity.toFixed(2)}`,
      confidence: 0.8
    };
  },
  priority: 3,
  enabled: true
};

/**
 * 이상치 감지 규칙
 */
const anomalyDetectionRule: CriticRule = {
  id: 'anomaly_detection',
  name: '이상치 감지',
  description: '가격이나 거래량에서 비정상적인 패턴을 감지합니다',
  condition: (context: CriticContext) => {
    return context.actionResults.some(result => 
      result.data && Array.isArray(result.data) && result.data.length > 5
    );
  },
  check: (context: CriticContext): CriticResult => {
    let totalAnomalies = 0;
    let totalDataPoints = 0;

    for (const result of context.actionResults) {
      if (!result.data || !Array.isArray(result.data)) continue;

      const anomalies = detectPriceAnomalies(result.data);
      totalAnomalies += anomalies.length;
      totalDataPoints += result.data.length;
    }

    if (totalDataPoints === 0) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const anomalyRatio = totalAnomalies / totalDataPoints;
    const threshold = 0.1; // 10% 이상 이상치면 이슈

    if (anomalyRatio <= threshold) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    return {
      hasIssue: true,
      issueType: 'anomaly',
      recommendedAction: 'provide_context',
      needsRetry: false,
      userMessage: `데이터에서 일부 이상치가 발견되었습니다 (${(anomalyRatio * 100).toFixed(1)}%). 결과 해석 시 참고해주세요.`,
      explanation: `총 ${totalDataPoints}개 중 ${totalAnomalies}개 이상치 감지 (${(anomalyRatio * 100).toFixed(1)}%)`,
      confidence: 0.85
    };
  },
  priority: 4,
  enabled: true
};

/**
 * 컨텍스트 불일치 규칙
 */
const contextMismatchRule: CriticRule = {
  id: 'context_mismatch',
  name: '컨텍스트 일치성 검증',
  description: '사용자 의도와 검색 결과 간의 불일치를 감지합니다',
  condition: (context: CriticContext) => {
    return context.userProfile !== undefined;
  },
  check: (context: CriticContext): CriticResult => {
    if (!context.userProfile) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const mismatches = detectContextMismatches(context.currentSlots, context.userProfile, context.actionResults);
    
    if (mismatches.length === 0) {
      return { hasIssue: false, needsRetry: false, confidence: 1.0 };
    }

    const severity = mismatches.reduce((sum, m) => sum + m.severity, 0) / mismatches.length;

    return {
      hasIssue: severity > 0.5,
      issueType: 'context_mismatch',
      recommendedAction: severity > 0.7 ? 'suggest_alternative' : 'provide_context',
      needsRetry: false,
      userMessage: severity > 0.7 ? 
        `검색 결과가 회원님의 관심사와 다를 수 있습니다. ${mismatches[0].description}` : 
        undefined,
      explanation: `${mismatches.length}개 컨텍스트 불일치, 평균 심각도: ${severity.toFixed(2)}`,
      confidence: 0.75
    };
  },
  priority: 5,
  enabled: true
};

/**
 * 기본 Critic 규칙들
 */
export const defaultCriticRules: CriticRule[] = [
  noResultsRule,
  insufficientDataRule,
  inconsistencyRule,
  anomalyDetectionRule,
  contextMismatchRule
];

// 헬퍼 함수들

function extendPeriod(currentPeriod: string): string {
  const extensionMap: Record<string, string> = {
    '3개월': '6개월',
    '6개월': '1년', 
    '1년': '2년',
    '2년': '3년'
  };
  return extensionMap[currentPeriod] || '1년';
}

function generateNoResultsMessage(slots: ConversationSlots, action: string): string {
  const { apartmentName, dealType, area, period } = slots;
  
  if (action === 'expand_period') {
    return `${apartmentName}의 ${dealType} ${area ? area + '형 ' : ''}거래 정보를 ${period} 기간에서 찾을 수 없어서, 기간을 확장하여 다시 검색해보겠습니다.`;
  } else if (action === 'relax_conditions') {
    return `검색 조건을 일부 완화하여 다시 찾아보겠습니다.`;
  } else {
    return `요청하신 조건에 맞는 거래 정보를 찾을 수 없습니다. 다른 조건으로 검색해보시거나 지역을 넓혀서 찾아보시겠어요?`;
  }
}

function detectInconsistencies(
  previousSlots: ConversationSlots,
  currentSlots: ConversationSlots, 
  previousResults: any[],
  currentResults: any[]
): Array<{type: string; description: string; severity: number}> {
  const inconsistencies: Array<{type: string; description: string; severity: number}> = [];

  // 아파트명이 바뀌었는데 결과가 동일한 경우
  if (previousSlots.apartmentName !== currentSlots.apartmentName) {
    const prevCount = previousResults.reduce((sum, r) => sum + (Array.isArray(r.data) ? r.data.length : 0), 0);
    const currCount = currentResults.reduce((sum, r) => sum + (Array.isArray(r.data) ? r.data.length : 0), 0);
    
    if (Math.abs(prevCount - currCount) < 3 && prevCount > 0) {
      inconsistencies.push({
        type: 'same_results_different_apartment',
        description: '다른 아파트인데 비슷한 결과가 나왔습니다',
        severity: 0.6
      });
    }
  }

  // 더 넓은 조건인데 결과가 적은 경우
  if (!currentSlots.area && previousSlots.area) {
    const prevCount = previousResults.reduce((sum, r) => sum + (Array.isArray(r.data) ? r.data.length : 0), 0);
    const currCount = currentResults.reduce((sum, r) => sum + (Array.isArray(r.data) ? r.data.length : 0), 0);
    
    if (currCount < prevCount * 0.8) {
      inconsistencies.push({
        type: 'broader_condition_fewer_results',
        description: '조건을 넓혔는데 결과가 더 적습니다',
        severity: 0.7
      });
    }
  }

  return inconsistencies;
}

function calculateInconsistencySeverity(inconsistencies: Array<{severity: number}>): number {
  if (inconsistencies.length === 0) return 0;
  return inconsistencies.reduce((sum, inc) => sum + inc.severity, 0) / inconsistencies.length;
}

function detectPriceAnomalies(data: any[]): any[] {
  const anomalies: any[] = [];
  
  // 가격 데이터 추출
  const prices = data.map(item => {
    // deal_amount, dealAmount, price 등 다양한 필드명 대응
    return item.deal_amount || item.dealAmount || item.price || item.거래금액 || 0;
  }).filter(price => price > 0);

  if (prices.length < 5) return anomalies;

  // 중위값과 IQR 계산
  prices.sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)];
  const q3 = prices[Math.floor(prices.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // 이상치 감지
  data.forEach((item, index) => {
    const price = item.deal_amount || item.dealAmount || item.price || item.거래금액 || 0;
    if (price > 0 && (price < lowerBound || price > upperBound)) {
      anomalies.push({ index, item, price, reason: price < lowerBound ? 'too_low' : 'too_high' });
    }
  });

  return anomalies;
}

function detectContextMismatches(
  slots: ConversationSlots, 
  userProfile: any, 
  results: any[]
): Array<{type: string; description: string; severity: number}> {
  const mismatches: Array<{type: string; description: string; severity: number}> = [];

  // 예산 범위와 검색 결과 불일치
  if (userProfile.budgetRange && Array.isArray(userProfile.budgetRange) && userProfile.budgetRange.length === 2) {
    const [minBudget, maxBudget] = userProfile.budgetRange;
    
    let totalOutOfRange = 0;
    let totalItems = 0;

    results.forEach(result => {
      if (Array.isArray(result.data)) {
        result.data.forEach((item: any) => {
          const price = item.deal_amount || item.dealAmount || item.price || 0;
          totalItems++;
          if (price > 0 && (price < minBudget * 10000 || price > maxBudget * 10000)) { // 만원 단위 변환
            totalOutOfRange++;
          }
        });
      }
    });

    if (totalItems > 0 && totalOutOfRange / totalItems > 0.7) {
      mismatches.push({
        type: 'budget_mismatch',
        description: `예산 범위(${minBudget}-${maxBudget}억)와 다른 가격대가 많습니다`,
        severity: 0.8
      });
    }
  }

  return mismatches;
}