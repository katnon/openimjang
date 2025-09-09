import { ToolSchema } from '../../tools/types';

export const isochroneSearchSchema: ToolSchema = {
  name: "isochroneSearch",
  description: "특정 지점에서 지정된 시간 내에 도달 가능한 영역(등시선)을 계산합니다. 교통수단별 접근성 분석에 활용됩니다.",
  parameters: {
    type: "object",
    properties: {
      startLat: {
        type: "number",
        description: "출발점 위도"
      },
      startLng: {
        type: "number",
        description: "출발점 경도"
      },
      travelTime: {
        type: "number",
        description: "이동 시간 (분)"
      },
      transportMode: {
        type: "string",
        enum: ["도보", "자전거", "자동차", "대중교통"],
        description: "교통수단 (기본값: 대중교통)"
      },
      timeOfDay: {
        type: "string",
        description: "출발 시간 (HH:MM 형식, 기본값: 현재 시간)"
      },
      includeTraffic: {
        type: "boolean",
        description: "교통상황 고려 여부 (기본값: true)"
      }
    },
    required: ["startLat", "startLng", "travelTime"],
    additionalProperties: false
  },
  strict: true
} as const;