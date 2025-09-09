import { ToolSchema } from '../../tools/types';

export const lookupLegalDongCodeSchema: ToolSchema = {
  name: "lookupLegalDongCode",
  description: "법정동 코드를 조회합니다. 시/군/구, 읍/면/동 정보로 법정동 코드를 찾을 수 있습니다.",
  parameters: {
    type: "object",
    properties: {
      sido: {
        type: "string",
        description: "시/도명 (예: 서울특별시, 경기도)"
      },
      sigungu: {
        type: "string",
        description: "시/군/구명 (예: 강남구, 성남시)"
      },
      dong: {
        type: "string",
        description: "읍/면/동명 (예: 역삼동, 분당동)"
      },
      codeType: {
        type: "string",
        enum: ["법정동", "행정동", "전체"],
        description: "코드 유형 (기본값: 법정동)"
      }
    },
    required: ["sido"],
    additionalProperties: false
  },
  strict: true
} as const;