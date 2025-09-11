// 거래 유형 데이터 문제 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function testDealTypeIssue() {
  console.log('🔍 거래 유형 데이터 문제 분석\n');
  
  try {
    // 1. 마곡엠밸리7단지 원본 거래 데이터 확인
    console.log('1️⃣ 마곡엠밸리7단지 원본 거래 데이터 (최근 10건)');
    const rawDeals = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .selectAll()
      .where('aptnm', '=', '마곡엠밸리7단지')
      .orderBy('dealyear', 'desc')
      .orderBy('dealmonth', 'desc')
      .orderBy('dealday', 'desc')
      .limit(10)
      .execute();
    
    console.log(`📊 총 ${rawDeals.length}건 조회`);
    
    if (rawDeals.length > 0) {
      console.log('\n📋 원본 데이터 (중요 컬럼만):');
      rawDeals.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.dealyear}.${String(deal.dealmonth).padStart(2, '0')}.${String(deal.dealday).padStart(2, '0')}`);
        console.log(`   💰 거래금액: ${deal.dealamount}만원`);
        console.log(`   📐 전용면적: ${deal.excluusear}㎡`);
        console.log(`   🏢 층수: ${deal.floor}층`);
        console.log(`   📝 거래유형(cdealtype): "${deal.cdealtype}"`);
        console.log(`   📄 거래구분(dealinggbn): "${deal.dealinggbn}"`);
        console.log('   ─────────');
      });
    }
    
    // 2. 모든 거래 유형 컬럼 확인
    console.log('\n2️⃣ 전체 데이터베이스 거래 유형 분포');
    const allDealTypes = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['cdealtype'])
      .select((eb) => eb.fn.count('id').as('count'))
      .groupBy('cdealtype')
      .orderBy('count', 'desc')
      .execute();
    
    console.log('📊 cdealtype 분포:');
    allDealTypes.forEach(stat => {
      console.log(`- "${stat.cdealtype}": ${stat.count}건`);
    });
    
    // 3. dealinggbn 컬럼 확인 (다른 거래 유형 컬럼일 수 있음)
    console.log('\n3️⃣ dealinggbn 컬럼 분포 확인');
    const dealinggbnTypes = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['dealinggbn'])
      .select((eb) => eb.fn.count('id').as('count'))
      .groupBy('dealinggbn')
      .orderBy('count', 'desc')
      .execute();
    
    console.log('📊 dealinggbn 분포:');
    dealinggbnTypes.forEach(stat => {
      console.log(`- "${stat.dealinggbn}": ${stat.count}건`);
    });
    
    // 4. 마곡엠밸리7단지에서 dealinggbn별 분류
    console.log('\n4️⃣ 마곡엠밸리7단지 dealinggbn별 분류');
    const complex7Deals = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['dealinggbn'])
      .select((eb) => eb.fn.count('id').as('count'))
      .where('aptnm', '=', '마곡엠밸리7단지')
      .groupBy('dealinggbn')
      .execute();
    
    console.log('📊 마곡엠밸리7단지 dealinggbn 분포:');
    complex7Deals.forEach(stat => {
      console.log(`- "${stat.dealinggbn}": ${stat.count}건`);
    });
    
    // 5. 실제 전세/월세 거래 찾기 (dealinggbn 기준)
    console.log('\n5️⃣ dealinggbn 기준 전세/월세 거래 확인');
    const potentialJeonse = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['aptnm', 'dealyear', 'dealmonth', 'dealday', 'dealamount', 'excluusear', 'dealinggbn'])
      .where('aptnm', 'like', '%마곡엠밸리%')
      .where('dealinggbn', 'in', ['전세', '월세', 'Jeonse', 'Monthly', '임대차'])
      .limit(10)
      .execute();
    
    console.log(`🏠 전세/월세 가능 거래: ${potentialJeonse.length}건`);
    if (potentialJeonse.length > 0) {
      potentialJeonse.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.aptnm} - ${deal.dealyear}.${String(deal.dealmonth).padStart(2, '0')}.${String(deal.dealday).padStart(2, '0')} - ${deal.dealamount}만원, ${deal.excluusear}㎡ (${deal.dealinggbn})`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
  }
}

async function main() {
  await testDealTypeIssue();
  return true;
}

main().then(() => {
  console.log('\n✅ 거래 유형 데이터 분석 완료');
  console.log('\n💡 결론: cdealtype 컬럼이 비어있어서 dealinggbn 컬럼을 사용해야 할 수 있음');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});