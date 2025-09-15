// apps/bff/src/ai/planner/types.ts
// 플래너 시스템의 핵심 타입과 인터페이스 정의

import { ConversationSlots, UserProfile } from '../types/slots';

/**
 * 플랜 액션 유형 (RAG 제거됨)
 */
export type ActionType = 
  | 'clarify'           // 사용자에게 추가 정보 요청
  | 'validate'          // 입력된 정보 검증
  // | 'rag'              // 외부 지식 검색 (RAG) - 제거됨: 의미 없는 벡터 검색 대신 DB 데이터 활용
  | 'generateSQL'      // SQL 쿼리 생성
  | 'executeSQL'       // SQL 쿼리 실행
  | 'searchRealEstate' // 부동산 데이터 검색
  | 'searchPOI'        // 주변 시설 정보 검색
  | 'calculateStats'   // 통계 분석 수행
  | 'visualize'        // 데이터 시각화
  | 'summarize'        // 결과 요약 및 답변 생성
  | 'recommend'        // 추천 및 인사이트 제공
  | 'compare'          // 비교 분석
  | 'monitor';         // 모니터링 및 알림

/**
 * 플랜 액션 우선순위
 */
export enum ActionPriority {
  CRITICAL = 1,    // 반드시 먼저 처리 (예: clarify)
  HIGH = 2,        // 높은 우선순위
  MEDIUM = 3,      // 보통 우선순위
  LOW = 4          // 낮은 우선순위
}

/**
 * 플랜 액션 정의
 */
export interface PlanAction {
  id: string;                    // 액션 고유 ID
  type: ActionType;             // 액션 유형
  name: string;                 // 액션 이름
  description: string;          // 액션 설명
  reason: string;               // 이 액션이 필요한 이유
  priority: ActionPriority;     // 우선순위
  parameters?: Record<string, any>; // 액션 실행에 필요한 매개변수
  dependencies?: string[];       // 선행 조건이 되는 액션 ID들
  conditions?: ActionCondition[]; // 실행 조건
  timeout?: number;             // 실행 제한 시간 (ms)
  retryable?: boolean;          // 실패 시 재시도 가능 여부
}

/**
 * 액션 실행 조건
 */
export interface ActionCondition {
  type: 'slot_required' | 'slot_empty' | 'data_available' | 'custom';
  field?: keyof ConversationSlots;  // 슬롯 필드명
  value?: any;                      // 조건 값
  customCheck?: (context: PlanContext) => boolean; // 커스텀 조건 함수
}

/**
 * 플랜 전체
 */
export interface ExecutionPlan {
  id: string;                   // 플랜 고유 ID
  actions: PlanAction[];        // 실행할 액션 목록
  totalSteps: number;           // 전체 단계 수
  estimatedDuration: number;    // 예상 실행 시간 (ms)
  createdAt: Date;             // 생성 시간
  strategy: PlanStrategy;       // 플랜 전략
}

/**
 * 플랜 전략
 */
export type PlanStrategy = 
  | 'sequential'     // 순차 실행 (기본값)
  | 'parallel'       // 병렬 실행 가능한 것들은 병렬로
  | 'adaptive'       // 상황에 따라 적응적으로
  | 'minimal';       // 최소한의 액션만 수행

/**
 * 플랜 컨텍스트 (플래너가 참조하는 전체 상황)
 */
export interface PlanContext {
  question: string;             // 사용자 질문
  intent: QuestionIntent;       // 질문 의도
  slots: ConversationSlots;     // 현재 슬롯 상태
  userProfile?: UserProfile;    // 사용자 프로필
  sessionHistory: SessionContext; // 세션 기록
  capabilities: SystemCapabilities; // 시스템 기능
  constraints: PlanConstraints; // 제약 조건
}

/**
 * 질문 의도 분류
 */
