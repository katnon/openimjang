// SQL 쿼리 실행 함수 스키마
export const executeQuerySchema = {
  name: "executeQuery", 
  description: "검증된 SELECT 쿼리를 PostgreSQL 데이터베이스에서 안전하게 실행하여 결과를 반환합니다. 읽기 전용 쿼리만 실행 가능합니다.",
  parameters: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "실행할 PostgreSQL SELECT 쿼리문 (SELECT 문만 허용)"
      },
      explanation: {
        type: "string", 
        description: "쿼리에 대한 설명 (사용자 확인 및 로깅용)"
      }
    },
    required: ["sql", "explanation"],
    additionalProperties: false
  }
};