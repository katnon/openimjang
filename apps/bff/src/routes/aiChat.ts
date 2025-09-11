// apps/bff/src/routes/aiChat.ts - 새로운 표준 패턴 적용
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { tools as functionTools } from '../ai/tools';
import { handlers as functionHandlers } from '../ai/handlers';
import { validateSchema } from '../ai/tools/validation';

const aiChatRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// POST /chat - 표준 tool_call 루프 패턴
aiChatRoute.post('/chat', authMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🔍 챗봇 요청:', { message: message?.slice(0, 100) + '...' });

        // 1) 시스템/유저 메시지 구성 (사용자 프로필 + 대화 기록 포함)
        const systemPrompt = createPersonalizedSystemPrompt(context?.userProfile, context?.messages);
        const messages: any[] = [
            { 
                role: 'system', 
                content: systemPrompt 
            },
            ...(context?.messages ?? []),
            { role: 'user', content: message }
        ];

        // 2) 모델 호출(첫 턴) — tools 등록
        let resp = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            messages,
            tools: functionTools.map(t => ({
                type: 'function',
                function: {
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters
                }
            })),
            tool_choice: 'auto'
        });

        // 3) tool_call 루프
        let guard = 0;
        while ((resp.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0) {
            guard++;
            if (guard > 6) {
                console.warn('⚠️ Tool call 무한루프 방지 - 6회 초과');
                break;
            }

            const toolCalls = resp.choices[0].message!.tool_calls!;
            const toolResultsMessages: any[] = [];

            for (const call of toolCalls) {
                if (call.type !== 'function') continue;
                const fnName = call.function.name;
                const rawArgs = call.function.arguments ?? '{}';

                // 3-1) Ajv 검증
                const schema = functionTools.find(t => t.function.name === fnName);
                if (!schema) {
                    console.error(`❌ 알 수 없는 함수: ${fnName}`);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: `Unknown function: ${fnName}` 
                        })
                    });
                    continue;
                }

                let args: any;
                try {
                    args = JSON.parse(rawArgs);
                } catch (err) {
                    console.error(`❌ JSON 파싱 실패: ${fnName}`, rawArgs.slice(0, 100));
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: 'Invalid JSON arguments' 
                        })
                    });
                    continue;
                }

                try {
                    // Ajv 검증
                    const { valid, errors } = validateSchema(schema.function, args);
                    if (!valid) {
                        throw new Error(`Schema validation failed: ${errors?.map(e => e.message).join(', ')}`);
                    }
                    
                    // 3-2) 로컬 핸들러 호출
                    const handler = (functionHandlers as any)[fnName];
                    if (typeof handler !== 'function') {
                        throw new Error(`Handler not implemented: ${fnName}`);
                    }

                    console.log(`🔧 함수 호출: ${fnName}`, JSON.stringify(args).slice(0, 200));
                    
                    // 핸들러에 userProfile 전달 (필요한 경우)
                    const handlerArgs = shouldInjectUserProfile(fnName) ? 
                        { ...args, userProfile: context?.userProfile } : 
                        args;
                        
                    const result = await handler(handlerArgs);
                    console.log(`✅ 함수 결과: ${fnName} - ${typeof result === 'object' ? 'object' : result}`);

                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: true, 
                            data: result 
                        })
                    });

                } catch (err: any) {
                    console.error(`❌ 함수 실행 오류: ${fnName}`, err.message);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: err?.message ?? String(err) 
                        })
                    });
                }
            }

            // 3-3) 재호출 — tool 결과를 모델에 피드백
            messages.push(resp.choices[0].message); // assistant 메시지(툴콜 포함) 반영
            messages.push(...toolResultsMessages);  // 각 툴 결과 반영

            resp = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
                messages,
                tools: functionTools.map(t => ({
                    type: 'function',
                    function: {
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters
                    }
                })),
                tool_choice: 'auto'
            });
        }

        // 4) 최종 답변 반환
        const finalMsg = resp.choices?.[0]?.message?.content ?? '죄송합니다. 답변을 생성하지 못했습니다.';
        
        return c.json({ 
            success: true, 
            reply: finalMsg,
            toolCallsCount: guard
        });

    } catch (error: any) {
        console.error('❌ 챗봇 처리 오류:', error);
        return c.json({
            success: false,
            error: error.message || '챗봇 처리 중 오류가 발생했습니다.'
        }, 500);
    }
});

