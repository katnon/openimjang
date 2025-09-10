// RAG 기반 SQL 쿼리 생성 핸들러
import { vectorService } from '../../../services/vectorService';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateSelectQueryArgs {
  question: string;
}

export async function generateSelectQuery(args: GenerateSelectQueryArgs) {
  try {
    const { question } = args;
    
    console.log('🔍 RAG 기반 SQL 생성 요청:', { question });
    
    // 1) RAG 검색으로 관련 스키마 정보 수집
    const searchResults = await vectorService.search(question, { topK: 5 });
    
    if (searchResults.length === 0) {
      return {
        success: false,
        error: '관련된 데이터베이스 스키마 정보를 찾을 수 없습니다.',
        sql: null,
        explanation: null
      };
    }
    
    console.log('✅ RAG 검색 완료:', { documentsFound: searchResults.length });
    
    // 2) 스키마 컨텍스트 구성 (schema_name 메타정보 강조)
    const schemaContext = searchResults.map((doc, index) => {
      const schemaName = doc.metadata.schema_name || 'unknown';
      const tableName = doc.metadata.table_name || 'unknown';
      return `출처${index + 1} - 스키마: ${schemaName}, 테이블: ${tableName}
테이블명: ${schemaName}.${tableName}
내용: ${doc.content}`;
    }).join('\n\n---\n\n');
    
    // 3) OpenAI에게 SQL 생성 요청 (부동산 도메인 전문가로 특화)
    const systemPrompt = `당신은 OpenImjang 부동산 분석 시스템의 SQL 생성 전문가입니다.
일반 사용자의 자연어 질문을 정확한 PostgreSQL SELECT 쿼리로 변환합니다.

**핵심 변환 규칙:**

1. **아파트명 처리**
   - 사용자가 말한 아파트명은 aptnm 컬럼에서 ILIKE '%이름%'로 검색
   - 예: "마곡엠밸리" → WHERE aptnm ILIKE '%마곡엠밸리%'

2. **거래 유형 자동 판별**
   - 매매 관련 질문 → oi.apt_deal_trade_raw 테이블
   - 전월세 관련 질문 → oi.apt_deal_rent_raw 테이블
   
3. **시간 기간 변환**
   - "최근 N개월" → WHERE MAKE_DATE(dealyear, dealmonth, dealday) >= CURRENT_DATE - INTERVAL 'N months'
   - "N년" → WHERE dealyear = N
   - "최근 1년" → WHERE MAKE_DATE(dealyear, dealmonth, dealday) >= CURRENT_DATE - INTERVAL '1 year'

4. **집계 함수 매핑**
   - "평균" → AVG(), "최대" → MAX(), "최소" → MIN()
   - "거래량", "건수" → COUNT()

5. **필수 스키마 접두사**
   - 부동산 데이터: oi.apt_deal_trade_raw, oi.apt_deal_rent_raw
   - 공간 데이터: public.seoul_bldg, public.landuse_code

**주요 테이블과 컬럼:**

- **oi.apt_deal_trade_raw** (매매 실거래)
  * dealamount: 거래금액 (만원 단위)
  * aptnm: 아파트명
  * excluusear: 전용면적 (㎡)
  * dealyear, dealmonth, dealday: 거래 일자
  
- **oi.apt_deal_rent_raw** (전월세 실거래)  
  * deposit: 보증금 (만원 단위)
  * monthlyrent: 월세 (만원 단위, 0이면 전세)
  * aptnm: 아파트명
  * excluusear: 전용면적 (㎡)

**자연어 → SQL 변환 예시:**
- "마곡엠밸리 최근 3개월 평균 매매가" 
  → SELECT AVG(dealamount) FROM oi.apt_deal_trade_raw WHERE aptnm ILIKE '%마곡엠밸리%' AND MAKE_DATE(dealyear, dealmonth, dealday) >= CURRENT_DATE - INTERVAL '3 months';

**스키마 정보:**
${schemaContext}

**응답 형식:**
- 순수 SQL 쿼리만 반환 (설명이나 코멘트 없이)
- 반드시 스키마.테이블명 형식 사용
- 세미콜론(;)으로 끝내기`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.1, // 일관성 있는 SQL 생성을 위해 낮은 온도 사용
      max_tokens: 500
    });
    
    console.log('🤖 OpenAI 응답 디버깅:', {
      choices: response.choices.length,
      firstChoice: response.choices[0]?.message?.content?.slice(0, 100),
      finishReason: response.choices[0]?.finish_reason
    });
    
    let generatedSQL = response.choices[0]?.message?.content?.trim();
    
    // 코드 블록 마크다운 제거 (```sql ... ```)
    if (generatedSQL?.startsWith('```')) {
      const lines = generatedSQL.split('\n');
      // 첫 줄과 마지막 줄 제거
      generatedSQL = lines.slice(1, -1).join('\n').trim();
    }
    
    console.log('🔧 처리된 SQL:', { generatedSQL: generatedSQL?.slice(0, 100) });
    
    if (!generatedSQL) {
      return {
        success: false,
        error: 'SQL 쿼리 생성에 실패했습니다.',
        sql: null,
        explanation: null
      };
    }
    
    // 4) 간단한 SQL 검증 (SELECT 문인지 확인)
    const normalizedSQL = generatedSQL.toLowerCase().trim();
    if (!normalizedSQL.startsWith('select')) {
      return {
        success: false,
        error: 'SELECT 쿼리만 생성 가능합니다.',
        sql: null,
        explanation: null
      };
    }
    
    // 5) 설명 생성
    const explanation = `사용자 질문 "${question}"에 대한 SQL 쿼리를 생성했습니다. ${searchResults.length}개의 스키마 문서를 참조했습니다.`;
    
    console.log('✅ SQL 생성 완료:', { 
      sqlLength: generatedSQL.length,
      schemasUsed: searchResults.length 
    });
    
    return {
      success: true,
      sql: generatedSQL,
      explanation,
      schemasUsed: searchResults.map(r => ({
        source: r.metadata.source,
        schema: r.metadata.schema_name,
        table: r.metadata.table_name,
        score: r.metadata.score
      }))
    };
    
  } catch (error: any) {
    console.error('❌ SQL 생성 오류:', error);
    return {
      success: false,
      error: error.message || 'SQL 생성 중 오류가 발생했습니다.',
      sql: null,
      explanation: null
    };
  }
}