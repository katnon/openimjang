// apt_building_info 테이블 스키마 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function testBuildingInfoSchema() {
  console.log('🔍 oi.apt_building_info 테이블 스키마 확인\n');
  
  try {
    // apt_building_info 테이블 스키마 확인
    console.log('1️⃣ oi.apt_building_info 테이블 스키마 확인');
    
    const buildingInfoSchema = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type', 'is_nullable'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_building_info')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    console.log('🏗️ oi.apt_building_info 테이블의 실제 스키마:');
    buildingInfoSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 샘플 데이터 확인
    console.log('\n2️⃣ 샘플 데이터 확인');
    const sampleData = await db
      .selectFrom('oi.apt_building_info')
      .selectAll()
      .limit(5)
      .execute();
    
    console.log('📋 샘플 데이터:');
    sampleData.forEach((row, index) => {
      console.log(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
    });
    
    // 은마와 관련된 데이터가 있는지 확인
    console.log('\n3️⃣ 은마 관련 데이터 확인');
    const eunmaData = await db
      .selectFrom('oi.apt_building_info')
      .selectAll()
      .where('id', '=', 37743)  // 은마 아파트 ID
      .execute();
    
    console.log(`📍 은마(ID: 37743) 관련 건물 정보: ${eunmaData.length}건`);
    eunmaData.forEach((row, index) => {
      console.log(`${index + 1}. ${JSON.stringify(row, null, 2)}`);
    });
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
    console.error('상세 오류:', error);
  }
}

async function main() {
  await testBuildingInfoSchema();
  return true;
}

main().then(() => {
  console.log('\n✅ 건물 정보 스키마 확인 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});