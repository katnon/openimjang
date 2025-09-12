// AI 함수 핸들러 집계

// 기존 함수 핸들러들 (ai.ts에서 이관 필요)
export { searchRealEstateDeals } from './searchRealEstateDeals';
export { getBuildingInfo } from './getBuildingInfo';
export { searchNearbyPOI } from './searchNearbyPOI';
export { compareMultipleApartments } from './compareMultipleApartments';
export { findSimilarApartments } from './findSimilarApartments';

// 신규 realestate 함수 핸들러들 (구현 필요)
export { getLatestTrade } from './getLatestTrade';
export { getPriceTrends } from './getPriceTrends';
export { getDealStatsSummary } from './getDealStatsSummary';
export { getDealDistribution } from './getDealDistribution';

// 메모 시스템 함수 핸들러들
export { getUserMemos } from './memo/getUserMemos';

// 카카오 API 함수 핸들러들 제거 (searchNearbyPOI만 사용)
// export { searchPlaces } from './kakao/searchPlaces';

// 핸들러 맵
import { ToolHandlers } from '../tools/types';

export const handlers: ToolHandlers = {
  // 기존 함수들
  searchRealEstateDeals: async (args) => {
    const { searchRealEstateDeals } = await import('./searchRealEstateDeals');
    return searchRealEstateDeals(args);
  },
  getBuildingInfo: async (args) => {
    const { getBuildingInfo } = await import('./getBuildingInfo');
    return getBuildingInfo(args);
  },
  searchNearbyPOI: async (args) => {
    const { searchNearbyPOI } = await import('./searchNearbyPOI');
    return searchNearbyPOI(args);
  },
  compareMultipleApartments: async (args) => {
    const { compareMultipleApartments } = await import('./compareMultipleApartments');
    return compareMultipleApartments(args);
  },
  findSimilarApartments: async (args) => {
    const { findSimilarApartments } = await import('./findSimilarApartments');
    return findSimilarApartments(args);
  },
  // 신규 함수들
  getLatestTrade: async (args) => {
    const { getLatestTrade } = await import('./getLatestTrade');
    return getLatestTrade(args);
  },
  getPriceTrends: async (args) => {
    const { getPriceTrends } = await import('./getPriceTrends');
    return getPriceTrends(args);
  },
  getDealStatsSummary: async (args) => {
    const { getDealStatsSummary } = await import('./getDealStatsSummary');
    return getDealStatsSummary(args);
  },
  getDealDistribution: async (args) => {
    const { getDealDistribution } = await import('./getDealDistribution');
    return getDealDistribution(args);
  },
  searchDealsByFilters: async () => {
    throw new Error('searchDealsByFilters: 아직 구현되지 않았습니다.');
  },
  getComparableSales: async () => {
    throw new Error('getComparableSales: 아직 구현되지 않았습니다.');
  },
  estimateRentYield: async () => {
    throw new Error('estimateRentYield: 아직 구현되지 않았습니다.');
  },
  // geo 함수들 (구현 완료)
  geocodeAddress: async (args) => {
    const { geocodeAddress } = await import('./geo/geocodeAddress');
    return geocodeAddress(args);
  },
  reverseGeocode: async (args) => {
    const { reverseGeocode } = await import('./geo/reverseGeocode');
    return reverseGeocode(args);
  },
  lookupLegalDongCode: async (args) => {
    const { lookupLegalDongCode } = await import('./geo/lookupLegalDongCode');
    return lookupLegalDongCode(args);
  },
  convertDongCode: async (args) => {
    const { convertDongCode } = await import('./geo/convertDongCode');
    return convertDongCode(args);
  },
  getNearbyByCoords: async (args) => {
    const { getNearbyByCoords } = await import('./geo/getNearbyByCoords');
    return getNearbyByCoords(args);
  },
  isochroneSearch: async (args) => {
    const { isochroneSearch } = await import('./geo/isochroneSearch');
    return isochroneSearch(args);
  },
  transformCoordinates: async (args) => {
    const { transformCoordinates } = await import('./geo/transformCoordinates');
    return transformCoordinates(args);
  },
  normalizeKoreanAddress: async (args) => {
    const { normalizeKoreanAddress } = await import('./geo/normalizeKoreanAddress');
    return normalizeKoreanAddress(args);
  },
  
  // 신규 RAG + Function Calling 통합 함수들
  generateSelectQuery: async (args) => {
    const { generateSelectQuery } = await import('./database/generateSelectQuery');
    return generateSelectQuery(args);
  },
  executeQuery: async (args) => {
    const { executeQuery } = await import('./database/executeQuery');
    return executeQuery(args);
  },
  displayOnMap: async (args) => {
    const { displayOnMap } = await import('./visualization/displayOnMap');
    return displayOnMap(args);
  },
  
  // 메모 시스템 함수들
  getUserMemos: async (args) => {
    const { getUserMemos } = await import('./memo/getUserMemos');
    return getUserMemos(args);
  },
  
  // 카카오 API 함수들 제거 (searchNearbyPOI만 사용)
  // searchPlaces: async (args) => {
  //   const { searchPlaces } = await import('./kakao/searchPlaces');
  //   return searchPlaces(args);
  // }
};