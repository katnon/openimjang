import { ToolSchema } from '../../tools/types';

export const getDealStatsSummarySchema: ToolSchema = {
  name: "getDealStatsSummary",
  description: "특정 아파트의 거래 통계 요약을 제공합니다. 평균가, 중간값, 거래량, 평균 거래일수 등을 포함합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      period: {
        type: "string",
        enum: ["1개월", "3개월", "6개월", "1년", "2년", "3년"],
        description: "집계 기간 (기본값: 1년)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전체"],
        description: "거래 유형 (기본값: 전체)"
      },
      includeFloorAnalysis: {
        type: "boolean",
        description: "층별 분석 포함 여부 (기본값: false)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;