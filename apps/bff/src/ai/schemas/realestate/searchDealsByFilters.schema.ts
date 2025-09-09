import { ToolSchema } from '../../tools/types';

export const searchDealsByFiltersSchema: ToolSchema = {
  name: "searchDealsByFilters",
  description: "복합 조건으로 부동산 거래를 검색합니다. 지역, 가격대, 면적, 건축년도 등 다양한 필터를 조합할 수 있습니다.",
  parameters: {
    type: "object",
    properties: {
      region: {
        type: "string",
        description: "검색할 지역 (구, 동 단위)"
      },
      priceRange: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "가격 범위 [최소, 최대] (만원)"
      },
      areaRange: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "면적 범위 [최소, 최대] (㎡)"
      },
      buildYearRange: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "건축년도 범위 [최소, 최대]"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세"],
        description: "거래 유형"
      },
      limit: {
        type: "number",
        description: "최대 결과 개수 (기본값: 50)"
      }
    },
    required: ["dealType"],
    additionalProperties: false
  },
  strict: true
} as const;