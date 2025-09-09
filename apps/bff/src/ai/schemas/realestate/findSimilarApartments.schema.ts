import { ToolSchema } from '../../tools/types';

export const findSimilarApartmentsSchema: ToolSchema = {
  name: "findSimilarApartments",
  description: "특정 아파트와 유사한 조건의 다른 아파트를 추천합니다. 면적, 가격대, 위치, 건축년도 등을 고려합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "기준이 되는 아파트 ID (현재 아파트를 사용하려면 생략 가능)"
      },
      priceRange: {
        type: "number",
        description: "가격 범위 허용 오차 (%, 기본값: 20)"
      },
      areaRange: {
        type: "number", 
        description: "면적 범위 허용 오차 (%, 기본값: 15)"
      },
      distanceKm: {
        type: "number",
        description: "검색할 거리 반경 (km, 기본값: 5)"
      },
      maxResults: {
        type: "number",
        description: "최대 결과 개수 (기본값: 5)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;