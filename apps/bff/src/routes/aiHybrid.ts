// apps/bff/src/routes/aiHybrid.ts - RAG + Function Calling 하이브리드 라우트
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { tools as functionTools } from '../ai/tools';
import { handlers as functionHandlers } from '../ai/handlers';
import { validateOrThrow } from '../ai/tools/validation';
import { vectorService } from '../services/vectorService';

const aiHybridRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// POST /chat - 하이브리드 RAG + Function Calling
aiHybridRoute.post('/chat', authMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        const userId = c.get('userId');
        
        console.log('🔍 하이브리드 AI 요청:', { 
            message: message?.slice(0, 100) + '...',
            hasContext: !!context,
            userId
        });

        // 1) RAG 검색으로 관련 컨텍스트 수집
        const retrievedContext = await performRAGSearch(message, { ...context, userId });

        // 2) RAG 컨텍스트가 포함된 시스템 메시지 구성
        const systemMessage = createHybridSystemMessage(retrievedContext);

        // 3) 메시지 구성
        const messages: any[] = [
            { role: 'system', content: systemMessage },
            ...(context?.messages ?? []),
            { role: 'user', content: message }
        ];

        // 4) OpenAI 모델 호출 - RAG + Function Calling 동시 활용
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
            tool_choice: 'auto', // RAG 정보로 충분한 경우 함수 호출하지 않을 수 있음
            temperature: 0.7
        });

        // 5) Function Calling 처리 루프
        let guard = 0;
        const executedFunctions: string[] = [];
        
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

                // Function 실행 기록
                executedFunctions.push(fnName);

                // 스키마 검증 및 함수 실행
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
                    validateOrThrow(schema.function, args);
                    
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

            // 재호출 - tool 결과를 모델에 피드백
            messages.push(resp.choices[0].message);
            messages.push(...toolResultsMessages);

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
                tool_choice: 'auto',
                temperature: 0.7
            });
        }

        // 6) 최종 답변 반환
        const finalMsg = resp.choices?.[0]?.message?.content ?? '죄송합니다. 답변을 생성하지 못했습니다.';
        
        return c.json({ 
            success: true, 
            reply: finalMsg,
            metadata: {
                ragSources: retrievedContext.sources,
                ragDocuments: retrievedContext.documents.length,
                ragRelevanceScore: retrievedContext.averageScore,
                functionsExecuted: executedFunctions,
                toolCallsCount: guard,
                processingMode: executedFunctions.length > 0 ? 'RAG+Functions' : 'RAG-only'
            }
        });

    } catch (error: any) {
        console.error('❌ 하이브리드 AI 처리 오류:', error);
        return c.json({
            success: false,
            error: error.message || '하이브리드 AI 처리 중 오류가 발생했습니다.'
        }, 500);
    }
});

/**
 * RAG 검색 수행
 */
async function performRAGSearch(query: string, context?: any): Promise<{
    documents: any[];
    sources: string[];
    averageScore: number;
}> {
    try {
        console.log('🔍 RAG 검색 수행:', { query: query.slice(0, 50) });

        const results = await vectorService.search(query, {
            topK: 3, // 하이브리드 모드에서는 적은 수의 문서만 사용
            userId: context?.userId,
            filter: {
                ...(context?.apartmentId && { apartmentId: context.apartmentId.toString() })
            }
        });

        // 현재 대화의 메모 데이터가 있는 경우 최우선으로 추가
        if (context?.memoData) {
            results.unshift({
                id: 'current_memo',
                content: `현재 대화의 임장 메모: ${context.memoData.content}`,
                metadata: {
                    source: "현재 대화의 임장 메모",
                    type: 'user_memo' as const,
                    score: 0.98,
                    userId: context.userId
                }
            });
        }

        const sources = [...new Set(results.map(doc => doc.metadata.source))];
        const averageScore = results.length > 0 
            ? results.reduce((sum, doc) => sum + doc.metadata.score, 0) / results.length 
            : 0;

        console.log('✅ RAG 검색 완료:', {
            documentsFound: results.length,
            averageScore: averageScore.toFixed(2),
            sources: sources.length
        });

        return {
            documents: results,
            sources,
            averageScore
        };

    } catch (error) {
        console.error('❌ RAG 검색 오류:', error);
        return {
            documents: [],
            sources: [],
            averageScore: 0
        };
    }
}

/**
 * 하이브리드 시스템 메시지 생성
 */
function createHybridSystemMessage(retrievedContext: any): string {
    const baseSystem = `당신은 OpenImjang 부동산 임장 분석 전문 AI 어시스턴트입니다.

**역할과 목표:**
- 사용자의 부동산 투자 및 임장 분석을 도와주는 전문 상담사
- RAG 검색된 컨텍스트와 Function Calling 결과를 종합하여 정확하고 개인화된 답변 제공
- 복잡한 부동산 정보를 이해하기 쉽게 설명

**주요 기능 영역:**
1. 부동산 거래 분석: 매매/전세/월세 데이터 검색 및 분석 (Function Calling)
2. 가격 동향 분석: 시계열 가격 변화 및 트렌드 분석 (Function Calling)
3. 지리 정보 처리: 주소 변환, 좌표 변환, 법정동 코드 조회 (Function Calling)
4. 임장 정보 수집: 주변 편의시설, 교통, 인프라 정보
5. 투자 분석: 수익률 계산, 유사 매물 비교, 시장 현황
6. 개인화된 조언: 사용자 임장 메모와 도메인 지식 기반 (RAG)

**하이브리드 처리 방식:**
- RAG로 관련 컨텍스트를 먼저 확인하고, 필요시 Function을 호출하여 실시간 데이터 보완
- 정적 지식(임장 메모, 도메인 지식)은 RAG로, 동적 데이터(실거래가, 계산)는 Function으로 처리
- 두 결과를 종합하여 종합적이고 정확한 답변 제공

**실거래가 검색 시 중요 지침:**
- 사용자가 아파트 이름을 언급하면 ALWAYS searchRealEstateDeals 함수를 호출하세요
- apartmentName 파라미터에 사용자가 언급한 정확한 아파트명을 전달하세요

**응답 가이드라인:**
- 정확성: RAG 컨텍스트와 함수 결과를 모두 활용하여 응답
- 한국어 사용: 모든 응답은 자연스러운 한국어로 작성
- 구조화된 정보: 복잡한 데이터는 표, 목록, 단계별로 정리
- 실용적 조언: 단순 데이터 나열이 아닌 실용적 인사이트 제공
- 출처 표시: RAG 정보와 실시간 데이터 출처를 명확히 구분

**데이터 해석 가이드:**
- 거래가격은 만원 단위 (30000 = 3억원)
- 좌표계는 주로 WGS84 (EPSG:4326) 사용
- 법정동 코드는 10자리 숫자로 구성
- 면적 필터는 ±5㎡ 오차 허용됨`;

    // RAG 컨텍스트 추가
    if (retrievedContext.documents.length > 0) {
        const contextSection = `

**관련 참고 정보 (RAG 검색 결과):**
${retrievedContext.documents.map((doc: any, index: number) => 
    `${index + 1}. ${doc.content} (출처: ${doc.metadata.source}, 관련도: ${(doc.metadata.score * 100).toFixed(0)}%)`
).join('\n')}

위 참고 정보를 활용하고, 필요시 Function을 호출하여 최신 정보를 보완하여 답변하세요.`;
        
        return baseSystem + contextSection;
    }

    return baseSystem;
}

export default aiHybridRoute;