// 플래너 시스템 테스트 스크립트
import { defaultPlanner, PlanContext } from '../src/ai/planner';

async function testPlanner() {
    console.log('🎯 플래너 시스템 테스트 시작\n');

    // 테스트 케이스 1: 불완전한 정보 - Clarify 액션 예상
    const testCase1: PlanContext = {
        question: "마곡엠밸리 알려줘",
        intent: { category: 'general', confidence: 0, entities: [], actions: [] },
        slots: {
            apartmentName: "마곡엠밸리"
            // dealType, area 등이 누락됨
        },
        userProfile: undefined,
        sessionHistory: {
            messageCount: 0,
            lastQuestionTypes: [],
            completedActions: [],
            failedActions: []
        },
        capabilities: {
            availableTools: ['searchRealEstate', 'calculateStats'],
            dataAccess: { realEstate: true, POI: false, market: true, geographic: true },
            analysisFeatures: { statistics: true, visualization: false, prediction: false, comparison: true },
            externalServices: { webSearch: false, maps: true, weather: false }
        },
        constraints: {
            maxActions: 10,
            maxDuration: 30000,
            budgetLimits: { apiCalls: 50, computeTime: 10000 },
            userPermissions: ['basic', 'data_access'],
            rateLimit: { actionsPerMinute: 20, dataQueryLimit: 10 }
        }
    };

    console.log('📋 테스트 케이스 1: 불완전한 정보 (Clarify 예상)');
    try {
        const plan1 = await defaultPlanner.createPlan(testCase1);
        console.log('✅ 플랜 생성 성공:', {
            planId: plan1.id,
            totalSteps: plan1.totalSteps,
            actions: plan1.actions.map(a => ({ type: a.type, name: a.name, reason: a.reason }))
        });

        // Clarify 액션이 포함되어 있는지 확인
        const hasClarify = plan1.actions.some(a => a.type === 'clarify');
        console.log(hasClarify ? '✅ Clarify 액션 포함됨' : '⚠️ Clarify 액션 없음');
    } catch (error: any) {
        console.error('❌ 테스트 케이스 1 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 2: 완전한 정보 - 바로 검색 가능
    const testCase2: PlanContext = {
        question: "마곡엠밸리7단지 84형 매매가 알려줘",
        intent: { category: 'general', confidence: 0, entities: [], actions: [] },
        slots: {
            apartmentName: "마곡엠밸리7단지",
            dealType: "매매",
            area: 84
        },
        userProfile: { purpose: ['매매'], budgetRange: [30000, 50000] },
        sessionHistory: {
            messageCount: 0,
            lastQuestionTypes: [],
            completedActions: [],
            failedActions: []
        },
        capabilities: {
            availableTools: ['searchRealEstate', 'calculateStats', 'summarize'],
            dataAccess: { realEstate: true, POI: true, market: true, geographic: true },
            analysisFeatures: { statistics: true, visualization: true, prediction: false, comparison: true },
            externalServices: { webSearch: false, maps: true, weather: false }
        },
        constraints: {
            maxActions: 10,
            maxDuration: 30000,
            budgetLimits: { apiCalls: 50, computeTime: 10000 },
            userPermissions: ['basic', 'data_access', 'analysis'],
            rateLimit: { actionsPerMinute: 20, dataQueryLimit: 10 }
        }
    };

    console.log('📋 테스트 케이스 2: 완전한 정보 (직접 검색 예상)');
    try {
        const plan2 = await defaultPlanner.createPlan(testCase2);
        console.log('✅ 플랜 생성 성공:', {
            planId: plan2.id,
            totalSteps: plan2.totalSteps,
            actions: plan2.actions.map(a => ({ type: a.type, name: a.name, reason: a.reason }))
        });

        // 검색 액션이 포함되어 있는지 확인
        const hasSearch = plan2.actions.some(a => a.type === 'searchRealEstate');
        console.log(hasSearch ? '✅ 검색 액션 포함됨' : '⚠️ 검색 액션 없음');

        // 요약 액션이 마지막에 있는지 확인
        const lastAction = plan2.actions[plan2.actions.length - 1];
        console.log(lastAction?.type === 'summarize' ? '✅ 요약 액션이 마지막에 위치' : '⚠️ 요약 액션 위치 확인 필요');
    } catch (error: any) {
        console.error('❌ 테스트 케이스 2 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 3: 복잡한 분석 요청
    const testCase3: PlanContext = {
        question: "마곡엠밸리 가격 동향 분석하고 주변 편의시설도 알려줘",
        intent: { category: 'general', confidence: 0, entities: [], actions: [] },
        slots: {
            apartmentName: "마곡엠밸리"
        },
        userProfile: { purpose: ['투자'], budgetRange: [40000, 80000] },
        sessionHistory: {
            messageCount: 3,
            lastQuestionTypes: ['price_analysis'],
            completedActions: [],
            failedActions: []
        },
        capabilities: {
            availableTools: ['searchRealEstate', 'searchPOI', 'getPriceTrends', 'calculateStats', 'visualize', 'summarize'],
            dataAccess: { realEstate: true, POI: true, market: true, geographic: true },
            analysisFeatures: { statistics: true, visualization: true, prediction: false, comparison: true },
            externalServices: { webSearch: false, maps: true, weather: false }
        },
        constraints: {
            maxActions: 15,
            maxDuration: 45000,
            budgetLimits: { apiCalls: 100, computeTime: 15000 },
            userPermissions: ['basic', 'data_access', 'analysis', 'advanced'],
            rateLimit: { actionsPerMinute: 30, dataQueryLimit: 20 }
        }
    };

    console.log('📋 테스트 케이스 3: 복잡한 분석 요청');
    try {
        const plan3 = await defaultPlanner.createPlan(testCase3);
        console.log('✅ 플랜 생성 성공:', {
            planId: plan3.id,
            totalSteps: plan3.totalSteps,
            actions: plan3.actions.map(a => ({ type: a.type, name: a.name, priority: a.priority }))
        });

        // 여러 액션 타입이 포함되어 있는지 확인
        const actionTypes = new Set(plan3.actions.map(a => a.type));
        console.log('포함된 액션 타입들:', Array.from(actionTypes));
        
        const expectedTypes = ['searchRealEstate', 'getPriceTrends', 'searchPOI'];
        const hasExpectedActions = expectedTypes.some(type => actionTypes.has(type as any));
        console.log(hasExpectedActions ? '✅ 예상 액션들 포함됨' : '⚠️ 예상 액션 부족');
    } catch (error: any) {
        console.error('❌ 테스트 케이스 3 실패:', error.message);
    }

    console.log('\n🎯 플래너 시스템 테스트 완료');
}

// 테스트 실행
testPlanner().catch(console.error);