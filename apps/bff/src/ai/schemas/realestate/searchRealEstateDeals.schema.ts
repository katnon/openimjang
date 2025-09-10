import { ToolSchema } from '../../tools/types';

export const searchRealEstateDealsSchema: ToolSchema = {
  name: "searchRealEstateDeals",
  description: "특정 아파트의 실거래 데이터를 검색합니다. 아파트명 또는 ID가 필요하며, 거래 유형(매매/전세/월세)과 면적별로 필터링 가능합니다.",
  parameters: {
    type: "object",
    properties: {
      apartmentName: {
        type: "string",
        description: "아파트명 (예: 마곡엠밸리7단지, 래미안, 힐스테이트) - 정확한 이름이나 키워드로 검색"
      },
      aptId: {
        type: "number",
        description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전월세", "전체"],
        description: "거래 유형 필터 (기본값: 전체)"
      },
      area: {
        type: "number", 
        description: "전용면적 필터 (평방미터, 예: 84) - ±5㎡ 오차 허용"
      },
      period: {
        type: "string",
        description: "검색 기간 (예: 최근 1년, 3개월, 6개월)",
        enum: ["3개월", "6개월", "1년", "3년", "전체"]
      }
    },
    anyOf: [
      { required: ["apartmentName"] },
      { required: ["aptId"] }
    ],
    additionalProperties: false
  },
  strict: true
} as const;