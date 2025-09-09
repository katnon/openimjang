import { ToolSchema } from '../../tools/types';

export const estimateRentYieldSchema: ToolSchema = {
  name: "estimateRentYield",
  description: "특정 아파트의 임대 수익률을 추정합니다. 매매가 대비 전세/월세 수익률을 계산하고 투자 분석을 제공합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      purchasePrice: {
        type: "number",
        description: "매입 가격 (만원, 생략시 최근 거래가 사용)"
      },
      targetArea: {
        type: "number",
        description: "대상 면적 (㎡, 생략시 평균 면적 사용)"
      },
      rentType: {
        type: "string",
        enum: ["전세", "월세", "전체"],
        description: "임대 유형 (기본값: 전체)"
      },
      includeTax: {
        type: "boolean",
        description: "세금 고려 여부 (기본값: true)"
      },
      includeMaintenanceCost: {
        type: "boolean",
        description: "관리비 고려 여부 (기본값: true)"
      },
      analysisType: {
        type: "string",
        enum: ["단순", "상세", "시나리오"],
        description: "분석 유형 (기본값: 상세)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;