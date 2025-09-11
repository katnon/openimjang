// 전세 84㎡ 데이터 존재 확인 테스트
import "dotenv/config";
import { db } from '../src/lib/db';

async function testJeonse84Data() {
  console.log('🔍 전세 84㎡ 데이터 존재 확인 테스트\n');
  
  try {
    // 1. 마곡엠밸리 전체 전세 거래 확인 (새로운 로직)
    console.log('1️⃣ 마곡엠밸리 전체 전세 거래 확인 (apt_deal_all 테이블)');
    const allJeonseDeals = await db
      .selectFrom('oi.apt_deal_all')
      .select(['apt_nm', 'deal_year', 'deal_month', 'deal_day', 'deal_amount', 'deposit', 'monthly_rent', 'exclu_use_ar', 'floor'])
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)  // 매매가 없음
      .where('deposit', 'is not', null)  // 보증금 있음
      .where('monthly_rent', '=', 0) // 월세 = 0 = 전세
      .orderBy('deal_year', 'desc')
      .orderBy('deal_month', 'desc')
      .orderBy('deal_day', 'desc')
      .limit(20)
      .execute();
    
    console.log(`📊 전체 전세 거래: ${allJeonseDeals.length}건`);
    
    if (allJeonseDeals.length > 0) {
      console.log('\n📋 최근 전세 거래 (상위 10건):');
      allJeonseDeals.slice(0, 10).forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.apt_nm} - ${deal.deal_year}.${String(deal.deal_month).padStart(2, '0')}.${String(deal.deal_day).padStart(2, '0')} - 보증금 ${deal.deposit}만원, ${deal.exclu_use_ar}㎡, ${deal.floor}층`);
      });
    }
    
    // 2. 84㎡ 근처 전세 거래 확인 (±5㎡ 범위)
    console.log('\n2️⃣ 84㎡ 근처(79~89㎡) 전세 거래 확인');
    const jeonse84Area = await db
      .selectFrom('oi.apt_deal_all')
      .select(['apt_nm', 'deal_year', 'deal_month', 'deal_day', 'deal_amount', 'deposit', 'monthly_rent', 'exclu_use_ar', 'floor'])
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)  // 매매가 없음
      .where('deposit', 'is not', null)  // 보증금 있음
      .where('monthly_rent', '=', 0) // 월세 = 0 = 전세
      .where('exclu_use_ar', '>=', 79)
      .where('exclu_use_ar', '<=', 89)
      .orderBy('deal_year', 'desc')
      .orderBy('deal_month', 'desc')
      .orderBy('deal_day', 'desc')
      .execute();
    
    console.log(`🏠 84㎡ 근처 전세 거래: ${jeonse84Area.length}건`);
    
    if (jeonse84Area.length > 0) {
      console.log('\n📋 84㎡ 근처 전세 거래:');
      jeonse84Area.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.apt_nm} - ${deal.deal_year}.${String(deal.deal_month).padStart(2, '0')}.${String(deal.deal_day).padStart(2, '0')} - 보증금 ${deal.deposit}만원, ${deal.exclu_use_ar}㎡, ${deal.floor}층`);
      });
    }
    
    // 3. 특정 단지별 확인 (7단지, 9단지)
    console.log('\n3️⃣ 특정 단지별 84㎡ 전세 확인');
    
    const targetComplexes = ['마곡엠밸리7단지', '마곡엠밸리9단지'];
    
    for (const complexName of targetComplexes) {
      const complexJeonse = await db
        .selectFrom('oi.apt_deal_trade_raw')
        .select(['dealyear', 'dealmonth', 'dealday', 'dealamount', 'excluusear', 'floor'])
        .where('aptnm', '=', complexName)
        .where('cdealtype', '=', '전세')
        .where('excluusear', '>=', 79)
        .where('excluusear', '<=', 89)
        .orderBy('dealyear', 'desc')
        .orderBy('dealmonth', 'desc')
        .execute();
      
      console.log(`\n🏢 ${complexName} 84㎡ 전세: ${complexJeonse.length}건`);
      if (complexJeonse.length > 0) {
        complexJeonse.forEach((deal, index) => {
          console.log(`  ${index + 1}. ${deal.dealyear}.${String(deal.dealmonth).padStart(2, '0')}.${String(deal.dealday).padStart(2, '0')} - ${deal.dealamount}만원, ${deal.excluusear}㎡, ${deal.floor}층`);
        });
      }
    }
    
    // 4. 거래 유형별 통계 (새로운 로직)
    console.log('\n4️⃣ 마곡엠밸리 거래 유형별 통계 (apt_deal_all)');
    
    // 매매 거래
    const saleStats = await db
      .selectFrom('oi.apt_deal_all')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is not', null)
      .execute();
    
    // 전세 거래
    const jeonseStats = await db
      .selectFrom('oi.apt_deal_all')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .where('deposit', 'is not', null)
      .where('monthly_rent', '=', 0)
      .execute();
    
    // 월세 거래
    const wolseStats = await db
      .selectFrom('oi.apt_deal_all')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .where('deposit', 'is not', null)
      .where('monthly_rent', '>', 0)
      .execute();
    
    console.log('📊 거래 유형별 통계:');
    console.log(`- 매매: ${saleStats[0]?.count || 0}건`);
    console.log(`- 전세: ${jeonseStats[0]?.count || 0}건`);
    console.log(`- 월세: ${wolseStats[0]?.count || 0}건`);
    
    // 5. 모든 면적 종류 확인
    console.log('\n5️⃣ 마곡엠밸리 전세 면적 종류');
    const areaTypes = await db
      .selectFrom('oi.apt_deal_all')
      .select(['exclu_use_ar'])
      .distinct()
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .where('deposit', 'is not', null)
      .where('monthly_rent', '=', 0)
      .orderBy('exclu_use_ar', 'asc')
      .execute();
    
    console.log('📐 전세 거래 면적 종류:');
    console.log(areaTypes.map(a => a.exclu_use_ar + '㎡').join(', '));
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
  }
}

async function main() {
  await testJeonse84Data();
  return true;
}

main().then(() => {
  console.log('\n✅ 전세 84㎡ 데이터 확인 테스트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});