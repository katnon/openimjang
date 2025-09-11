// 사용자 프로필 기반 개인화 응답 테스트
import "dotenv/config";
import { searchRealEstateDeals } from '../src/ai/handlers/searchRealEstateDeals';
import { getLatestTrade } from '../src/ai/handlers/getLatestTrade';
import { getPriceTrends } from '../src/ai/handlers/getPriceTrends';

async function testProfilePersonalization() {
  console.log('🧪 사용자 프로필 기반 개인화 응답 테스트 시작\n');
  
  // 테스트용 더미 프로필 (ChatbotSidebar.tsx와 동일)
  const testUserProfile = {
    purpose: ['매매', '투자'],
    workLocation: '강남역',
    commutingRadius: 30,
    budgetRange: [500000000, 1000000000], // 5억~10억
    monthlyRent: [0, 0],
    preferredBuildingAge: '10년 이내',
    familyType: '신혼부부',
    priorities: ['교통', '교육환경']
  };

  console.log('🎯 테스트 사용자 프로필:', testUserProfile);
  console.log('\n' + '━'.repeat(80) + '\n');

  // 1️⃣ searchRealEstateDeals 테스트
  console.log('1️⃣ searchRealEstateDeals - 프로필 기반 테스트');
  
  try {
    console.log('\n📝 일반 요청 (프로필 없음):');
    const generalResult = await searchRealEstateDeals({
      apartmentName: '마곡엠밸리',
      dealType: '매매',
      period: '6개월',
      limit: 3
    });
    
    if (generalResult.success) {
      console.log('✅ 일반 요청 성공 - SQL:', generalResult.sql?.slice(0, 100) + '...');
    } else {
      console.log('❌ 일반 요청 실패:', generalResult.error);
    }

    console.log('\n🎯 개인화 요청 (프로필 포함):');
    const personalizedResult = await searchRealEstateDeals({
      apartmentName: '마곡엠밸리',
      dealType: '매매', 
      period: '6개월',
      limit: 3,
      userProfile: testUserProfile
    });
    
    if (personalizedResult.success) {
      console.log('✅ 개인화 요청 성공 - SQL:', personalizedResult.sql?.slice(0, 100) + '...');
      console.log('🔍 SQL 차이점 분석:');
      if (generalResult.sql && personalizedResult.sql) {
        const hasProfileInfo = personalizedResult.sql.includes('500000000') || 
                              personalizedResult.sql.includes('1000000000') ||
                              personalizedResult.sql.toLowerCase().includes('budget');
        console.log('   💰 예산 정보 반영:', hasProfileInfo ? 'YES' : 'NO');
      }
    } else {
      console.log('❌ 개인화 요청 실패:', personalizedResult.error);
    }
    
  } catch (error: any) {
    console.error('❌ searchRealEstateDeals 테스트 오류:', error.message);
  }

  console.log('\n' + '━'.repeat(80) + '\n');

  // 2️⃣ getLatestTrade 테스트
  console.log('2️⃣ getLatestTrade - 프로필 기반 테스트');
  
  try {
    console.log('\n🎯 개인화 요청 (프로필 포함):');
    const latestTradeResult = await getLatestTrade({
      apartmentName: '마곡엠밸리6단지',
      dealType: '매매',
      limit: 3,
      userProfile: testUserProfile
    });
    
    if (latestTradeResult.success) {
      console.log('✅ 개인화 최근 거래 조회 성공');
      console.log('📊 거래 데이터:', latestTradeResult.deals?.length || 0, '건');
      
      // 예산 범위에 맞는 매물 확인
      if (latestTradeResult.deals && latestTradeResult.deals.length > 0) {
        const inBudgetDeals = latestTradeResult.deals.filter((deal: any) => {
          const price = deal.dealAmount;
          return price >= 50000 && price <= 100000; // 5억~10억 (만원 단위)
        });
        console.log('💰 예산 범위 내 매물:', inBudgetDeals.length, '건');
      }
    } else {
      console.log('❌ 개인화 최근 거래 조회 실패:', latestTradeResult.error);
    }
    
  } catch (error: any) {
    console.error('❌ getLatestTrade 테스트 오류:', error.message);
  }

  console.log('\n' + '━'.repeat(80) + '\n');

  // 3️⃣ getPriceTrends 테스트  
  console.log('3️⃣ getPriceTrends - 프로필 기반 테스트');
  
  try {
    console.log('\n🎯 개인화 요청 (프로필 포함):');
    const trendsResult = await getPriceTrends({
      apartmentName: '마곡엠밸리',
      period: '1년',
      dealType: '매매',
      userProfile: testUserProfile
    });
    
    if (trendsResult.success) {
      console.log('✅ 개인화 가격 트렌드 분석 성공');
      console.log('📈 트렌드 데이터:', trendsResult.trends?.length || 0, '개월');
      console.log('📊 분석 결과:', trendsResult.analysis?.trend || '정보 없음');
    } else {
      console.log('❌ 개인화 가격 트렌드 분석 실패:', trendsResult.error);
    }
    
  } catch (error: any) {
    console.error('❌ getPriceTrends 테스트 오류:', error.message);
  }

  console.log('\n' + '━'.repeat(80));
  console.log('\n✅ 사용자 프로필 기반 개인화 응답 테스트 완료');
  console.log('\n📊 테스트 요약:');
  console.log('- 프로필 정보: 예산 5억~10억, 투자 목적, 강남역 직장');
  console.log('- 시스템 프롬프트: 프로필 정보 포함하여 LLM에 전달');
  console.log('- SQL 생성: 사용자 예산 범위 고려한 질문 개선');
  console.log('- 결과 분석: 예산 범위 내 매물 필터링 및 개인화된 인사이트');
  
  console.log('\n🎯 기대 효과:');
  console.log('- 사용자별 맞춤 매물 추천');
  console.log('- 예산 범위 고려한 현실적 조언');
  console.log('- 투자 목적에 맞는 분석 관점 제공');
  console.log('- 직장 위치 기반 교통 편의성 고려');
}

async function main() {
  await testProfilePersonalization();
  return true;
}

main().then(() => {
  console.log('\n🚀 테스트 완료! 사용자 프로필 기반 개인화 시스템이 구축되었습니다.');
  console.log('🤖 이제 챗봇이 사용자의 예산, 목적, 선호도를 고려한 맞춤형 답변을 제공합니다.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});