// 임베딩 DB에 저장된 스키마 문서들 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function checkEmbeddingSchemas() {
  console.log('🔍 임베딩 DB에 저장된 스키마 문서들 확인');
  
  try {
    // 1. ai.embeddings 테이블의 모든 스키마 문서 조회
    console.log('\n--- AI 임베딩 테이블의 스키마 문서들 ---');
    const schemas = await db
      .selectFrom('ai.embeddings')
      .select(['id', 'source_path', 'schema_name', 'table_name', 'chunk_id', 'content_text'])
      .where('schema_name', 'is not', null)
      .orderBy('schema_name')
      .orderBy('table_name')
      .execute();
    
    console.log(`총 ${schemas.length}개의 스키마 문서 발견`);
    
    // 2. 테이블별로 그룹핑해서 표시
    const tableGroups = schemas.reduce((acc, schema) => {
      const key = `${schema.schema_name}.${schema.table_name}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schema);
      return acc;
    }, {} as Record<string, typeof schemas>);
    
    console.log('\n--- 테이블별 스키마 문서 ---');
    for (const [tableName, docs] of Object.entries(tableGroups)) {
      console.log(`\n🗂️ ${tableName} (${docs.length}개 문서):`);
      docs.forEach(doc => {
        console.log(`  📄 ID: ${doc.id}, chunk: ${doc.chunk_id}`);
        console.log(`     내용: ${doc.content_text.slice(0, 150)}...`);
      });
    }
    
    // 3. apt_deal_all 테이블 스키마 상세 확인
    console.log('\n--- apt_deal_all 테이블 스키마 상세 ---');
    const aptDealAllDocs = schemas.filter(s => s.table_name === 'apt_deal_all');
    aptDealAllDocs.forEach(doc => {
      console.log(`\n📋 문서 ID: ${doc.id}`);
      console.log(`전체 내용:\n${doc.content_text}`);
    });
    
    // 4. apt_deal_trade_raw 테이블 스키마 상세 확인
    console.log('\n--- apt_deal_trade_raw 테이블 스키마 상세 ---');
    const aptTradeRawDocs = schemas.filter(s => s.table_name === 'apt_deal_trade_raw');
    aptTradeRawDocs.forEach(doc => {
      console.log(`\n📋 문서 ID: ${doc.id}`);
      console.log(`전체 내용:\n${doc.content_text}`);
    });
    
    // 5. 컬럼명 매핑 분석
    console.log('\n--- 컬럼명 차이 분석 ---');
    
    // 실제 DB 스키마 (이전에 확인한 내용)
    const realAptDealAll = [
      'id', 'apt_nm', 'apt_dong', 'jibun_address', 'exclu_use_ar', 'floor', 
      'deal_year', 'deal_month', 'deal_day', 'deal_amount', 'deposit', 'monthly_rent',
      'created_at', 'updated_at'
    ];
    
    const realAptTradeRaw = [
      'id', 'sggcd', 'umdcd', 'landcd', 'bonbun', 'bubun', 'roadnm', 'roadnmsggcd',
      'roadnmcd', 'roadnmseq', 'roadnmbascd', 'roadnmbonbun', 'roadnmbubun', 
      'umdnm', 'aptnm', 'jibun', 'excluusear', 'dealyear', 'dealmonth', 'dealday',
      'dealamount', 'floor', 'buildyear', 'aptseq', 'cdealtype', 'cdealday',
      'dealinggbn', 'estateagentsggnm', 'rgstdate', 'aptdong', 'slergbn',
      'buyergbn', 'landleaseholdgbn', 'created_at', 'updated_at', 'roadnmbcd'
    ];
    
    console.log('\n🔄 실제 DB vs 임베딩 문서 컬럼명 비교:');
    console.log('\napt_deal_all 실제 컬럼들:');
    realAptDealAll.forEach(col => console.log(`  ✓ ${col}`));
    
    console.log('\napt_deal_trade_raw 실제 컬럼들:');
    realAptTradeRaw.forEach(col => console.log(`  ✓ ${col}`));
    
  } catch (error) {
    console.error('❌ 스키마 문서 조회 실패:', error);
  }
}

checkEmbeddingSchemas().then(() => {
  console.log('\n✅ 임베딩 스키마 문서 확인 완료');
  process.exit(0);
}).catch(err => { 
  console.error('\n❌ 확인 오류:', err); 
  process.exit(1); 
});