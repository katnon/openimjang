// 플래너 시스템 테스트 스크립트
import { 
    defaultPlanner, 
    defaultExecutor, 
    registerBridgeHandlers, 
} from './ai/planner/index.js';

async function testPlanner() {
    console.log('🎯 플래너 시스템 테스트 시작');
    
    // 브리지 핸들러 등록
    registerBridgeHandlers(defaultExecutor);
    
    // 테스트용 플랜 컨텍스트
    const planContext = {
        question: '@삼성 여기 주변 편의시설 어때?',
        intent: null, // 플래너가 분석함
        slots: {
            apartmentName: '삼성',
            apartmentMetadata: {
                id: 123,
                address: '서울 신당동 843',
                lat: 37.55817,
                lon: 127.01790
            }
        },
        userProfile: {
            purpose: ['매매', '투자'],
            workLocation: '강남역',
            commutingRadius: 30
        },
        sessionHistory: {
            messages: [
                { role: 'user', content: '@삼성 여기 주변 편의시설 어때?' }
            ],
            lastQuestionTypes: [],
            context: {},
            timestamp: new Date()
        },
        capabilities: {
            availableFunctions: ['searchRealEstate', 'searchPOI', 'getBuildingInfo'],
            maxExecutionTime: 30000,
            allowedDataSources: ['database', 'external_api'],
            supportedOutputFormats: ['text', 'json']
        },
        constraints: {
            maxActions: 5,
            timeoutMs: 30000,
            qualityLevel: 'balanced'
        }
    };
    
    try {
        console.log('📋 플랜 생성 중...');
        
        // 플랜 생성
        const plan = await defaultPlanner.createPlan(planContext);
        
        console.log('✅ 플랜 생성 완료:', {
            planId: plan.id,
            actionCount: plan.actions.length,
            actions: plan.actions.map(a => a.type)
        });
        
        // 플랜 실행
        console.log('🔧 플랜 실행 중...');
        const execution = await defaultExecutor.executeWithCritic(plan, planContext);
        
        console.log('✅ 플랜 실행 완료:', {
            status: execution.status,
            resultCount: execution.results.length,
            criticResult: execution.criticResult?.hasIssue || false
        });
        
        // 결과 출력
        for (const result of execution.results) {
            console.log(`📊 Result ${result.actionId}:`, {
                success: result.success,
                dataType: result.data ? typeof result.data : 'no data',
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ 플래너 테스트 실패:', error.message);
    }
}

testPlanner();