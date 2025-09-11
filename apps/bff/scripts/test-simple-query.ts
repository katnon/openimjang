// 간단한 거래 데이터 확인
import "dotenv/config";
import { db } from '../src/lib/db';

async function testSimpleQuery() {
  console.log('🔍 마곡엠밸리7단지 거래 데이터 확인\n');
  
  try {
    // 아파트명으로 직접 조회
    const deals = await db
      .selectFrom('oi.apt_deal_trade_raw')
      .select(['dealyear', 'dealmonth', 'dealday', 'dealamount', 'excluusear', 'floor', 'cdealtype'])
      .where('aptnm', '=', '마곡엠밸리7단지')
      .orderBy('dealyear', 'desc')
      .orderBy('dealmonth', 'desc')
      .orderBy('dealday', 'desc')
      .limit(10)
      .execute();
    
    console.log(`📊 총 조회된 거래: ${deals.length}건`);
    
    if (deals.length > 0) {
      console.log('\n📋 최근 거래 10건:');
      deals.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.dealyear}.${String(deal.dealmonth).padStart(2, '0')}.${String(deal.dealday).padStart(2, '0')} - ${deal.dealamount}만원, ${deal.excluusear}㎡, ${deal.floor}층, ${deal.cdealtype}`);
      });
      
      // 매매 거래만 확인
      const buyDeals = deals.filter(d => d.cdealtype === '매매');
      console.log(`\n💰 매매 거래: ${buyDeals.length}건`);
      
      // 59㎡ 근처 확인
      const area59 = deals.filter(d => d.excluusear >= 59 && d.excluusear <= 60);
      console.log(`🏠 59㎡ 근처: ${area59.length}건`);
      
    } else {
      console.log('❌ 거래 데이터가 없습니다.');
    }
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
  }
}

async function main() {
  await testSimpleQuery();
  return true;
}

main().then(() => {
  console.log('\n✅ 간단 쿼리 테스트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});