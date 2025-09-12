// 플래너 시스템 테스트 전용 라우트
import { Hono } from 'hono';
import { slotMiddleware } from '../middleware/sessionSlots';
import { 
  defaultPlanner, 
  defaultExecutor, 
  registerBridgeHandlers, 
  PlanContext, 
  SystemCapabilities,
  PlanConstraints 
} from '../ai/planner';

const plannerTestRoute = new Hono();

// 브리지 핸들러 등록
registerBridgeHandlers(defaultExecutor);

// POST /chat - 프론트엔드 호환 플래너 엔드포인트
plannerTestRoute.post('/chat', slotMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🎯 플래너 기반 챗봇 요청:', { 
            message: message?.slice(0, 100) + '...',
            extractedApartments: context?.extractedApartments?.length || 0
        });

        // extractedApartments에서 아파트 데이터 추출
        const apartmentData = context?.extractedApartments?.[0];
        
        // 테스트용 슬롯 데이터 설정
        const testSlots = apartmentData ? {
            apartmentName: apartmentData.name,
            apartmentMetadata: {
                id: apartmentData.id || 123,
                address: apartmentData.address || apartmentData.jibun_address || '서울 신당동 843',
                lat: apartmentData.lat || 37.55817,
                lon: apartmentData.lng || apartmentData.lon || 127.01790
            }
        } : {};

        // 플랜 컨텍스트 생성
        const planContext: PlanContext = {
            question: message,
            intent: null, // 플래너가 분석함
            slots: { ...c.slots, ...testSlots },
            userProfile: context?.userProfile || {
                purpose: ['매매', '투자'],
                workLocation: '강남역',
                commutingRadius: 30
            },
            sessionHistory: {
                messageCount: context?.messages?.length || 1,
                lastQuestionTypes: [],
                completedActions: [],
                failedActions: []
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

        // 플랜 생성
        console.log('📋 플랜 생성 중...');
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

        // 프론트엔드 호환 응답 생성
        let reply = "플래너 시스템에서 처리했습니다.\n\n";
        
        // 각 액션 결과를 사용자 친화적으로 변환
        for (const result of execution.results) {
            if (result.success && result.data) {
                if (result.data.deals && result.data.deals.length > 0) {
                    reply += `🏠 실거래가 ${result.data.deals.length}건을 찾았습니다.\n`;
                } else if (result.data.pois && result.data.pois.length > 0) {
                    reply += `📍 주변 편의시설 ${result.data.pois.length}개를 찾았습니다.\n`;
                } else if (result.data.type === 'clarify_required') {
                    reply = result.data.message;
                }
            }
        }

        if (execution.criticResult?.hasIssue) {
            reply += `\n💡 추가 정보: ${execution.criticResult.explanation}`;
        }

        return c.json({
            success: true,
            reply,
            toolCallsCount: plan.actions.length,
            plannerUsed: true
        });

    } catch (error: any) {
        console.error('❌ 플래너 기반 챗봇 처리 오류:', error.message);
        return c.json({
            success: false,
            error: `플래너 시스템 오류: ${error.message}`,
            plannerUsed: true
        }, 500);
    }
});

export default plannerTestRoute;