/**
 * 사용자 프로필과 대화 기록을 기반으로 개인화된 시스템 프롬프트를 생성합니다
 */
function createPersonalizedSystemPrompt(userProfile: any, recentMessages?: any[]): string {
    let basePrompt = `당신은 OpenImjang 부동산 임장 분석 전문 AI 어시스턴트입니다.

**역할과 목표:**
- 사용자의 부동산 투자 및 임장 분석을 도와주는 전문 상담사
- 정확하고 신뢰할 수 있는 부동산 데이터를 기반으로 인사이트 제공
- 복잡한 부동산 정보를 이해하기 쉽게 설명

**주요 기능 영역:**
1. 부동산 거래 분석: 매매/전세/월세 데이터 검색 및 분석
2. 가격 동향 분석: 시계열 가격 변화 및 트렌드 분석  
3. 지리 정보 처리: 주소 변환, 좌표 변환, 법정동 코드 조회
4. 임장 정보 수집: 주변 편의시설, 교통, 인프라 정보
5. 투자 분석: 수익률 계산, 유사 매물 비교, 시장 현황

**실거래가 검색 시 중요 지침:**
- 사용자가 아파트 이름을 언급하면 ALWAYS searchRealEstateDeals 함수를 호출하세요
- apartmentName 파라미터에 사용자가 언급한 정확한 아파트명을 전달하세요
- 예: "마곡엠밸리7단지 실거래가" → searchRealEstateDeals(apartmentName: "마곡엠밸리7단지")
- "84제곱", "84㎡" 같은 면적 언급 시 area 파라미터에 84 전달
- "최근 1년", "3개월" 같은 기간 언급 시 period 파라미터 활용

**임장 상담 전략 - 질문 범위에 따른 대답 차별화:**

🔍 **범용 질문** ("마곡엠밸리 어떤가요?", "이 지역 어때요?"):
- 바로 상세 거래 데이터 제공 금지
- 종합적 지역 분석 우선: 위치/교통, 주변환경, 시세 개요, 건물정보, 투자 포인트
- 사용자가 구체적 질문을 하도록 자연스럽게 유도
- 예: "더 자세한 매매가나 특정 단지 정보가 궁금하시면 말씀해 주세요"

🚫 **불완전한 조건 검증 - 함수 호출 전 필수 체크:**
- 아파트명만 있고 "단지, 거래유형, 면적" 누락 시 → clarification 질문 반환
- 예: "마곡엠밸리" → "몇 단지를 찾으시나요? 매매/전세/월세 중 어떤 거래를 보고 싶으세요?"
- apt_info에서 가능한 단지 목록을 먼저 보여주고 선택 유도
- 함수 호출은 조건이 충분할 때만 실행

📊 **구체적 질문** ("7단지 매매가", "84형 가격", "최근 거래"):
- 모든 필수 조건(아파트명, 단지, 거래유형)이 있을 때만 함수 호출
- 상세 데이터와 표 제공
- 조건별 rowCount 분리 처리: 단지별로 결과가 다를 수 있음

**응답 가이드라인:**
- 정확성: 항상 함수 호출 결과에 기반하여 응답
- 한국어 사용: 모든 응답은 자연스러운 한국어로 작성
- 구조화된 정보: 복잡한 데이터는 표, 목록, 단계별로 정리
- 실용적 조언: 단순 데이터 나열이 아닌 실용적 인사이트 제공
- 질문 범위 고려: 범용 질문엔 종합 분석, 구체적 질문엔 상세 데이터

**데이터 해석 가이드:**
- 거래가격은 만원 단위 (30000 = 3억원)
- 좌표계는 주로 WGS84 (EPSG:4326) 사용
- 법정동 코드는 10자리 숫자로 구성
- 면적 필터는 ±5㎡ 오차 허용됨`;

    // 사용자 프로필이 있는 경우 개인화된 컨텍스트 추가
    if (userProfile) {
        console.log('✅ 사용자 프로필 기반 개인화 적용:', {
            purpose: userProfile.purpose,
            budgetRange: userProfile.budgetRange,
            preferredBuildingAge: userProfile.preferredBuildingAge
        });

        let profileContext = `

🎯 **사용자 개인 정보 - 이 정보를 우선적으로 고려하여 맞춤형 조언을 제공하세요:**`;

        if (userProfile.purpose && userProfile.purpose.length > 0) {
            profileContext += `
- **목적**: ${userProfile.purpose.join(', ')}`;
        }

        if (userProfile.budgetRange && userProfile.budgetRange.length === 2) {
            const minBudget = Math.floor(userProfile.budgetRange[0] / 10000);
            const maxBudget = Math.floor(userProfile.budgetRange[1] / 10000);
            profileContext += `
- **예산**: ${minBudget}억~${maxBudget}억원`;
        }

        if (userProfile.monthlyRent && userProfile.monthlyRent.length === 2 && userProfile.monthlyRent[1] > 0) {
            profileContext += `
- **월세 범위**: ${userProfile.monthlyRent[0]}만원~${userProfile.monthlyRent[1]}만원`;
        }

        if (userProfile.preferredBuildingAge) {
            profileContext += `
- **선호 건축연식**: ${userProfile.preferredBuildingAge}`;
        }

        if (userProfile.familyType) {
            profileContext += `
- **가족 구성**: ${userProfile.familyType}`;
        }

        if (userProfile.workLocation) {
            profileContext += `
- **직장/주요 활동지**: ${userProfile.workLocation}`;
        }

        if (userProfile.commutingRadius) {
            profileContext += `
- **희망 통근 거리**: ${userProfile.commutingRadius}분 이내`;
        }

        if (userProfile.priorities && userProfile.priorities.length > 0) {
            profileContext += `
- **우선순위**: ${userProfile.priorities.join(', ')}`;
        }

        profileContext += `

**개인화 응답 지침:**
1. 실거래가를 검색할 때 사용자의 예산 범위를 고려하여 관련성 높은 매물을 우선적으로 제시
2. 사용자의 목적(매매/투자/거주)에 맞는 분석 관점 적용
3. 선호 건축연식과 가족 구성을 고려한 추천
4. 직장 위치 기반 교통 편의성 분석 제공
5. 우선순위에 따른 맞춤형 조언 (교통, 교육, 편의시설 등)
6. 단순 데이터 나열보다는 사용자 상황에 특화된 인사이트 제공`;

        basePrompt += profileContext;
    } else {
        console.log('ℹ️ 사용자 프로필 없음 - 일반 프롬프트 사용');
    }

    // 대화 기록이 있는 경우 컨텍스트 추가
    if (recentMessages && recentMessages.length > 0) {
        console.log('🗨️ 대화 기록 기반 컨텍스트 추가:', recentMessages.length + '개 메시지');
        
        const conversationContext = createConversationContext(recentMessages);
        basePrompt += conversationContext;
    } else {
        console.log('ℹ️ 대화 기록 없음 - 신규 대화');
    }

    return basePrompt;
}

