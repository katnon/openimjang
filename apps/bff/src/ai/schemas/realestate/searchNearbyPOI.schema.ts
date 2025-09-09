import { ToolSchema } from '../../tools/types';

export const searchNearbyPOISchema: ToolSchema = {
  name: "searchNearbyPOI",
  description: "특정 위치 주변의 POI(관심지점)를 검색합니다. 학교, 병원, 마트, 지하철역 등을 찾을 수 있습니다.",
  parameters: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "위도 (현재 아파트 위치를 사용하려면 생략 가능)"
      },
      lng: {
        type: "number", 
        description: "경도 (현재 아파트 위치를 사용하려면 생략 가능)"
      },
      poiType: {
        type: "string",
        enum: ["학교", "병원", "마트", "지하철", "버스정류장", "공원", "편의점", "은행", "전체"],
        description: "검색할 POI 유형"
      },
      radius: {
        type: "number",
        description: "검색 반경 (미터, 기본값: 1000)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;