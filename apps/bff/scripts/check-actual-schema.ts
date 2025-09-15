// 실제 DB 스키마 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function checkActualSchema() {
  console.log('🔍 실제 DB 스키마 확인');
  
  // 1. apt_deal_all 테이블 구조 확인
  console.log('\n--- apt_deal_all 테이블 구조 ---');
  try {
    const dealColumns = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_deal_all')
      .orderBy('ordinal_position')
      .execute();
    
    console.log('apt_deal_all 컬럼들:');
    dealColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  } catch (error) {
    console.log('❌ apt_deal_all 테이블 조회 실패:', error);
  }
  
  // 2. apt_deal_trade_raw 테이블 구조 확인
  console.log('\n--- apt_deal_trade_raw 테이블 구조 ---');
  try {
    const tradeColumns = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_deal_trade_raw')
      .orderBy('ordinal_position')
      .execute();
    
    console.log('apt_deal_trade_raw 컬럼들:');
    tradeColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  } catch (error) {
    console.log('❌ apt_deal_trade_raw 테이블 조회 실패:', error);
  }
  
  // 3. apt_info 테이블 구조 확인
  console.log('\n--- apt_info 테이블 구조 ---');
  try {
    const infoColumns = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_info')
      .orderBy('ordinal_position')
      .execute();
    
    console.log('apt_info 컬럼들:');
    infoColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  } catch (error) {
    console.log('❌ apt_info 테이블 조회 실패:', error);
  }
  
  // 4. 실제 데이터 샘플 확인
  console.log('\n--- apt_deal_all 샘플 데이터 ---');
  try {
    const sampleDeals = await db
      .selectFrom('oi.apt_deal_all')
      .selectAll()
      .limit(3)
      .execute();
    
    if (sampleDeals.length > 0) {
      console.log('첫 번째 거래 데이터:');
      console.log(JSON.stringify(sampleDeals[0], null, 2));
    }
  } catch (error) {
    console.log('❌ apt_deal_all 샘플 데이터 조회 실패:', error);
  }
  
  // 5. oi 스키마의 모든 테이블 목록
  console.log('\n--- oi 스키마의 모든 테이블 ---');
  try {
    const tables = await db
      .selectFrom('information_schema.tables')
      .select(['table_name', 'table_type'])
      .where('table_schema', '=', 'oi')
      .orderBy('table_name')
      .execute();
    
    console.log('oi 스키마 테이블들:');
    tables.forEach(table => {
      console.log(`  ${table.table_name} (${table.table_type})`);
    });
  } catch (error) {
    console.log('❌ 테이블 목록 조회 실패:', error);
  }
}

checkActualSchema().then(() => {
  console.log('\n✅ 스키마 확인 완료');
  process.exit(0);
}).catch(err => { 
  console.error('\n❌ 스키마 확인 오류:', err); 
  process.exit(1); 
});