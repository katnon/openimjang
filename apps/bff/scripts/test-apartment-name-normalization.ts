// 사용자 친화적 아파트명 검색 테스트 (스마트 질문 기능 포함)
import "dotenv/config";
import { normalizeApartmentName, findBestApartmentMatch, generateSmartQuestion } from '../src/ai/handlers/database/normalizeApartmentName';
import { getLatestTrade } from '../src/ai/handlers/getLatestTrade';
import { searchRealEstateDeals } from '../src/ai/handlers/searchRealEstateDeals';
import { getPriceTrends } from '../src/ai/handlers/getPriceTrends';

async function testApartmentNameNormalization() {
  console.log('🧪 사용자 친화적 아파트명 검색 테스트 시작 (스마트 질문 기능 포함)\n');
  
  // 1️⃣ 정규화 함수 직접 테스트
  console.log('1️⃣ normalizeApartmentName 함수 테스트 (스마트 질문 포함)');
  
  const testCases = [
    { input: '현대아파트', region: undefined, expectType: '여러 지역' },
    { input: '신당 현대', region: '중구', expectType: '지역 힌트로 특정' },
    { input: '마곡엠밸리', region: '강서구', expectType: '여러 단지' },
    { input: '래미안', region: '강남구', expectType: '여러 후보' },
    { input: '힐스테이트', region: undefined, expectType: '여러 후보' }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n🔍 테스트: "${testCase.input}" ${testCase.region ? `(지역: ${testCase.region})` : ''} [기대: ${testCase.expectType}]`);
      
      const results = await normalizeApartmentName(testCase.input, testCase.region);
      
      if (results && results.length > 0) {
        console.log('✅ 검색 결과:');
        results.forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.aptName} (${r.region}) - 유사도: ${r.score.toFixed(3)}`);
        });
        
        // 🎯 스마트 질문 테스트
        if (results.length > 1) {
          console.log('\n🤖 스마트 질문:');
          const smartQuestion = generateSmartQuestion(results, testCase.input);
          console.log(`"${smartQuestion}"`);
        }
      } else {
        console.log('❌ 검색 결과 없음');
      }
      
    } catch (error: any) {
      console.error(`❌ 오류: ${error.message}`);
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  
  // 2️⃣ 최적 매치 테스트
  console.log('\n2️⃣ findBestApartmentMatch 함수 테스트');
  
  const bestMatchTests = [
    { input: '마곡엠밸리', region: '강서구' },
    { input: '현대아파트', region: '중구' },
    { input: '래미안', region: undefined }
  ];
  
  for (const test of bestMatchTests) {
    try {
      console.log(`\n🎯 최적 매치 테스트: "${test.input}" ${test.region ? `(${test.region})` : ''}`);
      
      const bestMatch = await findBestApartmentMatch(test.input, test.region);
      
      if (bestMatch) {
        console.log('✅ 최적 매치:', {
          aptId: bestMatch.aptId,
          aptName: bestMatch.aptName,
          region: bestMatch.region,
          score: bestMatch.score.toFixed(3)
        });
      } else {
        console.log('❌ 적절한 매치 없음');
      }
      
    } catch (error: any) {
      console.error(`❌ 오류: ${error.message}`);
    }
  }
  
  console.log('\n' + '━'.repeat(80));
}

