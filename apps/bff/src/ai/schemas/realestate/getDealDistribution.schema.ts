import { ToolSchema } from '../../tools/types';

export const getDealDistributionSchema: ToolSchema = {
  name: "getDealDistribution",
  description: "특정 아파트의 거래 분포를 분석합니다. 가격대별, 면적별, 층별 거래 분포를 제공합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      distributionType: {
        type: "string",
        enum: ["가격대별", "면적별", "층별", "전체"],
        description: "분포 분석 유형 (기본값: 전체)"
      },
      period: {
        type: "string",
        enum: ["6개월", "1년", "2년", "3년"],
        description: "분석 기간 (기본값: 1년)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전체"],
        description: "거래 유형 (기본값: 전체)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;