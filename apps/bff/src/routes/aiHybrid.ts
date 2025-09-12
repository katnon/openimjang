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
        
        // 🔧 아파트 메타데이터에서 첫 번째 아파트를 contextAptData로 설정
        const firstApartment = context?.apartmentMetadata ? Object.values(context.apartmentMetadata)[0] as any : null;
        const firstApartmentKey = context?.apartmentMetadata ? Object.keys(context.apartmentMetadata)[0] : null;
        if (firstApartment && firstApartmentKey) {
            context.contextAptData = {
                lat: firstApartment.lat,
                lon: firstApartment.lon,
                aptId: firstApartment.id,  // aptId 필드명 매칭
                aptName: firstApartmentKey, // aptName 필드명 매칭
                id: firstApartment.id,
                name: firstApartmentKey,
                address: firstApartment.address
            };
            console.log('🏠 contextAptData 설정:', {
                aptId: context.contextAptData.aptId,
                aptName: context.contextAptData.aptName,
                coords: [context.contextAptData.lat, context.contextAptData.lon]
            });
        }

        // 2) RAG 컨텍스트가 포함된 시스템 메시지 구성
        const systemMessage = createHybridSystemMessage(retrievedContext, context);

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
            tool_choice: 'auto', // AI가 상황에 맞게 함수를 선택하도록
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
                    
                    // contextAptData를 모든 함수에 추가 (아파트 메타데이터 활용)
                    if (context?.contextAptData) {
                        args.contextAptData = context.contextAptData;
                        console.log(`📋 contextAptData 전달: ${fnName}`, {
                            aptId: context.contextAptData.id,
                            aptName: context.contextAptData.name,
                            coords: [context.contextAptData.lat, context.contextAptData.lon]
                        });
                    }
                    
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
                tool_choice: 'auto', // 재호출시에는 auto 사용
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
function createHybridSystemMessage(retrievedContext: any, context?: any): string {
    let baseSystem = `당신은 OpenImjang 부동산 임장 분석 전문 AI 어시스턴트입니다.

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

**🎯 함수 호출 지침:**
- **아파트 가격/실거래가** 질문 → searchRealEstateDeals 함수 호출
- **아파트 주변정보/교통/편의시설** 질문 → searchNearbyPOI 함수 호출  
- **메타데이터에 있는 아파트 질문** → 반드시 적절한 함수 먼저 호출
- 함수 호출 후 결과를 바탕으로 전문적 분석 제공

**🚨 POI 검색 관련 절대 규칙:**
- 주변 정보 검색시 **searchPlaces 함수 사용 금지** (키워드 검색이라 부정확함)
- **searchNearbyPOI 함수만 사용**하고 반드시 아파트 좌표(lat, lng) 전달
- 아파트명을 키워드로 사용하여 검색 절대 금지

**🔄 아파트 비교 분석 지침:**
- 여러 아파트가 언급되면 **비교 분석 모드**로 전환
- 각 아파트별로 함수를 호출하여 실제 데이터 수집 후 비교
- 가격대, 교통편, 주변 인프라, 투자 가치 등을 종합적으로 비교
- "A는 이런 장점이, B는 저런 장점이..." 형태로 균형잡힌 비교 제공
- 사용자 상황(예산, 직장위치, 가족구성)을 고려한 맞춤형 추천

**임장봇의 핵심 역할 - 데이터 나열 금지!**
- **전문 부동산 컨설턴트**: 단순 정보 제공이 아닌, 데이터를 해석하여 인사이트 제공
- **자연스러운 대화**: 친근하고 전문적인 대화체로 사용자와 상호작용
- **고급 분석**: 요약카드에 없는 심층적 분석 (트렌드, 비교, 투자 가치, 리스크)
- **맥락적 해석**: 여러 데이터를 종합하여 "왜 그런지", "어떤 의미인지" 설명

**절대 금지사항:**
❌ "○○역이 있습니다", "실거래가는 ○○입니다" 같은 단순 나열
❌ 표, 목록 형태의 건조한 데이터 정리
❌ 요약카드에서 볼 수 있는 정보의 반복

**필수 답변 방식:**
✅ "이 지역은 교통이 정말 좋네요! 9호선으로 강남까지 30분이면..."
✅ "가격 흐름을 보니 올해 들어 상승세인데, 이유를 분석해보면..."
✅ "투자 관점에서 보면 이런 장단점이 있어요..."
✅ "비슷한 다른 단지와 비교해보면..."

**대화체 원칙:**
- 친근한 존댓말 사용 ("그렇네요", "보시면", "~어요")
- 분석의 이유와 근거 설명
- 사용자 관심사에 맞춘 맞춤형 조언
- 질문으로 대화 유도

**고급 분석 영역 (요약카드 차별화):**
- **가격 트렌드 분석**: "최근 3개월간 상승/하락 이유와 향후 전망"
- **교통 접근성 분석**: "출퇴근 시간대별 실제 소요시간과 노선 분석"
- **투자 수익성 분석**: "전세 수익률, 매매 시세 상승 가능성"
- **지역 개발 이슈**: "재개발, 신규 개발 계획이 가격에 미치는 영향"
- **경쟁 단지 비교**: "인근 비슷한 조건의 아파트와 장단점 비교"
- **라이프스타일 매칭**: "가족 구성, 직장 위치 등을 고려한 맞춤 조언"

**데이터 해석 가이드:**
- 거래가격은 만원 단위 (30000 = 3억원)
- 좌표계는 주로 WGS84 (EPSG:4326) 사용
- 법정동 코드는 10자리 숫자로 구성
- 면적 필터는 ±5㎡ 오차 허용됨`;

    // 현재 선택된 아파트 정보 추가
    if (context?.apartmentId && context?.apartmentName) {
        const apartmentSection = `

**🏠 현재 사용자가 선택한 아파트:**
- 아파트명: ${context.apartmentName}
- 아파트 ID: ${context.apartmentId}
- 상태: 사용자가 이 아파트에 대해 질문하고 있습니다
- 분석 우선순위: 이 아파트를 중심으로 분석하세요

**중요 지침:**
- "여기", "이곳", "이 아파트" 등으로 언급하면 ${context.apartmentName}를 의미합니다
- 주변 분석 시에는 이 아파트의 위치를 기준으로 해주세요
- 실거래가 검색 시 apartmentName="${context.apartmentName}"로 검색하세요`;
        
        baseSystem += apartmentSection;
    }

    // 추출된 아파트 메타데이터 추가 (@멘션 아파트들)
    if (context?.apartmentMetadata && Object.keys(context.apartmentMetadata).length > 0) {
        const apartmentMetaSection = `

**📋 검색 성공한 아파트들의 메타데이터:**
${Object.entries(context.apartmentMetadata).map(([name, meta]: [string, any]) => 
    `- ${name}: ID=${meta.id || 'N/A'}, 주소=${meta.address || 'N/A'}, 좌표=(${meta.lat || 'N/A'}, ${meta.lon || 'N/A'})`
).join('\n')}

**✅ 사용 가능한 아파트 데이터:**
이 아파트들에 대한 질문이 나오면 반드시 함수를 호출하여 실제 데이터를 조회하세요.
- 주변정보 질문 시: searchNearbyPOI(lat: [아파트좌표], lng: [아파트좌표])
- 실거래가 질문 시: searchRealEstateDeals(aptId: [아파트ID], apartmentName: "[아파트명]")`;
        
        baseSystem += apartmentMetaSection;
    }

    // 검색 실패한 아파트들에 대한 안내 (간소화)
    if (context?.failedApartmentSearches && context.failedApartmentSearches.length > 0) {
        // 메타데이터에 있는 아파트는 실패 목록에서 제외
        const actuallyFailedSearches = context.failedApartmentSearches.filter((name: string) => 
            !context?.apartmentMetadata?.[name]
        );
        
        if (actuallyFailedSearches.length > 0) {
            const failedSearchSection = `

**❓ 추가 정보가 필요한 아파트들:**
${actuallyFailedSearches.map((name: string) => `- ${name}`).join('\n')}

이 아파트들에 대해서는 "구체적인 위치(주소나 좌표)를 알려주시면 더 정확한 정보를 제공드릴 수 있습니다"라고 안내해주세요.`;
            
            baseSystem += failedSearchSection;
        }
    }

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