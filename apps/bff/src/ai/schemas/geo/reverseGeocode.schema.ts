import { ToolSchema } from '../../tools/types';

export const reverseGeocodeSchema: ToolSchema = {
  name: "reverseGeocode",
  description: "좌표(위도, 경도)를 주소로 변환합니다. 행정구역, 도로명, 지번 주소를 제공합니다.",
  parameters: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "위도"
      },
      lng: {
        type: "number",
        description: "경도"
      },
      coordinateSystem: {
        type: "string",
        enum: ["WGS84", "GRS80", "KATEC", "TM"],
        description: "입력 좌표계 (기본값: WGS84)"
      },
      addressFormat: {
        type: "string",
        enum: ["지번", "도로명", "전체"],
        description: "출력 주소 형식 (기본값: 전체)"
      }
    },
    required: ["lat", "lng"],
    additionalProperties: false
  },
  strict: true
} as const;