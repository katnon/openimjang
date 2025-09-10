// RAG 기반 SQL 쿼리 생성 함수 스키마
export const generateSelectQuerySchema = {
  name: "generateSelectQuery",
  description: "데이터베이스 스키마 질문을 RAG로 해석해 정확한 PostgreSQL SELECT 쿼리 생성합니다. 특정 컬럼 의미, 테이블 구조, 데이터 분석 등 데이터베이스 관련 자연어 질의에 사용됩니다.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "데이터베이스 관련 자연어 질문 (예: 'apt_deal_trade_raw 테이블의 dealamount 컬럼 단위는?', '마곡엠밸리 최근 1년 거래 데이터 조회')"
      }
    },
    required: ["question"],
    additionalProperties: false
  }
};