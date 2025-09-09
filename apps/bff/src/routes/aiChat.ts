// apps/bff/src/routes/aiChat.ts - 새로운 표준 패턴 적용
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { tools as functionTools } from '../ai/tools';
import { handlers as functionHandlers } from '../ai/handlers';
import { validateOrThrow } from '../ai/tools/validation';

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

        // 1) 시스템/유저 메시지 구성
        const messages: any[] = [
            { 
                role: 'system', 
                content: `당신은 OpenImjang 부동산 임장 분석 전문 AI 어시스턴트입니다.

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

**응답 가이드라인:**
- 정확성: 항상 함수 호출 결과에 기반하여 응답
- 한국어 사용: 모든 응답은 자연스러운 한국어로 작성
- 구조화된 정보: 복잡한 데이터는 표, 목록, 단계별로 정리
- 실용적 조언: 단순 데이터 나열이 아닌 실용적 인사이트 제공

**데이터 해석 가이드:**
- 거래가격은 만원 단위 (30000 = 3억원)
- 좌표계는 주로 WGS84 (EPSG:4326) 사용
- 법정동 코드는 10자리 숫자로 구성` 
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
                    validateOrThrow(schema.function, args);
                    
                    // 3-2) 로컬 핸들러 호출
                    const handler = (functionHandlers as any)[fnName];
                    if (typeof handler !== 'function') {
                        throw new Error(`Handler not implemented: ${fnName}`);
                    }

                    console.log(`🔧 함수 호출: ${fnName}`, JSON.stringify(args).slice(0, 200));
                    const result = await handler(args);
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

export default aiChatRoute;