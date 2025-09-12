import { ToolSchema } from '../../tools/types';

export const searchNearbyPOISchema: ToolSchema = {
  name: "searchNearbyPOI",
  description: "특정 위치 주변의 POI(관심지점)를 검색합니다. 반드시 위도/경도 좌표를 사용하여 검색해야 합니다. 아파트명으로 키워드 검색하지 마세요!",
  parameters: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "위도 (필수) - 아파트 메타데이터에서 제공된 정확한 위도값 사용"
      },
      lng: {
        type: "number", 
        description: "경도 (필수) - 아파트 메타데이터에서 제공된 정확한 경도값 사용"
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