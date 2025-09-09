// AI Tools 집계 및 export

import { OpenAITool } from './types';

// 기존 함수 스키마 import
import { searchRealEstateDealsSchema } from '../schemas/realestate/searchRealEstateDeals.schema';
import { getBuildingInfoSchema } from '../schemas/realestate/getBuildingInfo.schema';
import { searchNearbyPOISchema } from '../schemas/realestate/searchNearbyPOI.schema';
import { compareMultipleApartmentsSchema } from '../schemas/realestate/compareMultipleApartments.schema';
import { findSimilarApartmentsSchema } from '../schemas/realestate/findSimilarApartments.schema';

// 신규 realestate 스키마 import
import { getLatestTradeSchema } from '../schemas/realestate/getLatestTrade.schema';
import { getPriceTrendsSchema } from '../schemas/realestate/getPriceTrends.schema';
import { getDealStatsSummarySchema } from '../schemas/realestate/getDealStatsSummary.schema';
import { getDealDistributionSchema } from '../schemas/realestate/getDealDistribution.schema';
import { searchDealsByFiltersSchema } from '../schemas/realestate/searchDealsByFilters.schema';
import { getComparableSalesSchema } from '../schemas/realestate/getComparableSales.schema';
import { estimateRentYieldSchema } from '../schemas/realestate/estimateRentYield.schema';

// geo 스키마 import
import { geocodeAddressSchema } from '../schemas/geo/geocodeAddress.schema';
import { reverseGeocodeSchema } from '../schemas/geo/reverseGeocode.schema';
import { lookupLegalDongCodeSchema } from '../schemas/geo/lookupLegalDongCode.schema';
import { convertDongCodeSchema } from '../schemas/geo/convertDongCode.schema';
import { getNearbyByCoordsSchema } from '../schemas/geo/getNearbyByCoords.schema';
import { isochroneSearchSchema } from '../schemas/geo/isochroneSearch.schema';
import { transformCoordinatesSchema } from '../schemas/geo/transformCoordinates.schema';
import { normalizeKoreanAddressSchema } from '../schemas/geo/normalizeKoreanAddress.schema';

// 모든 스키마를 OpenAI Tool 형식으로 변환
const createTool = (schema: any): OpenAITool => ({
  type: "function",
  function: schema
});

// Tools 배열 생성
export const tools: OpenAITool[] = [
  // 기존 함수들
  createTool(searchRealEstateDealsSchema),
  createTool(getBuildingInfoSchema),
  createTool(searchNearbyPOISchema),
  createTool(compareMultipleApartmentsSchema),
  createTool(findSimilarApartmentsSchema),
  
  // 신규 realestate 함수들
  createTool(getLatestTradeSchema),
  createTool(getPriceTrendsSchema),
  createTool(getDealStatsSummarySchema),
  createTool(getDealDistributionSchema),
  createTool(searchDealsByFiltersSchema),
  createTool(getComparableSalesSchema),
  createTool(estimateRentYieldSchema),
  
  // geo 함수들
  createTool(geocodeAddressSchema),
  createTool(reverseGeocodeSchema),
  createTool(lookupLegalDongCodeSchema),
  createTool(convertDongCodeSchema),
  createTool(getNearbyByCoordsSchema),
  createTool(isochroneSearchSchema),
  createTool(transformCoordinatesSchema),
  createTool(normalizeKoreanAddressSchema)
];

// 중복 이름 검사
const toolNames = tools.map(tool => tool.function.name);
const duplicates = toolNames.filter((name, index) => toolNames.indexOf(name) !== index);
if (duplicates.length > 0) {
  throw new Error(`중복된 함수 이름이 발견되었습니다: ${duplicates.join(', ')}`);
}

console.log(`✅ AI Tools 로드 완료: ${tools.length}개 함수`);

// 디버깅용 함수 목록 출력
export const getToolsList = () => tools.map(tool => tool.function.name);