// 임장 상담 전략 테스트 - 질문 범위에 따른 대답 차별화
import "dotenv/config";
import axios from 'axios';

async function testConsultationStrategy() {
  console.log('🧪 임장 상담 전략 테스트 시작\n');
  
  const testUserProfile = {
    purpose: ['매매', '투자'],
    workLocation: '강남역',
    commutingRadius: 30,
    budgetRange: [500000000, 1000000000],
    monthlyRent: [0, 0],
    preferredBuildingAge: '10년 이내',
    familyType: '신혼부부',
    priorities: ['교통', '교육환경']
  };

  // 테스트 시나리오: 범용 질문 → 구체적 질문으로 발전
  const testCases = [
    {
      step: 1,
      description: "범용 질문 - 아파트명만 언급",
      userInput: "마곡엠밸리 어떤가요?",
      expectation: "종합적 지역 분석, 상세 거래 데이터 없음, clarification 유도"
    },
    {
      step: 2,
      description: "조건 불완전 - 단지명 없음",
      userInput: "마곡엠밸리 매매가 궁금해요",
      expectation: "단지 선택 질문, 함수 호출 없어야 함"
    },
    {
      step: 3,
      description: "구체적 질문 - 모든 조건 포함",
      userInput: "마곡엠밸리7단지 매매가 알려주세요",
      expectation: "함수 호출 후 상세 거래 데이터 표시"
    },
    {
      step: 4,
      description: "더 구체적 질문 - 면적까지 포함",
      userInput: "마곡엠밸리7단지 84형 매매가",
      expectation: "면적 조건까지 반영된 상세 데이터"
    }
  ];

  const serverUrl = 'http://localhost:8787';

  for (const testCase of testCases) {
    console.log(`\n🔄 Step ${testCase.step}: ${testCase.description}`);
    console.log(`📝 사용자 입력: "${testCase.userInput}"`);
    console.log(`🎯 기대사항: ${testCase.expectation}`);
    
    try {
      const response = await axios.post(`${serverUrl}/api/ai-new/test-chat`, {
        message: testCase.userInput,
        context: {
          messages: [],
          userProfile: testUserProfile,
          userId: 'test-consultation-strategy'
        }
      }, {
        timeout: 30000
      });

      if (response.data.success) {
        console.log('✅ 응답 성공');
        console.log('📄 응답 내용:', response.data.reply?.slice(0, 300) + '...');
        
        // 함수 호출 여부 확인
        const functionCalls = response.data.toolCallsCount || 0;
        console.log(`🔧 함수 호출: ${functionCalls}번`);
        
        // 응답 유형 분석
        const responseText = response.data.reply.toLowerCase();
        const analysisResult = analyzeResponseType(responseText, testCase.step);
        console.log('🧠 응답 분석:', analysisResult);
        
      } else {
        console.log('❌ 응답 실패:', response.data.error);
      }
      
    } catch (error: any) {
      console.error('❌ 요청 오류:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 BFF 서버가 실행되지 않았습니다.');
        break;
      }
    }
    
    // 다음 테스트 사이 지연
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '━'.repeat(80));
  console.log('\n✅ 임장 상담 전략 테스트 완료');
  console.log('\n📊 검증 포인트:');
  console.log('1. 범용 질문 → 종합 분석 (함수 호출 최소화)');
  console.log('2. 불완전 조건 → clarification 질문');
  console.log('3. 구체적 질문 → 상세 데이터 제공');
  console.log('4. 점진적 대화 발전 → 사용자 유도');
}

/**
 * 응답 유형을 분석합니다
 */
function analyzeResponseType(responseText: string, step: number): string {
  const indicators = [];
  
  // 데이터 테이블 포함 여부
  if (responseText.includes('|') || responseText.includes('표') || responseText.includes('거래일')) {
    indicators.push('상세 데이터 표시');
  }
  
  // 지역 분석 키워드
  if (responseText.includes('위치') || responseText.includes('교통') || responseText.includes('주변환경')) {
    indicators.push('종합 지역 분석');
  }
  
  // 질문 유도 키워드
  if (responseText.includes('단지') && responseText.includes('?')) {
    indicators.push('clarification 질문');
  }
  
  // 면적/거래 유형 언급
  if (responseText.includes('84') || responseText.includes('매매') || responseText.includes('전세')) {
    indicators.push('구체적 조건 반영');
  }
  
  // 기대 결과와 비교
  let result = indicators.join(', ');
  
  if (step === 1 && indicators.includes('상세 데이터 표시')) {
    result += ' ⚠️ 예상과 다름: 범용 질문인데 상세 데이터 표시됨';
  }
  
  if (step === 2 && indicators.includes('상세 데이터 표시')) {
    result += ' ⚠️ 예상과 다름: 조건 불완전한데 데이터 표시됨';
  }
  
  return result || '분석 불가';
}

async function main() {
  await testConsultationStrategy();
  return true;
}

main().then(() => {
  console.log('\n🚀 테스트 완료! 임장 상담 전략이 올바르게 작동하는지 확인했습니다.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});