/**
 * 대화 기록을 분석해서 컨텍스트 정보를 생성합니다
 */
function createConversationContext(recentMessages: any[]): string {
    // 최근 5개 메시지만 사용 (너무 긴 컨텍스트 방지)
    const relevantMessages = recentMessages.slice(-5);
    
    // 대화에서 언급된 중요 키워드 추출
    const extractedContext = extractImportantContext(relevantMessages);
    
    let conversationContext = `

💬 **최근 대화 맥락 - 참조 표현 해석을 위해 활용하세요:**`;

    // 중요 컨텍스트가 있으면 먼저 표시
    if (extractedContext.apartmentNames.length > 0) {
        conversationContext += `
- **언급된 아파트**: ${extractedContext.apartmentNames.join(', ')}`;
    }
    
    if (extractedContext.areas.length > 0) {
        conversationContext += `
- **언급된 면적**: ${extractedContext.areas.join(', ')}㎡`;
    }
    
    if (extractedContext.complexNumbers.length > 0) {
        conversationContext += `
- **언급된 단지**: ${extractedContext.complexNumbers.join(', ')}`;
    }

    // 최근 대화 내용
    conversationContext += `
- **최근 대화**:`;
    
    relevantMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '사용자' : '어시스턴트';
        const content = msg.content.slice(0, 100); // 너무 긴 메시지는 잘라서 표시
        conversationContext += `
  ${index + 1}. ${role}: ${content}${msg.content.length > 100 ? '...' : ''}`;
    });

    conversationContext += `

**컨텍스트 활용 지침:**
1. "거기", "그곳", "그 아파트" → 최근 언급된 아파트명으로 해석
2. "몇단지", "7단지", "그 단지" → 최근 언급된 단지번호와 연결
3. "59형", "84형" → 최근 언급된 면적 정보와 연결  
4. "가격", "시세", "얼마" → 최근 맥락의 아파트/면적 기준으로 질의
5. 참조 표현이 불명확하면 사용자에게 구체적으로 재질문`;

    return conversationContext;
}

