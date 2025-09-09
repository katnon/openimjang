import { ToolSchema } from '../../tools/types';

export const getComparableSalesSchema: ToolSchema = {
  name: "getComparableSales",
  description: "특정 아파트와 유사한 조건의 비교 가능한 실거래 사례를 찾습니다. 감정평가나 시세 추정에 활용됩니다.",
  parameters: {
    type: "object",
    properties: {
      aptId: {
        type: "number",
        description: "기준 아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
      },
      targetArea: {
        type: "number",
        description: "비교할 면적 (㎡)"
      },
      areaTolerance: {
        type: "number",
        description: "면적 허용 오차 (㎡, 기본값: 10)"
      },
      timePeriod: {
        type: "string",
        enum: ["3개월", "6개월", "1년", "2년"],
        description: "비교 거래 기간 (기본값: 6개월)"
      },
      radiusKm: {
        type: "number",
        description: "검색 반경 (km, 기본값: 2)"
      },
      maxResults: {
        type: "number",
        description: "최대 결과 개수 (기본값: 10)"
      },
      includeOtherBuildings: {
        type: "boolean",
        description: "같은 단지 외 다른 건물 포함 여부 (기본값: true)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;