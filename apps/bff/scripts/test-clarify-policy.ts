// Clarify 정책 시스템 테스트 스크립트
import { defaultClarifyPolicy } from '../src/ai/clarify/policy';
import { apartmentMatcher } from '../src/ai/clarify/matcher';
import { ClarifyContext } from '../src/ai/clarify/types';

async function testClarifyPolicy() {
    console.log('🤔 Clarify 정책 시스템 테스트 시작\n');

    // 테스트 케이스 1: 아파트명 누락
    console.log('📋 테스트 케이스 1: 아파트명 누락');
    try {
        const context1: ClarifyContext = {
            currentSlots: {},
            reason: 'missing'
        };

        const question1 = await defaultClarifyPolicy.generateQuestion('apartmentName', context1);
        console.log('✅ 질문 생성 성공:', {
            question: question1.question,
            expectedResponseType: question1.expectedResponseType,
            priority: question1.priority,
            hint: question1.hint
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 1 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 2: 거래유형 누락 (사용자 프로필 포함)
    console.log('📋 테스트 케이스 2: 거래유형 누락 (사용자 프로필 포함)');
    try {
        const context2: ClarifyContext = {
            currentSlots: { apartmentName: '마곡엠밸리7단지' },
            reason: 'missing',
            userProfile: { purpose: ['투자'], budgetRange: [30000, 50000] }
        };

        const question2 = await defaultClarifyPolicy.generateQuestion('dealType', context2);
        console.log('✅ 질문 생성 성공:', {
            question: question2.question,
            suggestions: question2.suggestions,
            hint: question2.hint
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 2 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 3: 부분 아파트명 처리
    console.log('📋 테스트 케이스 3: 부분 아파트명 처리');
    try {
        const candidates = await apartmentMatcher.searchCandidates('마곡엠밸리');
        console.log('🔍 후보 검색 결과:', candidates.slice(0, 3).map(c => ({
            name: c.aptName,
            region: c.region,
            score: c.score
        })));

        if (candidates.length > 0) {
            const context3: ClarifyContext = {
                currentSlots: {},
                reason: 'ambiguous',
                partialValue: '마곡엠밸리',
                candidates: candidates.slice(0, 3).map(c => `${c.aptName} (${c.region})`)
            };

            const question3 = await defaultClarifyPolicy.generateQuestion('apartmentName', context3);
            console.log('✅ 애매함 처리 질문:', {
                question: question3.question,
                suggestions: question3.suggestions,
                expectedResponseType: question3.expectedResponseType
            });
        }
    } catch (error: any) {
        console.error('❌ 테스트 케이스 3 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 4: 면적 질문 (특정 아파트 컨텍스트)
    console.log('📋 테스트 케이스 4: 면적 질문 (특정 아파트 컨텍스트)');
    try {
        const context4: ClarifyContext = {
            currentSlots: { 
                apartmentName: '마곡엠밸리7단지',
                dealType: '매매'
            },
            reason: 'missing'
        };

        const question4 = await defaultClarifyPolicy.generateQuestion('area', context4);
        console.log('✅ 면적 질문 생성:', {
            question: question4.question,
            suggestions: question4.suggestions,
            hint: question4.hint
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 4 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 5: 누락 슬롯 분석
    console.log('📋 테스트 케이스 5: 누락 슬롯 분석');
    try {
        const incompleteSlots = {
            apartmentName: '마곡엠밸리7단지'
            // dealType, area 누락
        };

        const intent = {
            category: 'search',
            subcategory: 'general_search'
        };

        const questions = await defaultClarifyPolicy.analyzeMissingSlots(incompleteSlots as any, intent);
        console.log('✅ 누락 슬롯 분석 결과:', {
            questionsCount: questions.length,
            firstQuestion: questions[0] ? {
                question: questions[0].question,
                priority: questions[0].priority,
                suggestions: questions[0].suggestions
            } : null
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 5 실패:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 테스트 케이스 6: 응답 처리 테스트
    console.log('📋 테스트 케이스 6: 응답 처리 테스트');
    try {
        const context6: ClarifyContext = {
            currentSlots: { apartmentName: '마곡엠밸리7단지' },
            reason: 'missing'
        };

        // 거래유형 응답 처리
        const response1 = await defaultClarifyPolicy.processResponse('dealType', '매매', context6);
        console.log('✅ 거래유형 응답 처리:', {
            success: response1.success,
            updatedSlots: response1.updatedSlots,
            needsMoreClarification: response1.needsMoreClarification
        });

        // 면적 응답 처리
        const response2 = await defaultClarifyPolicy.processResponse('area', '84형', context6);
        console.log('✅ 면적 응답 처리:', {
            success: response2.success,
            updatedSlots: response2.updatedSlots
        });
    } catch (error: any) {
        console.error('❌ 테스트 케이스 6 실패:', error.message);
    }

    console.log('\n🤔 Clarify 정책 시스템 테스트 완료');
}

// 테스트 실행
testClarifyPolicy().catch(console.error);