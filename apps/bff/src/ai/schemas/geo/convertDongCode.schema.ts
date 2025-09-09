import { ToolSchema } from '../../tools/types';

export const convertDongCodeSchema: ToolSchema = {
  name: "convertDongCode",
  description: "법정동 코드를 행정동 코드로 변환하거나 그 반대로 변환합니다.",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "변환할 동 코드"
      },
      fromType: {
        type: "string",
        enum: ["법정동", "행정동"],
        description: "입력 코드 유형"
      },
      toType: {
        type: "string",
        enum: ["법정동", "행정동"],
        description: "출력 코드 유형"
      }
    },
    required: ["code", "fromType", "toType"],
    additionalProperties: false
  },
  strict: true
} as const;