import { ToolSchema } from '../../tools/types';

export const geocodeAddressSchema: ToolSchema = {
  name: "geocodeAddress",
  description: "주소를 좌표(위도, 경도)로 변환합니다. 지번, 도로명 주소 모두 지원합니다.",
  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "변환할 주소 (지번 또는 도로명 주소)"
      },
      coordinateSystem: {
        type: "string",
        enum: ["WGS84", "GRS80", "KATEC", "TM"],
        description: "좌표계 (기본값: WGS84)"
      },
      addressType: {
        type: "string",
        enum: ["지번", "도로명", "자동"],
        description: "주소 유형 (기본값: 자동)"
      }
    },
    required: ["address"],
    additionalProperties: false
  },
  strict: true
} as const;