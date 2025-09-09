import { ToolSchema } from '../../tools/types';

export const getPriceTrendsSchema: ToolSchema = {
  name: "getPriceTrends",
  description: "특정 아파트의 가격 트렌드를 분석합니다. 시간대별 평균가, 상승/하락률 등을 제공합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      period: {
        type: "string",
        enum: ["1년", "2년", "3년", "5년"],
        description: "분석 기간 (기본값: 3년)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전체"],
        description: "거래 유형 (기본값: 전체)"
      },
      areaRange: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "면적 범위 [최소, 최대] (㎡)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;