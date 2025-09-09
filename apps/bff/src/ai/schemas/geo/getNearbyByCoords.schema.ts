import { ToolSchema } from '../../tools/types';

export const getNearbyByCoordsSchema: ToolSchema = {
  name: "getNearbyByCoords",
  description: "특정 좌표 주변의 POI나 부동산을 검색합니다. 반경 내 아파트, 상가, 학교 등을 찾을 수 있습니다.",
  parameters: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "중심점 위도"
      },
      lng: {
        type: "number",
        description: "중심점 경도"
      },
      radius: {
        type: "number",
        description: "검색 반경 (미터, 기본값: 1000)"
      },
      searchType: {
        type: "string",
        enum: ["아파트", "상가", "학교", "병원", "지하철", "버스정류장", "전체"],
        description: "검색할 시설 유형 (기본값: 전체)"
      },
      maxResults: {
        type: "number",
        description: "최대 결과 개수 (기본값: 50)"
      }
    },
    required: ["lat", "lng"],
    additionalProperties: false
  },
  strict: true
} as const;