import { ToolSchema } from '../../tools/types';

export const compareMultipleApartmentsSchema: ToolSchema = {
  name: "compareMultipleApartments",
  description: "여러 아파트의 최근 거래 평균가를 비교합니다. 마곡엠밸리 전체 단지 등 다중 비교에 최적화되어 있습니다.",
  parameters: {
    type: "object",
    properties: {
      apartmentIds: {
        type: "array",
        items: { type: "number" },
        description: "비교할 아파트 ID 목록 (최대 20개)"
      },
      apartmentPattern: {
        type: "string",
        description: "아파트명 패턴 (예: '마곡엠밸리', '래미안'). apartmentIds가 없을 때 사용"
      },
      period: {
        type: "string",
        description: "조회 기간 (예: '3년', '1년', '6개월', 기본값: '3년')"
      },
      numDeals: {
        type: "number",
        description: "각 아파트별 평균 계산할 최근 거래 수 (기본값: 3)"
      },
      areaTolerance: {
        type: "number",
        description: "면적 오차 허용 범위 (㎡, 기본값: 5)"
      }
    },
    required: [],
    additionalProperties: false
  },
  strict: true
} as const;