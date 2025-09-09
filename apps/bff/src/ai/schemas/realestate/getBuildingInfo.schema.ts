import { ToolSchema } from '../../tools/types';

export const getBuildingInfoSchema: ToolSchema = {
  name: "getBuildingInfo",
  description: "아파트의 건물 정보(표제부등본, 총괄표제부)를 조회합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID"
      }
    },
    required: ["aptId"],
    additionalProperties: false
  },
  strict: true
} as const;