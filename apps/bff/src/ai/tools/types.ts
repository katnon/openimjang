// AI Tools 공용 타입 정의

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  strict?: boolean;
}

export interface OpenAITool {
  type: "function";
  function: ToolSchema;
}

export type ToolHandler<P = any, R = any> = (args: P) => Promise<R>;

export interface ToolHandlers {
  [key: string]: ToolHandler;
}

// 공용 상수
export const EPSG_LIST = {
  WGS84: 4326,
  KOREA_2000_UNIFIED: 5179,
  KOREA_2000_WEST_BELT: 5181,
  WEB_MERCATOR: 3857
} as const;