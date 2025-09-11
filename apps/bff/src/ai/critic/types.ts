// apps/bff/src/ai/critic/types.ts
// Critic 체크리스트 시스템의 핵심 타입들

import { ConversationSlots } from '../types/slots';
import { ActionResult } from '../planner/types';

/**
 * Critic 검증 이슈 유형
 */
export type CriticIssueType = 
  | 'no_results'        // 결과 없음
  | 'inconsistent'      // 이전 맥락과 모순
  | 'insufficient'      // 데이터 부족
  | 'anomaly'           // 이상치 감지
  | 'quality'           // 품질 문제
  | 'context_mismatch'; // 컨텍스트 불일치

/**
 * Critic 조치 유형
 */
export type CriticAction = 
  | 'retry'             // 재시도 (조건 조정)
  | 'expand_period'     // 기간 확장
  | 'relax_conditions'  // 조건 완화
  | 'suggest_alternative' // 대안 제시
  | 'provide_context'   // 맥락 설명
  | 'terminate'         // 종료 (안내 메시지와 함께)
  | 'continue';         // 그대로 진행

/**
 * Critic 검증 결과
 */
export interface CriticResult {
  /** 이슈가 발견되었는지 여부 */
  hasIssue: boolean;
  /** 발견된 이슈 유형 */
  issueType?: CriticIssueType;
  /** 권장 조치 */
  recommendedAction?: CriticAction;
  /** 재시도가 필요한지 여부 */
  needsRetry: boolean;
  /** 조정된 슬롯 (재시도 시 사용) */
  adjustedSlots?: Partial<ConversationSlots>;
  /** 사용자에게 전달할 메시지 */
  userMessage?: string;
  /** 내부 설명 (디버깅용) */
  explanation?: string;
  /** 신뢰도 점수 (0-1) */
  confidence: number;
}

/**
 * Critic 검증 컨텍스트
 */
export interface CriticContext {
  /** 현재 슬롯 상태 */
  currentSlots: ConversationSlots;
  /** 이전 슬롯 상태 (모순 감지용) */
  previousSlots?: ConversationSlots;
  /** 이전 결과 요약 */
  previousResults?: any[];
  /** 현재 액션 결과들 */
  actionResults: ActionResult[];
  /** 사용자 프로필 */
  userProfile?: any;
  /** 세션 메타데이터 */
  sessionMetadata?: {
    periodExtended?: boolean;
    conditionsRelaxed?: boolean;
    retryCount?: number;
    lastResultCount?: number;
  };
}

/**
 * 데이터 품질 메트릭
 */
export interface DataQualityMetrics {
  /** 총 결과 수 */
  totalCount: number;
  /** 유효한 데이터 비율 */
  validDataRatio: number;
  /** 시간 범위 커버리지 */
  timeRangeCoverage: number;
  /** 가격 데이터 일관성 */
  priceConsistency: number;
  /** 이상치 비율 */
  outlierRatio: number;
}

/**
 * 기간 확장 규칙
 */
export interface PeriodExtensionRule {
  /** 현재 기간 */
  currentPeriod: string;
  /** 확장된 기간 */
  extendedPeriod: string;
  /** 확장 비율 */
  extensionRatio: number;
  /** 최대 확장 가능 횟수 */
  maxExtensions: number;
}

/**
 * Critic 체크리스트 규칙
 */
export interface CriticRule {
  /** 규칙 ID */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 규칙 설명 */
  description: string;
  /** 적용 조건 */
  condition: (context: CriticContext) => boolean;
  /** 검증 로직 */
  check: (context: CriticContext) => CriticResult;
  /** 우선순위 (낮을수록 먼저 실행) */
  priority: number;
  /** 활성화 여부 */
  enabled: boolean;
}

/**
 * Critic 설정
 */
export interface CriticConfig {
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 기간 확장 활성화 */
  enablePeriodExtension: boolean;
  /** 조건 완화 활성화 */
  enableConditionRelaxation: boolean;
  /** 이상치 감지 임계값 */
  anomalyThreshold: number;
  /** 디버그 모드 */
  debugMode: boolean;
  /** 품질 검사 활성화 */
  enableQualityCheck: boolean;
}

/**
 * 기본 Critic 설정
 */
export const DEFAULT_CRITIC_CONFIG: CriticConfig = {
  maxRetries: 2,
  enablePeriodExtension: true,
  enableConditionRelaxation: true,
  anomalyThreshold: 0.1,
  debugMode: false,
  enableQualityCheck: true
};

/**
 * 기간 확장 매핑
 */
export const PERIOD_EXTENSION_MAP: Record<string, string> = {
  '3개월': '6개월',
  '6개월': '1년',
  '1년': '2년',
  '2년': '3년'
};

/**
 * 최소 데이터 요구사항
 */
export const MIN_DATA_REQUIREMENTS = {
  /** 차트 생성을 위한 최소 데이터 포인트 */
  chartMinPoints: 3,
  /** 통계 분석을 위한 최소 샘플 */
  statisticsMinSamples: 5,
  /** 트렌드 분석을 위한 최소 기간 */
  trendMinPeriodDays: 30
};

/**
 * Critic 체크리스트 인터페이스
 */
export interface ICriticChecklist {
  /**
   * 액션 결과를 검증합니다
   */
  validateResults(context: CriticContext): Promise<CriticResult>;
  
  /**
   * 특정 규칙을 실행합니다
   */
  executeRule(ruleId: string, context: CriticContext): Promise<CriticResult>;
  
  /**
   * 모든 활성화된 규칙을 실행합니다
   */
  runAllChecks(context: CriticContext): Promise<CriticResult[]>;
  
  /**
   * 재시도 권장사항을 생성합니다
   */
  generateRetryRecommendation(context: CriticContext): Promise<CriticResult>;
}

/**
 * 세션 히스토리 항목
 */
export interface SessionHistoryItem {
  /** 타임스탬프 */
  timestamp: Date;
  /** 질문 */
  question: string;
  /** 사용된 슬롯 */
  slots: ConversationSlots;
  /** 결과 개수 */
  resultCount: number;
  /** 성공 여부 */
  success: boolean;
  /** 액션 타입들 */
  actionTypes: string[];
}