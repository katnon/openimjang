// 실제 DB 스키마 확인 및 은마 아파트 검색
import "dotenv/config";
import { db } from '../src/lib/db';

async function testAptInfoSchema() {
  console.log('🔍 oi.apt_info 테이블 실제 스키마 확인 및 은마 아파트 검색\n');
  
  try {
    // 1. oi.apt_info 테이블 스키마 확인
    console.log('1️⃣ oi.apt_info 테이블 스키마 확인');
    
    const aptInfoSchema = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_info')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    console.log('🏗️ oi.apt_info 테이블의 실제 스키마:');
    aptInfoSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 2. 은마 아파트 검색
    console.log('\n2️⃣ 은마 아파트 검색');
    const eunmaSearch = await db
      .selectFrom('oi.apt_info')
      .selectAll()
      .where('apt_nm', 'like', '%은마%')
      .execute();
    
    console.log(`📍 은마 관련 아파트 개수: ${eunmaSearch.length}`);
    
    if (eunmaSearch.length > 0) {
      console.log('✅ 은마 아파트 목록:');
      eunmaSearch.forEach((apt, index) => {
        console.log(`${index + 1}. ${JSON.stringify(apt, null, 2)}`);
      });
      
      // 첫 번째 은마 아파트의 모든 컬럼 확인
      const firstEunma = eunmaSearch[0];
      console.log('\n🔑 첫 번째 은마 아파트의 모든 컬럼:');
      Object.keys(firstEunma).forEach(key => {
        console.log(`- ${key}: ${(firstEunma as any)[key]}`);
      });
    } else {
      console.log('❌ 은마 아파트를 찾을 수 없습니다.');
      
      // 전체 아파트 샘플 확인
      console.log('\n샘플 데이터 확인:');
      const sampleApts = await db
        .selectFrom('oi.apt_info')
        .selectAll()
        .limit(5)
        .execute();
      
      console.log('📋 샘플 아파트 5건:');
      sampleApts.forEach((apt, index) => {
        console.log(`${index + 1}. ${JSON.stringify(apt, null, 2)}`);
      });
    }
    
    // 3. apt_deal_all 테이블 스키마도 확인
    console.log('\n3️⃣ oi.apt_deal_all 테이블 스키마 확인');
    
    const dealAllSchema = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_deal_all')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    if (dealAllSchema.length > 0) {
      console.log('🏗️ oi.apt_deal_all 테이블의 실제 스키마:');
      dealAllSchema.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ oi.apt_deal_all 테이블이 존재하지 않습니다.');
    }
    
    // 4. 모든 oi 스키마 테이블 목록 확인
    console.log('\n4️⃣ oi 스키마의 모든 테이블 목록');
    
    const allTables = await db
      .selectFrom('information_schema.tables')
      .select(['table_name'])
      .where('table_schema', '=', 'oi')
      .orderBy('table_name', 'asc')
      .execute();
    
    console.log('📋 oi 스키마의 모든 테이블:');
    allTables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
    console.error('상세 오류:', error);
  }
}

async function main() {
  await testAptInfoSchema();
  return true;
}

main().then(() => {
  console.log('\n✅ 스키마 확인 테스트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});