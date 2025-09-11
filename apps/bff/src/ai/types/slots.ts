// apps/bff/src/ai/types/slots.ts
// 슬롯 기반 대화 메모리 관리를 위한 타입 정의

/**
 * 사용자 대화에서 추출되고 저장되는 핵심 정보 슬롯
 */
export interface ConversationSlots {
  // 부동산 기본 정보
  apartmentName?: string;           // "마곡엠밸리", "래미안 SKY" 등
  apartmentId?: string;             // DB에서 찾은 정확한 아파트 ID
  complexNumber?: string;           // "7단지", "3차" 등
  region?: string;                  // "강서구", "신당동" 등
  
  // 거래 조건
  dealType?: '매매' | '전세' | '월세' | '전체';
  area?: number;                    // 전용면적 (㎡)
  areaRange?: [number, number];     // 면적 범위
  priceRange?: [number, number];    // 가격 범위 (만원 단위)
  period?: string;                  // "3개월", "1년" 등
  
  // 위치 정보
  coordinates?: {
    lat: number;
    lng: number;
  };
  legalDongCode?: string;           // 법정동 코드
  
  // 아파트 메타데이터 (히든 슬롯)
  apartmentMetadata?: {
    id?: number;                    // DB ID
    address?: string;               // 지번주소
    roadAddress?: string;           // 도로명주소
    lat?: number;                   // 위도
    lon?: number;                   // 경도
    dong?: string;                  // 동
    complexCount?: number;          // 단지 수
    buildYear?: number;             // 건축년도
    extractedAt?: Date;             // 추출 시간
  };
  
  // 실거래가 정보 (히든 슬롯)
  realEstateDeals?: {
    deals: Array<{
      deal_year: number;
      deal_month: number;
      deal_day: number;
      deal_amount: number | null;
      deposit: number | null;
      monthly_rent: number | null;
      exclu_use_ar: number;
      floor: number | null;
    }>;
    areas: number[];
    loadedAt: Date;
    params: {
      area?: string;
      period: string;
      dealTypes: string[];
    };
  };
  
  // 건물/토지 정보 (히든 슬롯)
  buildingLandInfo?: {
    buildingInfo?: {
      recap_info: any;
      title_infos: any[];
      total_count: number;
    };
    landuseInfo?: {
      landuse_zones: Array<{
        code: string;
        name: string;
        status: number;
        displayText: string;
      }>;
    };
    pnuInfo?: {
      pnu: string | null;
    };
    loadedAt: Date;
  };
  
  // 주변 편의시설 정보 (히든 슬롯)
  poiInfo?: {
    pois: Array<{
      name: string;
      category: string;
      address: string;
      roadAddress?: string;
      distance: number;
      x: number;
      y: number;
      phone?: string;
      url?: string;
    }>;
    searchConditions: {
      location: { lat: number; lng: number };
      radius: number;
      poiType: string;
    };
    categoryStats: { [key: string]: number };
    totalCount: number;
    loadedAt: Date;
  };
  
  // 메타 정보
  lastUpdated?: Date;               // 마지막 업데이트 시간
  confidence?: number;              // 추출 신뢰도 (0-1)
}

/**
 * 사용자 세션별 대화 컨텍스트
 */
export interface UserSession {
  userId: string;                   // Firebase UID
  sessionId: string;                // 세션 고유 ID
  slots: ConversationSlots;         // 현재 대화의 슬롯 상태
  messageHistory: SessionMessage[]; // 최근 메시지 기록 (제한적)
  createdAt: Date;
  lastAccessedAt: Date;
  
  // 사용자 프로필 (기존 시스템과 호환)
  userProfile?: UserProfile;
}

/**
 * 세션 내 메시지 기록 (압축된 형태)
 */
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  extractedSlots?: Partial<ConversationSlots>; // 이 메시지에서 추출된 슬롯
}

/**
 * 기존 사용자 프로필 타입 (호환성 유지)
 */
export interface UserProfile {
  purpose?: string[];
  budgetRange?: [number, number];
  monthlyRent?: [number, number];
  preferredBuildingAge?: string;
  familyType?: string;
  workLocation?: string;
  commutingRadius?: number;
  priorities?: string[];
}

/**
 * 정보 추출 결과
 */
export interface ExtractionResult {
  slots: Partial<ConversationSlots>;
  confidence: number;              // 전체 추출 신뢰도
  fieldConfidence: {               // 필드별 신뢰도
    [K in keyof ConversationSlots]?: number;
  };
  references: ReferenceMatch[];    // 발견된 참조 표현
}

/**
 * 지시어/참조 표현 매칭 결과
 */
export interface ReferenceMatch {
  originalText: string;            // "그 아파트", "거기" 등
  resolvedValue: any;             // 해석된 실제 값
  fieldName: keyof ConversationSlots;
  confidence: number;
  contextSource: 'previous_slot' | 'message_history' | 'user_profile';
}

/**
 * 슬롯 업데이트 옵션
 */
export interface SlotUpdateOptions {
  mergeStrategy: 'replace' | 'merge' | 'preserve_existing';
  confidenceThreshold: number;    // 최소 신뢰도 (이하 무시)
  preserveHighConfidence: boolean; // 기존 고신뢰도 값 보호
}

/**
 * 세션 저장소 인터페이스
 */
export interface SessionStorage {
  getSession(userId: string, sessionId?: string): Promise<UserSession | null>;
  saveSession(session: UserSession): Promise<void>;
  updateSlots(userId: string, sessionId: string, slots: Partial<ConversationSlots>, options?: SlotUpdateOptions): Promise<void>;
  cleanupExpiredSessions(maxAge: number): Promise<number>; // 만료된 세션 정리
  listUserSessions(userId: string): Promise<string[]>;     // 사용자의 활성 세션 목록
}

/**
 * 슬롯 미들웨어 설정
 */
export interface SlotMiddlewareConfig {
  sessionTTL: number;              // 세션 만료 시간 (ms)
  maxMessagesInHistory: number;    // 보관할 최대 메시지 수
  confidenceThreshold: number;     // 슬롯 저장 최소 신뢰도
  enableReferenceResolution: boolean; // 지시어 해석 활성화
  debugMode: boolean;              // 디버그 로그 출력
}

/**
 * 기본 설정 값
 */
export const DEFAULT_SLOT_CONFIG: SlotMiddlewareConfig = {
  sessionTTL: 24 * 60 * 60 * 1000,  // 24시간
  maxMessagesInHistory: 10,          // 최근 10개 메시지
  confidenceThreshold: 0.3,          // 30% 이상 신뢰도
  enableReferenceResolution: true,
  debugMode: process.env.NODE_ENV === 'development'
};