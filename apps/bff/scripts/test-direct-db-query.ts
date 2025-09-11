// 직접 DB 조회 테스트 - 마곡엠밸리7단지 데이터 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function testDirectDbQuery() {
  console.log('🔍 마곡엠밸리7단지 DB 데이터 직접 확인\n');
  
  try {
    // 0. 테이블 스키마 먼저 확인
    console.log('0️⃣ 테이블 스키마 확인');
    
    const aptInfoSchema = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_info')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    console.log('🏗️ apt_info 테이블 스키마:');
    aptInfoSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n');
    
    const tradeSchema = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_deal_trade_raw')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    console.log('🏗️ apt_deal_trade_raw 테이블 스키마:');
    tradeSchema.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // 1. 아파트 정보 확인 (정확한 컬럼명 사용)
    console.log('\n1️⃣ 아파트 정보 확인');
    const aptInfo = await db
      .selectFrom('oi.apt_info')
      .selectAll()
      .where('apt_nm', 'like', '%마곡엠밸리7단지%')
      .execute();
    
    console.log('📍 아파트 정보:', aptInfo);
    
    if (aptInfo.length === 0) {
      console.log('❌ 마곡엠밸리7단지를 찾을 수 없습니다.');
      
      // 대신 마곡엠밸리로 검색
      const aptList = await db
        .selectFrom('oi.apt_info')
        .selectAll()
        .where('apt_nm', 'like', '%마곡엠밸리%')
        .limit(10)
        .execute();
      
      console.log('🔍 마곡엠밸리 관련 아파트들:', aptList);
      return;
    }
    
    // 첫 번째 아파트 정보에서 ID 추출 (정확한 컬럼명 확인 후)
    const firstApt = aptInfo[0];
    console.log('✅ 첫 번째 아파트 정보:', firstApt);
    
    // 실제 ID 컬럼명 확인을 위해 모든 키 출력
    console.log('🔑 사용 가능한 컬럼들:', Object.keys(firstApt));
    
    // aptId 또는 id 등으로 추정
    const aptId = (firstApt as any).aptid || (firstApt as any).id || (firstApt as any).apt_id;
    console.log(`✅ 아파트 ID: ${aptId}`);
    
    // 2. 전체 거래 건수 확인
    console.log('\n2️⃣ 전체 거래 건수 확인');
    const totalCount = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(db.fn.count('*').as('count'))
      .where('apt_id', '=', aptId)
      .executeTakeFirst();
    
    console.log('📊 전체 거래 건수:', totalCount?.count);
    
    // 3. 매매 거래 건수 확인
    console.log('\n3️⃣ 매매 거래 건수 확인');
    const buyCount = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(db.fn.count('*').as('count'))
      .where('apt_id', '=', aptId)
      .where('deal_type', '=', '매매')
      .executeTakeFirst();
    
    console.log('💰 매매 거래 건수:', buyCount?.count);
    
    // 4. 최근 매매 거래 샘플 확인
    console.log('\n4️⃣ 최근 매매 거래 샘플 (5건)');
    const recentDeals = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['deal_year', 'deal_month', 'deal_day', 'deal_amount', 'exclusive_area', 'floor', 'deal_type'])
      .where('apt_id', '=', aptId)
      .where('deal_type', '=', '매매')
      .orderBy('deal_year', 'desc')
      .orderBy('deal_month', 'desc')
      .orderBy('deal_day', 'desc')
      .limit(5)
      .execute();
    
    console.log('📋 최근 매매 거래:');
    recentDeals.forEach((deal, index) => {
      console.log(`${index + 1}. ${deal.deal_year}.${deal.deal_month}.${deal.deal_day} - ${deal.deal_amount}만원, ${deal.exclusive_area}㎡, ${deal.floor}층`);
    });
    
    // 5. 면적 59㎡ 근처 거래 확인
    console.log('\n5️⃣ 59㎡ 근처 매매 거래 확인');
    const area59Count = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(db.fn.count('*').as('count'))
      .where('apt_id', '=', aptId)
      .where('deal_type', '=', '매매')
      .where('exclusive_area', '>=', 59)
      .where('exclusive_area', '<=', 60)
      .executeTakeFirst();
    
    console.log('🏠 59㎡ 근처 매매 거래 건수:', area59Count?.count);
    
    // 6. 모든 면적 종류 확인
    console.log('\n6️⃣ 모든 면적 종류 확인');
    const allAreas = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['exclusive_area'])
      .distinct()
      .where('apt_id', '=', aptId)
      .where('deal_type', '=', '매매')
      .orderBy('exclusive_area', 'asc')
      .execute();
    
    console.log('📐 모든 면적 종류:', allAreas.map(a => a.exclusive_area).join(', '));
    
    // 7. 테이블 스키마 확인
    console.log('\n7️⃣ 테이블 스키마 확인');
    const schemaInfo = await db
      .selectFrom('information_schema.columns')
      .select(['column_name', 'data_type'])
      .where('table_schema', '=', 'oi')
      .where('table_name', '=', 'apt_deal_trade_raw')
      .orderBy('ordinal_position', 'asc')
      .execute();
    
    console.log('🏗️ 테이블 스키마:');
    schemaInfo.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
  }
}

async function main() {
  await testDirectDbQuery();
  return true;
}

main().then(() => {
  console.log('\n✅ 직접 DB 조회 테스트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});