import { ToolSchema } from '../../tools/types';

export const getLatestTradeSchema: ToolSchema = {
  name: "getLatestTrade",
  description: "특정 아파트의 최근 거래 내역을 조회합니다. 매매, 전세, 월세 거래를 시간순으로 정렬하여 제공합니다.",
  parameters: {
    type: "object",
    properties: {
      apartmentName: {
        type: "string",
        description: "아파트 이름"
      },
      aptId: {
        type: "number",
        description: "아파트 ID (apartmentName 대신 사용 가능)"
      },
      limit: {
        type: "number",
        description: "조회할 최대 거래 수 (기본값: 10)"
      },
      dealType: {
        type: "string",
        enum: ["매매", "전세", "월세", "전체"],
        description: "거래 유형 필터 (기본값: 전체)"
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;