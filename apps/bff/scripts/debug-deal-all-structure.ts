// apt_deal_all 테이블 구조 및 데이터 분석
import "dotenv/config";
import { db } from '../src/lib/db';

async function debugDealAllStructure() {
  console.log('🔍 apt_deal_all 테이블 구조 및 데이터 분석\n');
  
  try {
    // 1. 마곡엠밸리 전체 데이터 샘플 확인
    console.log('1️⃣ 마곡엠밸리 데이터 샘플 (10건)');
    const sampleData = await db
      .selectFrom('oi.apt_deal_all')
      .selectAll()
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .limit(10)
      .execute();
    
    console.log(`📊 샘플 데이터: ${sampleData.length}건`);
    if (sampleData.length > 0) {
      console.log('\n📋 샘플 데이터 구조:');
      sampleData.slice(0, 3).forEach((deal, index) => {
        console.log(`${index + 1}. deal_amount: "${deal.deal_amount}", deposit: "${deal.deposit}", monthly_rent: "${deal.monthly_rent}"`);
        console.log(`   apt_nm: "${deal.apt_nm}", exclu_use_ar: "${deal.exclu_use_ar}", floor: "${deal.floor}"`);
        console.log(`   deal_year: "${deal.deal_year}", deal_month: "${deal.deal_month}", deal_day: "${deal.deal_day}"`);
        console.log('   ─────────');
      });
    }
    
    // 2. deal_amount별 NULL/NOT NULL 분포
    console.log('\n2️⃣ deal_amount NULL/NOT NULL 분포');
    const dealAmountNull = await db
      .selectFrom('oi.apt_deal_all')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .execute();
    
    const dealAmountNotNull = await db
      .selectFrom('oi.apt_deal_all')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is not', null)
      .execute();
    
    console.log(`- deal_amount NULL: ${dealAmountNull[0]?.count || 0}건`);
    console.log(`- deal_amount NOT NULL: ${dealAmountNotNull[0]?.count || 0}건`);
    
    // 3. deposit과 monthly_rent 조합 분석
    console.log('\n3️⃣ deposit과 monthly_rent 조합 분석');
    
    // deal_amount가 NULL인 경우의 deposit/monthly_rent 조합
    const depositMonthlyCombo = await db
      .selectFrom('oi.apt_deal_all')
      .select([
        'deposit',
        'monthly_rent',
        (eb) => eb.fn.count('id').as('count')
      ])
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .groupBy(['deposit', 'monthly_rent'])
      .orderBy('count', 'desc')
      .limit(10)
      .execute();
    
    console.log('deal_amount가 NULL인 경우의 deposit/monthly_rent 조합 (상위 10개):');
    depositMonthlyCombo.forEach((combo, index) => {
      const depositText = combo.deposit === null ? 'NULL' : combo.deposit;
      const monthlyText = combo.monthly_rent === null ? 'NULL' : combo.monthly_rent;
      console.log(`${index + 1}. deposit: ${depositText}, monthly_rent: ${monthlyText} → ${combo.count}건`);
    });
    
    // 4. 실제 전세로 보이는 데이터 확인 (deposit > 0, monthly_rent = 0)
    console.log('\n4️⃣ 전세로 추정되는 데이터 확인 (monthly_rent = 0인 경우)');
    const potentialJeonse = await db
      .selectFrom('oi.apt_deal_all')
      .select(['apt_nm', 'deal_year', 'deal_month', 'deal_day', 'deposit', 'monthly_rent', 'exclu_use_ar'])
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .where('deposit', 'is not', null)
      .where('monthly_rent', '=', 0)  // NULL이 아닌 0인 경우
      .limit(10)
      .execute();
    
    console.log(`monthly_rent = 0인 데이터: ${potentialJeonse.length}건`);
    if (potentialJeonse.length > 0) {
      console.log('📋 전세로 추정되는 데이터:');
      potentialJeonse.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.apt_nm} - ${deal.deal_year}.${String(deal.deal_month).padStart(2, '0')}.${String(deal.deal_day).padStart(2, '0')} - 보증금 ${deal.deposit}만원, ${deal.exclu_use_ar}㎡, 월세 ${deal.monthly_rent}만원`);
      });
    }
    
    // 5. 84㎡ 근처 데이터 확인
    console.log('\n5️⃣ 84㎡ 근처 전세 데이터 확인 (monthly_rent = 0)');
    const jeonse84 = await db
      .selectFrom('oi.apt_deal_all')
      .select(['apt_nm', 'deal_year', 'deal_month', 'deal_day', 'deposit', 'monthly_rent', 'exclu_use_ar'])
      .where('apt_nm', 'like', '%마곡엠밸리%')
      .where('deal_amount', 'is', null)
      .where('deposit', 'is not', null)
      .where('monthly_rent', '=', 0)
      .where('exclu_use_ar', '>=', 79)
      .where('exclu_use_ar', '<=', 89)
      .execute();
    
    console.log(`84㎡ 근처 전세 데이터 (monthly_rent=0): ${jeonse84.length}건`);
    if (jeonse84.length > 0) {
      console.log('📋 84㎡ 근처 전세 데이터:');
      jeonse84.forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.apt_nm} - ${deal.deal_year}.${String(deal.deal_month).padStart(2, '0')}.${String(deal.deal_day).padStart(2, '0')} - 보증금 ${deal.deposit}만원, ${deal.exclu_use_ar}㎡`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ DB 조회 오류:', error.message);
  }
}

async function main() {
  await debugDealAllStructure();
  return true;
}

main().then(() => {
  console.log('\n✅ apt_deal_all 테이블 구조 분석 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 분석 실패:', error);
  process.exit(1);
});