// 플래너 API 엔드포인트 통합 테스트
async function testPlannerAPI() {
    console.log('🎯 플래너 API 엔드포인트 테스트 시작\n');

    const baseUrl = 'http://localhost:8787/api/ai-new';

    // 테스트 케이스 1: 불완전한 정보 - Clarify 응답 예상
    console.log('📋 테스트 케이스 1: 불완전한 정보 (Clarify 예상)');
    
    try {
        const response1 = await fetch(`${baseUrl}/test-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "마곡엠밸리 알려줘",
                context: {}
            })
        });

        const result1 = await response1.json();
        console.log('✅ API 응답:', {
            success: result1.success,
            clarify: result1.clarify,
            planId: result1.planId,
            reply: result1.reply?.slice(0, 100) + '...'
        });

        if (result1.clarify) {
            console.log('✅ Clarify 모드 정상 동작');
            console.log('Field:', result1.field);
            console.log('Suggestions:', result1.suggestions);
        } else {
            console.log('⚠️ Clarify 모드가 아님');
        }
    } catch (error: any) {
        console.error('❌ 테스트 케이스 1 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 2: 완전한 정보 - 직접 실행 예상
    console.log('📋 테스트 케이스 2: 완전한 정보 (직접 실행 예상)');
    
    try {
        const response2 = await fetch(`${baseUrl}/test-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "마곡엠밸리7단지 84형 매매가 알려줘",
                context: {
                    userProfile: {
                        purpose: ['매매'],
                        budgetRange: [30000, 50000]
                    }
                }
            })
        });

        const result2 = await response2.json();
        console.log('✅ API 응답:', {
            success: result2.success,
            clarify: result2.clarify,
            planId: result2.planId,
            executedActions: result2.executedActions,
            successfulActions: result2.successfulActions,
            reply: result2.reply?.slice(0, 150) + '...'
        });

        if (result2.results) {
            console.log('실행된 액션들:', result2.results.map((r: any) => ({
                actionId: r.actionId,
                success: r.success,
                executionTime: r.executionTime + 'ms'
            })));
        }
    } catch (error: any) {
        console.error('❌ 테스트 케이스 2 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 3: 슬롯 미들웨어와 연동 테스트
    console.log('📋 테스트 케이스 3: 슬롯 미들웨어 연동 테스트');
    
    try {
        // 첫 번째 요청: 아파트명만 제공
        const response3a = await fetch(`${baseUrl}/test-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "마곡엠밸리7단지 정보 좀 알려줘",
                context: {}
            })
        });

        const result3a = await response3a.json();
        console.log('첫 번째 요청 응답:', {
            success: result3a.success,
            clarify: result3a.clarify || false,
            reply: result3a.reply?.slice(0, 100) + '...'
        });

        // 두 번째 요청: 추가 정보 제공 (슬롯에 저장된 정보 활용)
        const response3b = await fetch(`${baseUrl}/test-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "그 아파트 84형 매매가는?",
                context: {}
            })
        });

        const result3b = await response3b.json();
        console.log('두 번째 요청 응답:', {
            success: result3b.success,
            clarify: result3b.clarify || false,
            reply: result3b.reply?.slice(0, 100) + '...'
        });

        if (!result3b.clarify) {
            console.log('✅ 슬롯 정보 활용으로 참조 표현 해석 성공');
        }
    } catch (error: any) {
        console.error('❌ 테스트 케이스 3 실패:', error.message);
    }

    console.log('\n🎯 플래너 API 엔드포인트 테스트 완료');
}

// 테스트 실행
testPlannerAPI().catch(console.error);