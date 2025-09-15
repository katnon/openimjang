#!/usr/bin/env bun
/**
 * OpenImjang AI 3.0 대화 인텔리전스 시스템 종합 테스트
 * 6개 핵심 매니저를 모두 활용하는 자연어 테스트 시나리오
 */

// 환경변수 명시적 로딩
import 'dotenv/config';
import { config } from 'dotenv';
config();

// OpenAI API Key 확인
console.log('🔑 테스트 스크립트 OpenAI API Key 확인:', !!process.env.OPENAI_API_KEY);
console.log('🔑 테스트 스크립트 OpenAI API Key 길이:', process.env.OPENAI_API_KEY?.length || 0);

interface TestScenario {
  name: string;
  userType: 'first_buyer' | 'investor' | 'relocator' | 'upgrader' | 'explorer';
  emotionalState: 'excitement' | 'anxiety' | 'frustration' | 'confidence' | 'uncertainty' | 'satisfaction' | 'impatience' | 'calm';
  journeyStage: 'awareness' | 'research' | 'evaluation' | 'decision' | 'action' | 'post_decision';
  messages: string[];
  expectedManagers: string[];
  description: string;
}

const testScenarios: TestScenario[] = [
  {
    name: "첫 구매자 - 불안한 첫 집 구매 상담",
    userType: 'first_buyer',
    emotionalState: 'anxiety',
    journeyStage: 'awareness',
    messages: [
      "안녕하세요... 집을 처음 사려고 하는데 너무 어려워서요.",
      "잠실 근처에서 전세로 살고 있는데 이제 내 집을 갖고 싶어요.",
      "하지만 뭘 어떻게 시작해야 할지 모르겠어요.",
      "예산은 5억 정도 생각하고 있는데... 이게 맞나요?",
      "주변에서 집값이 떨어진다고 하니까 더 불안해져요."
    ],
    expectedManagers: ['ConversationContextTracker', 'EmotionalContextAnalyzer', 'DialogueStrategyEngine', 'NaturalFlowManager', 'UserJourneyOptimizer'],
    description: "불안한 첫 구매자의 초기 상담 - 감정 분석과 여정 최적화가 핵심"
  },

  {
    name: "투자자 - 수익성 중심 다중 물건 비교",
    userType: 'investor',
    emotionalState: 'confidence',
    journeyStage: 'evaluation',
    messages: [
      "투자용 아파트를 찾고 있습니다.",
      "강남, 서초, 송파 이 3군데에서 수익률 좋은 곳 찾아주세요.",
      "2-3억 사이에서 전세 수익률 4% 이상 나오는 곳이요.",
      "래미안이나 푸르지오 같은 브랜드 선호합니다.",
      "동시에 3-4개 단지 비교 분석해주실 수 있나요?",
      "각각의 향후 5년 전망도 궁금해요."
    ],
    expectedManagers: ['DialogueStrategyEngine', 'MultiTurnConversationManager', 'ConversationContextTracker', 'UserJourneyOptimizer'],
    description: "자신감 있는 투자자의 복잡한 다중 비교 요청 - 다중 턴 처리가 핵심"
  },

  {
    name: "이사족 - 실용적 조건 중심 빠른 결정",
    userType: 'relocator',
    emotionalState: 'impatience',
    journeyStage: 'decision',
    messages: [
      "직장 때문에 분당으로 이사해야 해서요.",
      "지금 마포에 살고 있는데 출퇴근이 너무 힘들어서요.",
      "아이가 초등학교 2학년이라서 학군도 중요하고요.",
      "분당선 역 근처에서 도보 10분 이내, 34평 이상으로요.",
      "빨리 결정해야 해서 이번 주 안에 계약하고 싶어요.",
      "너무 급하네요... 혹시 지금 당장 볼 수 있는 매물 있나요?"
    ],
    expectedManagers: ['EmotionalContextAnalyzer', 'DialogueStrategyEngine', 'NaturalFlowManager', 'UserJourneyOptimizer'],
    description: "조급한 이사자의 빠른 결정 요구 - 감정 적응과 자연 플로우가 핵심"
  },

  {
    name: "업그레이더 - 현재 대비 개선점 중심",
    userType: 'upgrader',
    emotionalState: 'satisfaction',
    journeyStage: 'research',
    messages: [
      "지금 아파트에서 조금 더 좋은 곳으로 옮기려고 해요.",
      "현재는 노원구 중계동 32평에 살고 있어요.",
      "애들이 커서 조금 더 넓은 곳이 필요해졌거든요.",
      "같은 지역에서 40평대로 넓혀서 이사하고 싶어요.",
      "층수는 지금보다 높았으면 좋겠고, 남향이었으면 해요.",
      "지금 집 팔고 갈아타려면 얼마나 더 필요할까요?"
    ],
    expectedManagers: ['DialogueStrategyEngine', 'ConversationContextTracker', 'NaturalFlowManager', 'UserJourneyOptimizer'],
    description: "만족스러운 업그레이더의 개선점 중심 검색 - 전략 엔진과 여정 최적화"
  },

  {
    name: "탐색자 - 여러 옵션 열린 마음",
    userType: 'explorer',
    emotionalState: 'excitement',
    journeyStage: 'research',
    messages: [
      "이제 막 집 알아보기 시작했어요!",
      "서울 어디든 상관없이 좋은 곳 추천해주세요.",
      "신혼집으로 쓸 거라서 신축이나 준신축이면 좋겠어요.",
      "예산은... 음... 아직 정확히 정하지 않았는데요.",
      "일단 여러 지역 둘러보면서 감을 잡고 싶어요.",
      "강남도 보고, 마용성 쪽도 보고, 분당도 보고 싶어요!",
      "각 지역 특징이랑 장단점도 알려주세요."
    ],
    expectedManagers: ['ConversationContextTracker', 'DialogueStrategyEngine', 'NaturalFlowManager', 'UserJourneyOptimizer', 'EmotionalContextAnalyzer'],
    description: "흥미진진한 탐색자의 열린 마음 상담 - 모든 매니저 균형있게 활용"
  },

  {
    name: "좌절한 재구매자 - 실패 경험 후 재도전",
    userType: 'first_buyer',
    emotionalState: 'frustration',
    journeyStage: 'awareness',
    messages: [
      "하... 집 사는 게 이렇게 어려운 줄 몰랐어요.",
      "작년에 계약한 게 무산됐어서 다시 찾고 있어요.",
      "그때 은마아파트 알아봤는데 가격이 너무 올라서 포기했거든요.",
      "이번엔 정말 신중하게 하고 싶은데 또 실수할까 봐 무서워요.",
      "아무래도 전문가 도움이 필요할 것 같아요.",
      "혹시 제가 놓치고 있는 부분이 있을까요?"
    ],
    expectedManagers: ['EmotionalContextAnalyzer', 'NaturalFlowManager', 'DialogueStrategyEngine', 'ConversationContextTracker'],
    description: "좌절한 재구매자 - 감정 분석과 자연스러운 상담이 최우선"
  },

  {
    name: "확신에 찬 재투자자 - 구체적 실행 단계",
    userType: 'investor',
    emotionalState: 'confidence',
    journeyStage: 'action',
    messages: [
      "3년 전에 목동 아파트 투자해서 2억 수익 봤어요.",
      "이번에는 더 큰 건으로 해보려고 합니다.",
      "강남권에서 10억 내외로 생각하고 있어요.",
      "이미 몇 군데 봐놨는데 반포래미안이 괜찮더라고요.",
      "계약 전에 마지막으로 실거래가 한 번 더 확인하고 싶어요.",
      "내일 계약할 예정인데 혹시 놓친 리스크 있을까요?"
    ],
    expectedManagers: ['DialogueStrategyEngine', 'UserJourneyOptimizer', 'ConversationContextTracker', 'MultiTurnConversationManager'],
    description: "확신에 찬 재투자자의 최종 검증 - 여정 최적화와 전략적 조언"
  },

  {
    name: "복잡한 다가구 상황 - 다중 조건 동시 고려",
    userType: 'relocator',
    emotionalState: 'uncertainty',
    journeyStage: 'evaluation',
    messages: [
      "상황이 좀 복잡해서요... 천천히 설명드릴게요.",
      "저는 직장 때문에 판교로 이사해야 하고,",
      "아내는 강남에서 일해서 둘 다 출퇴근 편한 곳을 찾아야 해요.",
      "게다가 시어머님도 함께 사시게 될 것 같아서",
      "방 3개 이상에 엘리베이터 있는 곳이어야 하고요.",
      "애도 둘이라서 학군도 좋아야 하고...",
      "예산은 전세로 8억 정도 생각하고 있는데 가능할까요?",
      "너무 조건이 많나요?"
    ],
    expectedManagers: ['MultiTurnConversationManager', 'NaturalFlowManager', 'EmotionalContextAnalyzer', 'ConversationContextTracker', 'DialogueStrategyEngine'],
    description: "복잡한 다가구 상황 - 다중 턴 처리와 불확실성 감정 관리가 핵심"
  }
];

