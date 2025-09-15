// apps/bff/src/ai/schemas/session/getAllApartments.schema.ts

export const getAllApartmentsSchema = {
  name: "getAllApartments",
  description: "현재 세션에서 언급되거나 저장된 모든 아파트 정보를 조회합니다. 사용자가 아파트 목록을 보고 싶어하거나 컨텍스트에 있는 아파트들을 참조할 때 사용합니다.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false
  }
};