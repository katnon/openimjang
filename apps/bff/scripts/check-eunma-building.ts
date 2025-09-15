// 은마 아파트 건물 정보 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function checkEunmaBuildingInfo() {
  console.log('🔍 은마 아파트(ID: 37743) 건물 정보 확인');
  
  const buildingInfo = await db
    .selectFrom('oi.apt_building_info')
    .selectAll()
    .where('apt_id', '=', 37743)
    .execute();
    
  console.log(`📋 건물 정보 개수: ${buildingInfo.length}건`);
  
  if (buildingInfo.length > 0) {
    buildingInfo.forEach((info, index) => {
      console.log(`${index + 1}. type: ${info.type}, dongnm: ${info.dongnm}, bldnm: ${info.bldnm}`);
    });
  } else {
    console.log('❌ 은마 아파트의 건물 정보가 없습니다.');
    console.log('📍 이 경우 더미 데이터 반환 메커니즘이 작동해야 합니다.');
  }
}

checkEunmaBuildingInfo().then(() => {
  console.log('✅ 은마 건물 정보 확인 완료');
  process.exit(0);
}).catch(err => { 
  console.error('❌ 오류:', err); 
  process.exit(1); 
});