// 테스트 실행 함수
async function runAI3ComprehensiveTest() {
  console.log(`
🤖 OpenImjang AI 3.0 대화 인텔리전스 시스템 종합 테스트
============================================================
총 ${testScenarios.length}개 시나리오, 6개 핵심 매니저 전체 검증
`);

  const baseUrl = 'http://localhost:8787';
  let totalTests = 0;
  let successfulTests = 0;
  let managerUsageStats: Record<string, number> = {};

  for (const scenario of testScenarios) {
    console.log(`\n📋 시나리오: ${scenario.name}`);
    console.log(`👤 사용자 유형: ${scenario.userType} | 😊 감정: ${scenario.emotionalState} | 🛣️ 여정: ${scenario.journeyStage}`);
    console.log(`📝 설명: ${scenario.description}`);
    console.log(`🎯 예상 매니저: ${scenario.expectedManagers.join(', ')}`);
    console.log(`\n--- 대화 시작 ---`);

    let sessionId: string | undefined;
    let conversationSuccess = true;
    
    for (let i = 0; i < scenario.messages.length; i++) {
      const message = scenario.messages[i];
      console.log(`\n👤 사용자: ${message}`);
      
      totalTests++;
      
      try {
        const response = await fetch(`${baseUrl}/api/ai/test-lifecycle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            sessionId: sessionId,
            testContext: {
              expectedUserType: scenario.userType,
              expectedEmotion: scenario.emotionalState,
              expectedJourneyStage: scenario.journeyStage,
              scenarioName: scenario.name,
              messageIndex: i + 1,
              totalMessages: scenario.messages.length
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        // 세션 ID 저장
        if (!sessionId && result.sessionId) {
          sessionId = result.sessionId;
        }

        console.log(`🤖 AI: ${result.reply}`);
        
        // AI 3.0 메타데이터 검증
        if (result.metadata) {
          console.log(`\n📊 AI 3.0 메타데이터:`);
          
          if (result.metadata.conversationIntelligence) {
            console.log(`✅ 대화 인텔리전스: 활성화`);
          }
          
          if (result.metadata.userProfile) {
            console.log(`👤 감지된 사용자 유형: ${result.metadata.userProfile}`);
          }
          
          if (result.metadata.emotionalState) {
            console.log(`😊 감지된 감정: ${result.metadata.emotionalState}`);
          }
          
          if (result.metadata.journeyStage) {
            console.log(`🛣️ 여정 단계: ${result.metadata.journeyStage}`);
          }
          
          if (result.metadata.naturalFlowUsed) {
            console.log(`🌊 자연스러운 플로우: 사용됨`);
            managerUsageStats['NaturalFlowManager'] = (managerUsageStats['NaturalFlowManager'] || 0) + 1;
          }
          
          if (result.metadata.empathicResponse) {
            console.log(`💝 공감적 응답: 생성됨`);
            managerUsageStats['EmotionalContextAnalyzer'] = (managerUsageStats['EmotionalContextAnalyzer'] || 0) + 1;
          }
          
          // 처리 단계별 AI 3.0 사용 통계
          if (result.metadata.processingSteps) {
            result.metadata.processingSteps.forEach((step: any) => {
              if (step.ai3Enhanced) {
                const managerName = step.step.split('_').map((s: string) => 
                  s.charAt(0).toUpperCase() + s.slice(1)
                ).join('') + 'Manager';
                managerUsageStats[managerName] = (managerUsageStats[managerName] || 0) + 1;
              }
            });
          }
        }
        
        successfulTests++;
        
        // 메시지 간 자연스러운 간격
        if (i < scenario.messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ 테스트 실패: ${error}`);
        conversationSuccess = false;
        break;
      }
    }
    
    console.log(`\n--- 대화 종료 ---`);
    console.log(`${conversationSuccess ? '✅' : '❌'} 시나리오 ${conversationSuccess ? '성공' : '실패'}`);
    
    // 시나리오 간 간격
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 최종 결과 출력
  console.log(`\n
🎯 OpenImjang AI 3.0 종합 테스트 결과
=====================================
📊 전체 테스트: ${totalTests}개 메시지
✅ 성공한 테스트: ${successfulTests}개 (${((successfulTests/totalTests)*100).toFixed(1)}%)
❌ 실패한 테스트: ${totalTests - successfulTests}개

🧠 AI 3.0 매니저 활용 통계:
`);

  Object.entries(managerUsageStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([manager, count]) => {
      console.log(`  ${manager}: ${count}회 사용`);
    });

  const expectedManagers = ['ConversationContextTracker', 'DialogueStrategyEngine', 'NaturalFlowManager', 'UserJourneyOptimizer', 'MultiTurnConversationManager', 'EmotionalContextAnalyzer'];
  const usedManagers = Object.keys(managerUsageStats);
  const missingManagers = expectedManagers.filter(m => !usedManagers.includes(m));

  if (missingManagers.length > 0) {
    console.log(`\n⚠️ 사용되지 않은 매니저: ${missingManagers.join(', ')}`);
  } else {
    console.log(`\n🎉 모든 AI 3.0 매니저가 성공적으로 활용되었습니다!`);
  }

  console.log(`\n🔍 테스트 조건별 분석:`);
  const userTypes = [...new Set(testScenarios.map(s => s.userType))];
  const emotions = [...new Set(testScenarios.map(s => s.emotionalState))];
  const journeys = [...new Set(testScenarios.map(s => s.journeyStage))];
  
  console.log(`👥 사용자 유형: ${userTypes.length}개 (${userTypes.join(', ')})`);
  console.log(`😊 감정 상태: ${emotions.length}개 (${emotions.join(', ')})`);
  console.log(`🛣️ 여정 단계: ${journeys.length}개 (${journeys.join(', ')})`);
  
  return {
    totalTests,
    successfulTests,
    successRate: (successfulTests/totalTests)*100,
    managerUsageStats,
    scenariosCovered: testScenarios.length,
    allManagersUsed: missingManagers.length === 0
  };
}

// 메인 실행
if (import.meta.main) {
  console.log('🚀 OpenImjang AI 3.0 대화 인텔리전스 테스트 시작...\n');
  
  runAI3ComprehensiveTest()
    .then(results => {
      console.log(`\n✨ 테스트 완료! 성공률: ${results.successRate.toFixed(1)}%`);
      console.log(`🏆 ${results.allManagersUsed ? 'AI 3.0 시스템이 완벽하게 작동합니다!' : 'AI 3.0 시스템에 개선이 필요합니다.'}`);
      process.exit(results.successRate >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 테스트 실행 실패:', error);
      process.exit(1);
    });
}

export { runAI3ComprehensiveTest, testScenarios };