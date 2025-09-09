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
  getDealStatsSummary: async () => {
    throw new Error('getDealStatsSummary: 아직 구현되지 않았습니다.');
  },
  getDealDistribution: async () => {
    throw new Error('getDealDistribution: 아직 구현되지 않았습니다.');
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
  // geo 함수들 (모두 스텁)
  geocodeAddress: async () => {
    throw new Error('geocodeAddress: 아직 구현되지 않았습니다.');
  },
  reverseGeocode: async () => {
    throw new Error('reverseGeocode: 아직 구현되지 않았습니다.');
  },
  lookupLegalDongCode: async () => {
    throw new Error('lookupLegalDongCode: 아직 구현되지 않았습니다.');
  },
  convertDongCode: async () => {
    throw new Error('convertDongCode: 아직 구현되지 않았습니다.');
  },
  getNearbyByCoords: async () => {
    throw new Error('getNearbyByCoords: 아직 구현되지 않았습니다.');
  },
  isochroneSearch: async () => {
    throw new Error('isochroneSearch: 아직 구현되지 않았습니다.');
  },
  transformCoordinates: async () => {
    throw new Error('transformCoordinates: 아직 구현되지 않았습니다.');
  },
  normalizeKoreanAddress: async () => {
    throw new Error('normalizeKoreanAddress: 아직 구현되지 않았습니다.');
  }
};