/**
 * 대화에서 중요한 컨텍스트 정보를 추출합니다
 */
function extractImportantContext(messages: any[]): {
    apartmentNames: string[];
    areas: string[];
    complexNumbers: string[];
} {
    const apartmentNames: Set<string> = new Set();
    const areas: Set<string> = new Set();
    const complexNumbers: Set<string> = new Set();
    
    messages.forEach(msg => {
        const content = msg.content;
        
        // 아파트명 추출 (일반적인 패턴)
        const aptMatches = content.match(/([\w가-힣]+(?:아파트|단지|빌라|타워|캐슬|팰리스|래미안|힐스테이트|엠밸리)[\w가-힣]*)/g);
        if (aptMatches) {
            aptMatches.forEach(apt => apartmentNames.add(apt));
        }
        
        // 면적 추출 (59형, 84평, 32㎡ 등)
        const areaMatches = content.match(/(\d+(?:\.\d+)?)\s*(?:형|평|㎡|제곱미터)/g);
        if (areaMatches) {
            areaMatches.forEach(area => {
                const num = area.match(/(\d+(?:\.\d+)?)/)?.[1];
                if (num) areas.add(num);
            });
        }
        
        // 단지 번호 추출 (7단지, 3차 등)
        const complexMatches = content.match(/(\d+)\s*(?:단지|차)/g);
        if (complexMatches) {
            complexMatches.forEach(complex => {
                const num = complex.match(/(\d+)/)?.[1];
                if (num) complexNumbers.add(num + '단지');
            });
        }
    });
    
    return {
        apartmentNames: Array.from(apartmentNames),
        areas: Array.from(areas),
        complexNumbers: Array.from(complexNumbers)
    };
}

/**
 * 특정 핸들러에 userProfile 주입이 필요한지 판단
 */
function shouldInjectUserProfile(functionName: string): boolean {
    const functionsNeedingProfile = [
        'searchRealEstateDeals',
        'getLatestTrade', 
        'getPriceTrends',
        'generateSelectQuery'
    ];
    return functionsNeedingProfile.includes(functionName);
}

