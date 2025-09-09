import { ToolSchema } from '../../tools/types';

export const searchRealEstateDealsSchema: ToolSchema = {
  name: "searchRealEstateDeals",
  description: "특정 아파트의 실거래 데이터를 검색합니다. 거래 유형(매매/전세/월세)과 면적별로 필터링 가능합니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전월세"],
        description: "거래 유형 필터"
      },
      area: {
        type: "number", 
        description: "전용면적 필터 (평방미터)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;