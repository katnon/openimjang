// Critic 체크리스트 시스템 테스트 스크립트
import { CriticChecklist, quickValidate } from '../src/ai/critic/checklist';
import { CriticContext, CriticResult } from '../src/ai/critic/types';
import { ConversationSlots } from '../src/ai/types/slots';

async function testCriticChecklist() {
    console.log('🔍 Critic 체크리스트 시스템 테스트 시작\n');

    // 테스트 케이스 1: 결과 없음 검증
    console.log('📋 테스트 케이스 1: 결과 없음 검증');
    try {
        const emptyActionResults = [
            {
                actionId: 'search_1',
                actionType: 'searchRealEstate',
                data: [],
                success: true,
                executedAt: new Date()
            }
        ];

        const context1: CriticContext = {
            currentSlots: {
                apartmentName: '존재하지않는아파트',
                dealType: '매매',
                period: '3개월'
            },
            actionResults: emptyActionResults,
            sessionMetadata: {
                retryCount: 0,
                periodExtended: false,
                conditionsRelaxed: false
            }
        };

        const checklist = new CriticChecklist({ debugMode: true });
        const result1 = await checklist.validateResults(context1);
        
        console.log('✅ 결과 없음 검증 완료:', {
            hasIssue: result1.hasIssue,
            issueType: result1.issueType,
            recommendedAction: result1.recommendedAction,
            needsRetry: result1.needsRetry,
            userMessage: result1.userMessage,
            adjustedSlots: result1.adjustedSlots
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 1 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 2: 데이터 부족 검증
    console.log('📋 테스트 케이스 2: 데이터 부족 검증');
    try {
        const insufficientData = [
            { deal_amount: 30000, deal_date: '2024-01' },
            { deal_amount: 32000, deal_date: '2024-02' }
        ];

        const actionResults2 = [
            {
                actionId: 'search_chart',
                actionType: 'searchRealEstate_chart',
                data: insufficientData,
                success: true,
                executedAt: new Date()
            }
        ];

        const context2: CriticContext = {
            currentSlots: {
                apartmentName: '마곡엠밸리7단지',
                dealType: '매매',
                period: '3개월'
            },
            actionResults: actionResults2,
            sessionMetadata: {
                retryCount: 0,
                periodExtended: false
            }
        };

        const checklist2 = new CriticChecklist({ debugMode: true });
        const result2 = await checklist2.validateResults(context2);

        console.log('✅ 데이터 부족 검증 완료:', {
            hasIssue: result2.hasIssue,
            issueType: result2.issueType,
            recommendedAction: result2.recommendedAction,
            needsRetry: result2.needsRetry,
            userMessage: result2.userMessage
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 2 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 3: 이상치 감지 검증
    console.log('📋 테스트 케이스 3: 이상치 감지 검증');
    try {
        const dataWithAnomalies = [
            { deal_amount: 30000, deal_date: '2024-01' },
            { deal_amount: 32000, deal_date: '2024-02' },
            { deal_amount: 31000, deal_date: '2024-03' },
            { deal_amount: 100000, deal_date: '2024-04' }, // 이상치
            { deal_amount: 30500, deal_date: '2024-05' },
            { deal_amount: 5000, deal_date: '2024-06' },   // 이상치
            { deal_amount: 31500, deal_date: '2024-07' }
        ];

        const actionResults3 = [
            {
                actionId: 'search_3',
                actionType: 'searchRealEstate',
                data: dataWithAnomalies,
                success: true,
                executedAt: new Date()
            }
        ];

        const context3: CriticContext = {
            currentSlots: {
                apartmentName: '마곡엠밸리7단지',
                dealType: '매매',
                period: '6개월'
            },
            actionResults: actionResults3
        };

        const checklist3 = new CriticChecklist({ debugMode: true });
        const result3 = await checklist3.validateResults(context3);

        console.log('✅ 이상치 감지 검증 완료:', {
            hasIssue: result3.hasIssue,
            issueType: result3.issueType,
            userMessage: result3.userMessage,
            explanation: result3.explanation
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 3 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 4: 일관성 검증 (이전 결과와 비교)
    console.log('📋 테스트 케이스 4: 일관성 검증');
    try {
        const currentResults = [
            { deal_amount: 30000, apt_nm: '다른아파트' },
            { deal_amount: 31000, apt_nm: '다른아파트' },
            { deal_amount: 32000, apt_nm: '다른아파트' }
        ];

        const previousResults = [
            { deal_amount: 30000, apt_nm: '마곡엠밸리7단지' },
            { deal_amount: 31000, apt_nm: '마곡엠밸리7단지' },
            { deal_amount: 32000, apt_nm: '마곡엠밸리7단지' }
        ];

        const context4: CriticContext = {
            currentSlots: {
                apartmentName: '다른아파트',
                dealType: '매매',
                period: '6개월'
            },
            previousSlots: {
                apartmentName: '마곡엠밸리7단지',
                dealType: '매매',
                period: '6개월'
            },
            actionResults: [
                {
                    actionId: 'search_4',
                    actionType: 'searchRealEstate',
                    data: currentResults,
                    success: true,
                    executedAt: new Date()
                }
            ],
            previousResults
        };

        const checklist4 = new CriticChecklist({ debugMode: true });
        const result4 = await checklist4.validateResults(context4);

        console.log('✅ 일관성 검증 완료:', {
            hasIssue: result4.hasIssue,
            issueType: result4.issueType,
            explanation: result4.explanation,
            confidence: result4.confidence
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 4 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 5: quickValidate 헬퍼 함수 테스트
    console.log('📋 테스트 케이스 5: quickValidate 헬퍼 함수');
    try {
        const normalData = [
            { deal_amount: 30000, deal_date: '2024-01' },
            { deal_amount: 31000, deal_date: '2024-02' },
            { deal_amount: 32000, deal_date: '2024-03' },
            { deal_amount: 33000, deal_date: '2024-04' },
            { deal_amount: 31500, deal_date: '2024-05' }
        ];

        const slots: ConversationSlots = {
            apartmentName: '마곡엠밸리7단지',
            dealType: '매매',
            period: '6개월'
        };

        const result5 = await quickValidate([normalData], slots, {
            enableDebug: true,
            maxRetries: 1
        });

        console.log('✅ quickValidate 테스트 완료:', {
            hasIssue: result5.hasIssue,
            confidence: result5.confidence,
            explanation: result5.explanation
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 5 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 6: 재시도 권장사항 테스트
    console.log('📋 테스트 케이스 6: 재시도 권장사항');
    try {
        const context6: CriticContext = {
            currentSlots: {
                apartmentName: '마곡엠밸리7단지',
                dealType: '매매',
                period: '3개월'
            },
            actionResults: [
                {
                    actionId: 'search_6',
                    actionType: 'searchRealEstate',
                    data: [], // 빈 결과
                    success: true,
                    executedAt: new Date()
                }
            ],
            sessionMetadata: {
                retryCount: 1,
                periodExtended: false,
                conditionsRelaxed: false
            }
        };

        const checklist6 = new CriticChecklist({ debugMode: true, maxRetries: 3 });
        const retryResult = await checklist6.generateRetryRecommendation(context6);

        console.log('✅ 재시도 권장사항 테스트 완료:', {
            hasIssue: retryResult.hasIssue,
            needsRetry: retryResult.needsRetry,
            recommendedAction: retryResult.recommendedAction,
            adjustedSlots: retryResult.adjustedSlots,
            userMessage: retryResult.userMessage,
            explanation: retryResult.explanation
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 6 실패:', error.message);
    }

    console.log('\n🔍 Critic 체크리스트 시스템 테스트 완료');
}

// 테스트 실행
testCriticChecklist().catch(console.error);