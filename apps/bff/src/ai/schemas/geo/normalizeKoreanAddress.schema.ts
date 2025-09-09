import { ToolSchema } from '../../tools/types';

export const normalizeKoreanAddressSchema: ToolSchema = {
  name: "normalizeKoreanAddress",
  description: "한국 주소를 표준화합니다. 다양한 형태의 주소 입력을 통일된 형식으로 변환하고 유효성을 검증합니다.",
  parameters: {
    type: "object",
    properties: {
      address: {
        type: "string",
        description: "정규화할 주소"
      },
      outputFormat: {
        type: "string",
        enum: ["지번", "도로명", "통합"],
        description: "출력 주소 형식 (기본값: 통합)"
      },
      includePostalCode: {
        type: "boolean",
        description: "우편번호 포함 여부 (기본값: true)"
      },
      validateAddress: {
        type: "boolean",
        description: "주소 유효성 검증 수행 여부 (기본값: true)"
      },
      detailLevel: {
        type: "string",
        enum: ["기본", "상세", "최상세"],
        description: "주소 상세 수준 (기본값: 기본)"
      }
    },
    required: ["address"],
    additionalProperties: false
  },
  strict: true
} as const;