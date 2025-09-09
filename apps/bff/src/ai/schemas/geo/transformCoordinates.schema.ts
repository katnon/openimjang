import { ToolSchema } from '../../tools/types';
import { EPSG_LIST } from '../../tools/types';

export const transformCoordinatesSchema: ToolSchema = {
  name: "transformCoordinates",
  description: "좌표계를 변환합니다. WGS84, 한국측지계, UTM-K 등 다양한 좌표계 간 변환을 지원합니다.",
  parameters: {
    type: "object",
    properties: {
      x: {
        type: "number",
        description: "X 좌표 (경도 또는 동쪽 좌표)"
      },
      y: {
        type: "number",
        description: "Y 좌표 (위도 또는 북쪽 좌표)"
      },
      fromEPSG: {
        type: "number",
        enum: [4326, 5179, 5181, 3857],
        description: "입력 좌표계 EPSG 코드"
      },
      toEPSG: {
        type: "number",
        enum: [4326, 5179, 5181, 3857],
        description: "출력 좌표계 EPSG 코드"
      },
      precision: {
        type: "number",
        description: "소수점 자릿수 (기본값: 6)"
      }
    },
    required: ["x", "y", "fromEPSG", "toEPSG"],
    additionalProperties: false
  },
  strict: true
} as const;