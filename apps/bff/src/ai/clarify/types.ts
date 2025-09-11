// apps/bff/src/ai/clarify/types.ts
// Clarify 정책 시스템의 핵심 타입들

import { ConversationSlots } from '../types/slots';

/**
 * Clarify가 필요한 상황 유형
 */
export type ClarifyReason = 
  | 'missing'          // 값이 아예 없음
  | 'partial'          // 부분적인 정보만 있음
  | 'ambiguous'        // 애매하거나 여러 후보가 있음
  | 'invalid'          // 유효하지 않은 값
  | 'confirmation';    // 확인이 필요한 값

/**
 * Clarify 대상 슬롯 타입
 */
export type ClarifyableSlot = keyof ConversationSlots;

/**
 * Clarify 상황에 대한 컨텍스트 정보
 */
export interface ClarifyContext {
  /** 현재 슬롯 상태 */
  currentSlots: ConversationSlots;
  /** Clarify가 필요한 이유 */
  reason: ClarifyReason;
  /** 부분적으로 입력된 값 (있는 경우) */
  partialValue?: string;
  /** 가능한 후보들 (여러 옵션이 있는 경우) */
  candidates?: string[];
  /** 추가 컨텍스트 정보 */
  metadata?: Record<string, any>;
  /** 사용자 프로필 (개인화된 질문을 위해) */
  userProfile?: any;
}

/**
 * Clarify 질문 응답
 */
export interface ClarifyQuestion {
  /** 사용자에게 보여줄 질문 */
  question: string;
  /** 제안할 옵션들 (있는 경우) */
  suggestions?: string[];
  /** 질문의 우선순위 (1이 가장 높음) */
  priority: number;
  /** 예상 응답 타입 */
  expectedResponseType: 'text' | 'selection' | 'number' | 'boolean';
  /** 힌트 또는 예시 */
  hint?: string;
}

/**
 * 슬롯별 Clarify 템플릿 함수 타입
 */
export type ClarifyTemplate = (context: ClarifyContext) => ClarifyQuestion;

/**
 * 슬롯별 Clarify 정책 매핑
 */
export interface ClarifyPolicyMap {
  apartmentName: ClarifyTemplate;
  dealType: ClarifyTemplate;
  area: ClarifyTemplate;
  period: ClarifyTemplate;
  region: ClarifyTemplate;
  complexNumber: ClarifyTemplate;
  priceRange: ClarifyTemplate;
  areaRange: ClarifyTemplate;
}

/**
 * Clarify 질문 생성기 설정
 */
export interface ClarifyConfig {
  /** 질문 어조 설정 */
  tone: 'formal' | 'casual' | 'friendly';
  /** 최대 제안 옵션 수 */
  maxSuggestions: number;
  /** 개인화 활성화 여부 */
  enablePersonalization: boolean;
  /** 디버그 모드 */
  debugMode: boolean;
}

/**
 * 기본 Clarify 설정
 */
export const DEFAULT_CLARIFY_CONFIG: ClarifyConfig = {
  tone: 'friendly',
  maxSuggestions: 5,
  enablePersonalization: true,
  debugMode: false
};

/**
 * Clarify 응답 처리 결과
 */
export interface ClarifyResponse {
  /** 성공 여부 */
  success: boolean;
  /** 업데이트된 슬롯 정보 */
  updatedSlots?: Partial<ConversationSlots>;
  /** 추가 Clarify가 필요한지 여부 */
  needsMoreClarification?: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 아파트 후보 정보 (부분 일치 시 사용)
 */
export interface ApartmentCandidate {
  /** 아파트 ID */
  aptId: number;
  /** 정확한 아파트명 */
  aptName: string;
  /** 지역 정보 */
  region: string;
  /** 매칭 점수 */
  score: number;
  /** 단지 번호들 (여러 단지가 있는 경우) */
  complexNumbers?: string[];
}

/**
 * Clarify 정책 인터페이스
 */
export interface IClarifyPolicy {
  /**
   * 특정 슬롯에 대한 Clarify 질문 생성
   */
  generateQuestion(slot: ClarifyableSlot, context: ClarifyContext): Promise<ClarifyQuestion>;
  
  /**
   * 누락된 슬롯들을 분석하여 우선순위별 Clarify 질문 생성
   */
  analyzeMissingSlots(slots: ConversationSlots, intent?: any): Promise<ClarifyQuestion[]>;
  
  /**
   * 아파트 후보 검색 (부분 일치 처리용)
   */
  searchApartmentCandidates(partialName: string, region?: string): Promise<ApartmentCandidate[]>;
  
  /**
   * Clarify 응답 처리
   */
  processResponse(slot: ClarifyableSlot, userResponse: string, context: ClarifyContext): Promise<ClarifyResponse>;
}

/**
 * 슬롯 우선순위 매핑 (Clarify 순서 결정용)
 */
export const SLOT_PRIORITY_MAP: Record<ClarifyableSlot, number> = {
  apartmentName: 1,    // 가장 중요
  region: 2,
  dealType: 3,
  area: 4,
  complexNumber: 5,
  period: 6,
  priceRange: 7,
  areaRange: 8
};

/**
 * 의도별 필수 슬롯 매핑
 */
export const INTENT_REQUIRED_SLOTS: Record<string, ClarifyableSlot[]> = {
  'apartment_search': ['apartmentName'],
  'price_search': ['apartmentName', 'dealType'],
  'trend_analysis': ['apartmentName', 'dealType', 'period'],
  'poi_search': ['apartmentName'], // 또는 region
  'comparison': ['apartmentName'],
  'general_search': ['apartmentName', 'dealType']
};