// TEST-ONLY: 인증 없이 테스트할 수 있는 엔드포인트 (개발용)
aiChatRoute.post('/test-chat', async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🧪 테스트 챗봇 요청:', { message: message?.slice(0, 100) + '...' });

        // 시스템/유저 메시지 구성 (사용자 프로필 + 대화 기록 포함)
        const systemPrompt = createPersonalizedSystemPrompt(context?.userProfile, context?.messages);
        const messages: any[] = [
            { 
                role: 'system', 
                content: systemPrompt 
            },
            ...(context?.messages ?? []),
            { role: 'user', content: message }
        ];

        // 모델 호출(첫 턴) — tools 등록
        let resp = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            messages,
            tools: functionTools.map(t => ({
                type: 'function',
                function: {
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters
                }
            })),
            tool_choice: 'auto'
        });

        // tool_call 루프
        let guard = 0;
        while ((resp.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0) {
            guard++;
            if (guard > 6) {
                console.warn('⚠️ Tool call 무한루프 방지 - 6회 초과');
                break;
            }

            const toolCalls = resp.choices[0].message!.tool_calls!;
            const toolResultsMessages: any[] = [];

            for (const call of toolCalls) {
                if (call.type !== 'function') continue;
                const fnName = call.function.name;
                const rawArgs = call.function.arguments ?? '{}';

                // Ajv 검증
                const schema = functionTools.find(t => t.function.name === fnName);
                if (!schema) {
                    console.error(`❌ 알 수 없는 함수: ${fnName}`);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: `Unknown function: ${fnName}` 
                        })
                    });
                    continue;
                }

                let fnArgs: any;
                try {
                    fnArgs = JSON.parse(rawArgs);
                } catch (e) {
                    console.error(`❌ JSON 파싱 오류: ${fnName}`, rawArgs);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: 'Invalid JSON arguments' 
                        })
                    });
                    continue;
                }

                const { valid, errors } = validateSchema(schema.function, fnArgs);
                if (!valid) {
                    console.error(`❌ 스키마 검증 실패: ${fnName}`, errors);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: `Schema validation failed: ${errors?.join(', ')}` 
                        })
                    });
                    continue;
                }

                // userProfile 주입 (필요한 함수만)
                if (shouldInjectUserProfile(fnName) && context?.userProfile) {
                    fnArgs.userProfile = context.userProfile;
                }

                // 함수 실행
                console.log(`🔧 함수 실행: ${fnName}`, fnArgs);
                const handler = functionHandlers[fnName];
                if (!handler) {
                    console.error(`❌ 핸들러를 찾을 수 없음: ${fnName}`);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: `Handler not found: ${fnName}` 
                        })
                    });
                    continue;
                }

                try {
                    const result = await handler(fnArgs);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify(result)
                    });
                } catch (handlerError: any) {
                    console.error(`❌ 핸들러 실행 오류: ${fnName}`, handlerError);
                    toolResultsMessages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({ 
                            success: false, 
                            error: handlerError.message || 'Handler execution failed' 
                        })
                    });
                }
            }

            messages.push(resp.choices[0].message); // assistant 메시지(툴콜 포함) 반영
            messages.push(...toolResultsMessages);  // 각 툴 결과 반영

            resp = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
                messages,
                tools: functionTools.map(t => ({
                    type: 'function',
                    function: {
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters
                    }
                })),
                tool_choice: 'auto'
            });
        }

        // 최종 답변 반환
        const finalMsg = resp.choices?.[0]?.message?.content ?? '죄송합니다. 답변을 생성하지 못했습니다.';
        
        return c.json({ 
            success: true, 
            reply: finalMsg,
            toolCallsCount: guard
        });

    } catch (error: any) {
        console.error('❌ 테스트 챗봇 처리 오류:', error);
        return c.json({
            success: false,
            error: error.message || '테스트 챗봇 처리 중 오류가 발생했습니다.'
        }, 500);
    }
});

export default aiChatRoute;