/**
 * 캐시 설정 - 함수별 TTL 및 캐시 정책
 */

// 캐시 TTL 설정 (밀리초)
export const CACHE_TTL = {
  // 지리 정보 - 변경이 거의 없으므로 긴 캐시
  'geocodeAddress': 24 * 60 * 60 * 1000,           // 24시간
  'reverseGeocode': 24 * 60 * 60 * 1000,           // 24시간
  'lookupLegalDongCode': 24 * 60 * 60 * 1000,      // 24시간
  'convertDongCode': 24 * 60 * 60 * 1000,          // 24시간
  'transformCoordinates': 24 * 60 * 60 * 1000,     // 24시간
  'normalizeKoreanAddress': 24 * 60 * 60 * 1000,   // 24시간
  
  // 실거래 가격 동향 - 하루에 한 번 업데이트
  'getPriceTrends': 60 * 60 * 1000,                // 1시간
  'getDealStatsSummary': 60 * 60 * 1000,           // 1시간
  'getDealDistribution': 60 * 60 * 1000,           // 1시간
  'getLatestTrade': 30 * 60 * 1000,                // 30분
  
  // 실시간성이 중요한 검색 - 짧은 캐시
  'searchRealEstateDeals': 5 * 60 * 1000,          // 5분
  'getNearbyByCoords': 10 * 60 * 1000,             // 10분
  'isochroneSearch': 15 * 60 * 1000,               // 15분
  
  // 건물 정보 - 중간 캐시
  'getBuildingInfo': 2 * 60 * 60 * 1000,           // 2시간
  'searchNearbyPOI': 30 * 60 * 1000,               // 30분
  'compareMultipleApartments': 15 * 60 * 1000,     // 15분
  'findSimilarApartments': 15 * 60 * 1000,         // 15분
  'getComparableSales': 30 * 60 * 1000,            // 30분
  'estimateRentYield': 30 * 60 * 1000,             // 30분
  
  // 기본값
  'default': 5 * 60 * 1000                         // 기본 5분
} as const;

// 캐시 키 카테고리별 설정
export const CACHE_CATEGORIES = {
  geo: ['geocodeAddress', 'reverseGeocode', 'lookupLegalDongCode', 'convertDongCode', 'transformCoordinates', 'normalizeKoreanAddress'],
  price: ['getPriceTrends', 'getDealStatsSummary', 'getDealDistribution', 'getLatestTrade'],
  search: ['searchRealEstateDeals', 'getNearbyByCoords', 'isochroneSearch'],
  building: ['getBuildingInfo', 'searchNearbyPOI'],
  analysis: ['compareMultipleApartments', 'findSimilarApartments', 'getComparableSales', 'estimateRentYield']
} as const;

// 캐시하지 않을 함수 목록 (실시간성 필수)
export const NO_CACHE_FUNCTIONS = [
  // 예: 실시간 알림, 사용자별 설정 등
] as const;

// 캐시 설정 헬퍼
export function getCacheTTL(functionName: string): number {
  return CACHE_TTL[functionName as keyof typeof CACHE_TTL] || CACHE_TTL.default;
}

export function shouldCache(functionName: string): boolean {
  return !NO_CACHE_FUNCTIONS.includes(functionName as any);
}

export function getCacheCategory(functionName: string): string | null {
  for (const [category, functions] of Object.entries(CACHE_CATEGORIES)) {
    if (functions.includes(functionName as any)) {
      return category;
    }
  }
  return null;
}

// 환경별 캐시 설정
export const CACHE_CONFIG = {
  // 개발환경에서는 더 짧은 TTL
  development: {
    multiplier: 0.1, // 10%로 단축
    minTTL: 10 * 1000, // 최소 10초
    maxTTL: 5 * 60 * 1000 // 최대 5분
  },
  
  // 프로덕션 환경
  production: {
    multiplier: 1.0,
    minTTL: 60 * 1000, // 최소 1분
    maxTTL: 24 * 60 * 60 * 1000 // 최대 24시간
  }
} as const;

export function getEnvCacheTTL(functionName: string): number {
  const baseTTL = getCacheTTL(functionName);
  const env = process.env.NODE_ENV || 'development';
  const config = CACHE_CONFIG[env as keyof typeof CACHE_CONFIG] || CACHE_CONFIG.development;
  
  const adjustedTTL = baseTTL * config.multiplier;
  return Math.min(Math.max(adjustedTTL, config.minTTL), config.maxTTL);
}