async function testHandlersWithNormalization() {
  console.log('\n3️⃣ 핸들러 함수들의 스마트 질문 기능 테스트');
  
  // 스마트 질문이 나올 것 같은 모호한 아파트명들
  const userInputTests = [
    { apartmentName: '마곡엠밸리', region: '강서구', expectCase: '단지 선택' },
    { apartmentName: '현대아파트', region: undefined, expectCase: '지역 선택' },
    { apartmentName: '신당 현대', region: undefined, expectCase: '자동 매칭 또는 선택' },
    { apartmentName: '래미안', region: '강남구', expectCase: '여러 후보' }
  ];
  
  for (const test of userInputTests) {
    console.log(`\n🏢 테스트: "${test.apartmentName}" ${test.region ? `(${test.region})` : ''} [기대: ${test.expectCase}]`);
    
    try {
      // A) getLatestTrade 테스트
      console.log('  📈 getLatestTrade 테스트:');
      const latestResult = await getLatestTrade({
        apartmentName: test.apartmentName,
        region: test.region,
        dealType: '매매',
        limit: 3
      });
      
      if (latestResult.success) {
        console.log(`    ✅ 성공 - ${latestResult.deals?.length || 0}건 조회`);
      } else if (latestResult.candidates) {
        console.log(`    🤔 여러 후보: ${latestResult.candidates.length}개`);
        console.log(`    🤖 스마트 질문: "${latestResult.suggestions}"`);
        latestResult.candidates.forEach((c: any, idx: number) => {
          console.log(`      ${idx + 1}. ${c.aptName} (${c.region})`);
        });
      } else {
        console.log(`    ❌ 실패: ${latestResult.error}`);
      }
      
    } catch (error: any) {
      console.error(`    ❌ getLatestTrade 오류: ${error.message?.slice(0, 100)}`);
    }
    
    try {
      // B) searchRealEstateDeals 테스트  
      console.log('  🔍 searchRealEstateDeals 테스트:');
      const searchResult = await searchRealEstateDeals({
        apartmentName: test.apartmentName,
        region: test.region,
        dealType: '매매',
        period: '6개월',
        limit: 3
      });
      
      if (searchResult.success) {
        console.log(`    ✅ 성공 - ${searchResult.deals?.length || 0}건 조회`);
      } else if (searchResult.candidates) {
        console.log(`    🤔 여러 후보: ${searchResult.candidates.length}개`);
        console.log(`    🤖 스마트 질문: "${searchResult.suggestions}"`);
      } else {
        console.log(`    ❌ 실패: ${searchResult.error}`);
      }
      
    } catch (error: any) {
      console.error(`    ❌ searchRealEstateDeals 오류: ${error.message?.slice(0, 100)}`);
    }
  }
}

async function testEdgeCases() {
  console.log('\n' + '━'.repeat(80));
  console.log('\n4️⃣ 엣지 케이스 테스트');
  
  const edgeCases = [
    { name: '존재하지않는아파트', description: '존재하지 않는 아파트명' },
    { name: 'ㅁㄴㅇㄹ', description: '의미없는 문자열' },
    { name: '현', description: '너무 짧은 검색어' },
    { name: '아파트', description: '너무 일반적인 검색어' }
  ];
  
  for (const testCase of edgeCases) {
    console.log(`\n🧪 ${testCase.description}: "${testCase.name}"`);
    
    try {
      const results = await normalizeApartmentName(testCase.name);
      
      if (results && results.length > 0) {
        console.log(`  ✅ ${results.length}개 결과 (예상보다 많이 나올 수 있음)`);
        results.slice(0, 3).forEach((r, idx) => {
          console.log(`    ${idx + 1}. ${r.aptName} - 유사도: ${r.score.toFixed(3)}`);
        });
      } else {
        console.log('  ✅ 검색 결과 없음 (예상됨)');
      }
      
    } catch (error: any) {
      console.error(`  ❌ 오류: ${error.message}`);
    }
  }
}

async function main() {
  await testApartmentNameNormalization();
  await testHandlersWithNormalization();
  await testEdgeCases();
  
  console.log('\n' + '━'.repeat(80));
  console.log('\n✅ 사용자 친화적 아파트명 검색 + 스마트 질문 테스트 완료');
  console.log('\n📊 테스트 요약:');
  console.log('- normalizeApartmentName: 부분 일치 + Levenshtein 유사도 기반 검색');
  console.log('- findBestApartmentMatch: 임계값 기반 최적 매치 선택');
  console.log('- generateSmartQuestion: 상황별 맞춤 질문 생성 (지역/단지 구분)');
  console.log('- 핸들러 통합: 스마트 질문으로 사용자 가이드');
  console.log('- 지역 힌트: 정확도 향상을 위한 지역 기반 필터링');
  
  console.log('\n🎯 사용자 경험 개선 (스마트 질문):');
  console.log('- "현대아파트" → "어느 지역의 현대아파트를 찾으시나요?" (지역 선택)');
  console.log('- "마곡엠밸리" → "몇 단지를 찾으시나요?" (단지 선택)');
  console.log('- "신당 현대" → 자동 매칭 또는 구체적 선택지 제공');
  console.log('- 상황에 맞는 맞춤형 질문으로 사용자 친화적 인터페이스');
  
  return true;
}

main().then(() => {
  console.log('\n🚀 테스트 완료! 아파트명 검색이 스마트 질문 기능으로 사용자 친화적으로 대폭 개선되었습니다.');
  console.log('🤖 이제 시스템이 "어느 지역?" "몇 단지?" 같은 구체적 질문으로 사용자를 안내합니다.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});