export interface QuestionIntent {
  category: 'search' | 'analysis' | 'comparison' | 'recommendation' | 'general' | 'clarification';
  subcategory?: string;         // 세부 분류 (예: price_search, trend_analysis)
  confidence: number;           // 의도 분류 신뢰도 (0-1)
  entities: ExtractedEntity[];  // 추출된 개체
  actions: string[];           // 암시된 액션들
}

/**
 * 추출된 개체
 */
export interface ExtractedEntity {
  type: 'apartment' | 'region' | 'area' | 'price' | 'time' | 'deal_type';
  value: string;
  confidence: number;
  position: [number, number]; // 텍스트 내 위치
}

/**
 * 세션 컨텍스트
 */
export interface SessionContext {
  messageCount: number;         // 총 메시지 수
  lastQuestionTypes: string[];  // 최근 질문 유형들
  completedActions: string[];   // 완료된 액션들
  failedActions: string[];      // 실패한 액션들
  userSatisfaction?: number;    // 사용자 만족도 추정
}

/**
 * 시스템 기능
 */
export interface SystemCapabilities {
  availableTools: string[];     // 사용 가능한 도구들
  dataAccess: {
    realEstate: boolean;
    POI: boolean;
    market: boolean;
    geographic: boolean;
  };
  analysisFeatures: {
    statistics: boolean;
    visualization: boolean;
    prediction: boolean;
    comparison: boolean;
  };
  externalServices: {
    webSearch: boolean;
    maps: boolean;
    weather: boolean;
  };
}

/**
 * 플랜 제약 조건
 */
export interface PlanConstraints {
  maxActions: number;           // 최대 액션 수
  maxDuration: number;          // 최대 실행 시간 (ms)
  budgetLimits?: {
    apiCalls: number;
    computeTime: number;
  };
  userPermissions: string[];    // 사용자 권한
  rateLimit?: {
    actionsPerMinute: number;
    dataQueryLimit: number;
  };
}

/**
 * 액션 실행 결과
 */
export interface ActionResult {
  actionId: string;
  success: boolean;
  executionTime: number;        // 실행 시간 (ms)
  data?: any;                   // 실행 결과 데이터
  error?: string;               // 오류 메시지
  metadata?: {
    rowsProcessed?: number;
    apiCallsUsed?: number;
    confidence?: number;
  };
}

/**
 * 플랜 실행 상태
 */
export interface PlanExecution {
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentActionIndex?: number;
  startedAt: Date;
  completedAt?: Date;
  results: ActionResult[];
  totalDuration?: number;
  errorCount?: number;
  error?: string;
  context: PlanContext;
  criticResult?: any;           // Critic 검증 결과
  retryRecommendation?: any;    // 재시도 권장사항
}

/**
 * 플래너 설정
 */
export interface PlannerConfig {
  strategy: PlanStrategy;
  maxRetries: number;
  timeoutMs: number;
  enableParallelExecution: boolean;
  clarifyThreshold: number;     // Clarify 트리거 임계값
  confidenceThreshold: number; // 실행 신뢰도 임계값
  debugMode: boolean;
}

/**
 * 기본 플래너 설정
 */
export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  strategy: 'sequential',
  maxRetries: 2,
  timeoutMs: 30000,
  enableParallelExecution: false,
  clarifyThreshold: 0.7,
  confidenceThreshold: 0.6,
  debugMode: process.env.NODE_ENV === 'development'
};

/**
 * 플래너 인터페이스
 */
export interface IPlanner {
  /**
   * 주어진 컨텍스트에 대한 실행 플랜을 생성합니다
   */
  createPlan(context: PlanContext): Promise<ExecutionPlan>;
  
  /**
   * 플랜을 실행합니다
   */
  executePlan(plan: ExecutionPlan, context: PlanContext): Promise<PlanExecution>;
  
  /**
   * 실행 중인 플랜을 중단합니다
   */
  cancelPlan(planId: string): Promise<boolean>;
  
  /**
   * 플랜 실행 상태를 조회합니다
   */
  getPlanStatus(planId: string): Promise<PlanExecution | null>;
}