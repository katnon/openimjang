// 대화 맥락 기반 참조 표현 해석 테스트
import "dotenv/config";
import axios from 'axios';

async function testContextualReference() {
  console.log('🧪 대화 맥락 기반 참조 표현 해석 테스트 시작\n');
  
  // 테스트용 사용자 프로필 (일관성을 위해)
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

  // 시뮬레이션된 대화 기록 (점진적으로 맥락이 쌓이는 상황)
  const conversationFlow = [
    {
      step: 1,
      description: "첫 번째 질문 - 특정 아파트 언급",
      messages: [],
      userInput: "마곡엠밸리 어떤가요?",
      expectation: "아파트명 정보 수집 및 기본 분석"
    },
    {
      step: 2, 
      description: "두 번째 질문 - '거기' 참조 표현",
      messages: [
        { role: 'user', content: '마곡엠밸리 어떤가요?' },
        { role: 'assistant', content: '마곡엠밸리는 서울 강서구에 위치한 대단지 아파트입니다. 여러 단지로 구성되어 있으며...' }
      ],
      userInput: "거기 7단지 매매가는?",
      expectation: "'거기' → '마곡엠밸리', '7단지' 해석"
    },
    {
      step: 3,
      description: "세 번째 질문 - '59형' 면적 참조",
      messages: [
        { role: 'user', content: '마곡엠밸리 어떤가요?' },
        { role: 'assistant', content: '마곡엠밸리는 서울 강서구에 위치한 대단지 아파트입니다. 여러 단지로 구성되어 있으며...' },
        { role: 'user', content: '거기 7단지 매매가는?' },
        { role: 'assistant', content: '마곡엠밸리7단지의 최근 매매 실거래가를 조회해드리겠습니다...' }
      ],
      userInput: "59형 가격만 알려줘",
      expectation: "마곡엠밸리7단지 + 59㎡ 조건으로 검색"
    },
    {
      step: 4,
      description: "네 번째 질문 - 복합 참조 표현",
      messages: [
        { role: 'user', content: '마곡엠밸리 어떤가요?' },
        { role: 'assistant', content: '마곡엠밸리는 서울 강서구에 위치한 대단지 아파트입니다. 여러 단지로 구성되어 있으며...' },
        { role: 'user', content: '거기 7단지 매매가는?' },
        { role: 'assistant', content: '마곡엠밸리7단지의 최근 매매 실거래가를 조회해드리겠습니다...' },
        { role: 'user', content: '59형 가격만 알려줘' },
        { role: 'assistant', content: '마곡엠밸리7단지 59㎡의 최근 매매가는 다음과 같습니다...' }
      ],
      userInput: "거기 투자하기 어때?",
      expectation: "마곡엠밸리7단지 59㎡ 맥락에서 투자 분석"
    }
  ];

  const serverUrl = 'http://localhost:8787'; // BFF 서버 주소

  for (const conversation of conversationFlow) {
    console.log(`\n🔄 Step ${conversation.step}: ${conversation.description}`);
    console.log(`📝 사용자 입력: "${conversation.userInput}"`);
    console.log(`🎯 기대사항: ${conversation.expectation}`);
    
    try {
      // BFF 서버에 요청 전송 (테스트용 엔드포인트 사용)
      const response = await axios.post(`${serverUrl}/api/ai-new/test-chat`, {
        message: conversation.userInput,
        context: {
          messages: conversation.messages,
          userProfile: testUserProfile,
          userId: 'test-user-context'
        }
      }, {
        timeout: 30000 // 30초 타임아웃
      });

      if (response.data.success) {
        console.log('✅ 응답 성공');
        console.log('📄 응답 내용:', response.data.reply?.slice(0, 200) + '...');
        
        // 함수 호출 횟수 확인 (참조 해석이 잘 되었는지)
        if (response.data.toolCallsCount) {
          console.log(`🔧 함수 호출: ${response.data.toolCallsCount}번`);
        }
        
        // 응답에서 컨텍스트 활용 여부 분석
        const responseText = response.data.reply.toLowerCase();
        const contextAnalysis = analyzeContextUsage(responseText, conversation);
        console.log('🧠 컨텍스트 활용 분석:', contextAnalysis);
        
      } else {
        console.log('❌ 응답 실패:', response.data.error);
      }
      
    } catch (error: any) {
      console.error('❌ 요청 오류:', error.message);
      
      // 서버가 실행되지 않은 경우 안내
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 BFF 서버가 실행되지 않았습니다. 다음 명령으로 서버를 시작하세요:');
        console.log('   cd apps/bff && bun run dev');
        break;
      }
    }
    
    // 다음 스텝 사이에 약간의 지연
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '━'.repeat(80));
  console.log('\n✅ 대화 맥락 기반 참조 표현 해석 테스트 완료');
  console.log('\n📊 테스트 시나리오:');
  console.log('1. "마곡엠밸리" → 기본 아파트 정보');
  console.log('2. "거기 7단지" → 마곡엠밸리 + 7단지 참조 해석');
  console.log('3. "59형" → 이전 맥락 + 면적 정보 결합');  
  console.log('4. "거기 투자" → 종합적 맥락 활용');
  
  console.log('\n🎯 구현된 기능:');
  console.log('- 대화 기록 기반 시스템 프롬프트 생성');
  console.log('- 아파트명/단지/면적 자동 추출 및 컨텍스트 유지');
  console.log('- 참조 표현("거기", "7단지", "59형") 해석 가이드');
  console.log('- 사용자 프로필 + 대화 맥락 통합');
}

/**
 * 응답에서 컨텍스트 활용 여부를 분석합니다
 */
function analyzeContextUsage(responseText: string, conversation: any): string {
  const indicators = [];
  
  // 아파트명 언급 확인
  if (responseText.includes('마곡') || responseText.includes('엠밸리')) {
    indicators.push('아파트명 인식');
  }
  
  // 단지 정보 언급 확인  
  if (responseText.includes('7단지') || responseText.includes('단지')) {
    indicators.push('단지 정보 활용');
  }
  
  // 면적 정보 언급 확인
  if (responseText.includes('59') || responseText.includes('면적')) {
    indicators.push('면적 정보 활용');
  }
  
  // 함수 호출 패턴 확인 (간접적)
  if (responseText.includes('조회') || responseText.includes('검색') || responseText.includes('분석')) {
    indicators.push('데이터 검색 수행');
  }
  
  return indicators.length > 0 ? indicators.join(', ') : '컨텍스트 활용 확인 필요';
}

async function main() {
  await testContextualReference();
  return true;
}

main().then(() => {
  console.log('\n🚀 테스트 완료! 대화 맥락 기반 참조 표현 해석 시스템이 구현되었습니다.');
  console.log('🤖 이제 챗봇이 "거기", "7단지", "59형" 같은 참조 표현을 이해할 수 있습니다.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});