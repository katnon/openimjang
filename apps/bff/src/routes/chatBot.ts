// 정상 작동하는 플래너 기반 챗봇 엔드포인트 + OpenAI
import { Hono } from 'hono';
import OpenAI from 'openai';
import { slotMiddleware } from '../middleware/sessionSlots';
import {
    defaultPlanner,
    defaultExecutor,
    registerBridgeHandlers,
    PlanContext
} from '../ai/planner';
import { defaultCriticChecklist } from '../ai/critic/checklist';
import { ConversationSlots } from '../ai/types/slots';
import { vectorService } from '../services/vectorService';

const chatBotRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 브리지 핸들러 등록
registerBridgeHandlers(defaultExecutor);

// POST /chat - 프론트엔드 호환 플래너 엔드포인트
chatBotRoute.post('/chat', slotMiddleware, async (c) => {
    try {
        // 🌟 올바른 인코딩 처리 - 슬롯 미들웨어에서 이미 처리되었으므로 간단하게
        let requestBody: any = {};
        let message = '';

        // 슬롯 미들웨어에서 이미 올바른 메시지를 처리했으므로 컨텍스트에서 가져오기 시도
        const processedMessage = (c as any).get('processedMessage');
        if (processedMessage) {
            message = processedMessage as string;
            console.log('✅ 슬롯 미들웨어에서 처리된 메시지 사용:', message);

            // context는 별도로 파싱
            try {
                const rawBody = await c.req.text().catch(() => '{}');
                requestBody = JSON.parse(rawBody);
            } catch {
                requestBody = await c.req.json().catch(() => ({}));
            }
        } else {
            // 슬롯 미들웨어를 거치지 않은 경우 직접 파싱
            try {
                requestBody = await c.req.json();
                message = requestBody.message as string;
            } catch (parseError) {
                console.error('❌ chatBot JSON 파싱 오류:', parseError);
                const rawBody = await c.req.text().catch(() => '{}');
                requestBody = JSON.parse(rawBody);
                message = requestBody.message as string;
            }
        }

        const { context } = requestBody;

        console.log('🎯 플래너 기반 챗봇 요청:', {
            message: message?.slice(0, 100) + '...',
            extractedApartments: context?.extractedApartments?.length || 0
        });

        // 🏠 아파트 정보 통합 처리: 프론트엔드에서 전송된 풍부한 정보 활용
        console.log('🔍 전달받은 아파트 관련 데이터:', {
            extractedApartments: context?.extractedApartments?.length || 0,
            apartmentMetadata: context?.apartmentMetadata ? Object.keys(context.apartmentMetadata).length : 0,
            apartmentFullData: context?.apartmentFullData ? Object.keys(context.apartmentFullData).length : 0,
            currentSlot: c.slots?.apartmentName
        });

        // 1. 현재 메시지에서 추출된 슬롯 정보 (슬롯 미들웨어에서 처리됨)
        const currentMentionApartment = c.slots?.apartmentName;

        // 2. extractedApartments에서 아파트 데이터 추출 (프론트엔드에서 전송)
        const extractedApartments = context?.extractedApartments || [];
        const apartmentData = extractedApartments[0];

        // 3. apartmentMetadata에서 메타데이터 추출 (검색 성공한 아파트들)
        const apartmentMetadata = context?.apartmentMetadata || {};
        const apartmentFullData = context?.apartmentFullData || {};

        // 4. 우선순위 결정: 현재 @멘션 > 컨텍스트 데이터
        const finalApartmentName = currentMentionApartment || apartmentData?.name;

        console.log('🎯 아파트 정보 통합 결과:', {
            currentMention: currentMentionApartment,
            contextApartments: extractedApartments.map(apt => apt.name).join(', '),
            metadataApartments: Object.keys(apartmentMetadata).join(', '),
            fullDataApartments: Object.keys(apartmentFullData).join(', '),
            finalChoice: finalApartmentName,
            priority: currentMentionApartment ? 'current_mention' : 'context'
        });

        // 5. 선택된 아파트의 메타데이터 추출
        let selectedApartmentMetadata = null;
        if (finalApartmentName) {
            // 먼저 apartmentMetadata에서 찾기 (검색 성공한 아파트)
            selectedApartmentMetadata = apartmentMetadata[finalApartmentName];

            // 없으면 extractedApartments에서 찾기
            if (!selectedApartmentMetadata && apartmentData && apartmentData.name === finalApartmentName) {
                selectedApartmentMetadata = {
                    id: apartmentData.id,
                    address: apartmentData.address || apartmentData.jibun_address,
                    lat: apartmentData.lat,
                    lon: apartmentData.lng || apartmentData.lon
                };
            }
        }

        // 6. 통합된 슬롯 데이터 설정
        const testSlots = finalApartmentName ? {
            apartmentName: finalApartmentName,
            apartmentMetadata: selectedApartmentMetadata,
            // 프론트엔드에서 전달된 전체 컨텍스트 보존
            contextApartments: extractedApartments,
            availableApartmentData: apartmentFullData[finalApartmentName] || null
        } : {};

        // 🔧 contextAptData 생성 - aiHybrid.ts와 동일한 방식으로
        let contextAptData = null;
        if (selectedApartmentMetadata) {
            contextAptData = {
                aptId: selectedApartmentMetadata.id,
                aptName: finalApartmentName,
                id: selectedApartmentMetadata.id,
                name: finalApartmentName,
                address: selectedApartmentMetadata.address,
                lat: selectedApartmentMetadata.lat,
                lon: selectedApartmentMetadata.lon
            };

            console.log('🔧 contextAptData 생성:', {
                aptId: contextAptData.aptId,
                aptName: contextAptData.aptName,
                coords: [contextAptData.lat, contextAptData.lon]
            });
        }

        // 플랜 컨텍스트 생성 - 현재 @멘션이 우선되도록 순서 변경
        const planContext: PlanContext = {
            question: message,
            intent: null as any, // 플래너가 분석함
            slots: {
                ...testSlots,
                ...c.slots,
                // contextAptData를 슬롯에 포함시켜 플래너가 사용할 수 있도록
                contextAptData
            } as any,
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
                allowedDataSources: ['database', 'external_api'],
                supportedOutputFormats: ['text', 'json']
            } as any,
            constraints: {
                maxActions: 5,
                qualityLevel: 'balanced'
            } as any
        };

        // 플랜 생성
        const plan = await defaultPlanner.createPlan(planContext);

        console.log('✅ 플랜 생성 완료:', {
            planId: plan.id,
            actionCount: plan.actions.length,
            actions: plan.actions.map(a => a.type)
        });

        // 플랜 실행
        const execution = await defaultExecutor.executeWithCritic(plan, planContext);

        console.log('✅ 플랜 실행 완료:', {
            status: execution.status,
            resultCount: execution.results.length
        });

        // 🔍 기존 Critic 시스템을 활용한 추가 검증
        const criticContext = {
            currentSlots: planContext.slots as ConversationSlots,
            actionResults: execution.results.map((result, index) => ({
                actionId: `action_${index}`,
                actionType: plan.actions[index]?.type || 'unknown',
                data: result.data,
                success: result.success,
                executedAt: new Date(),
                executionTime: 0 // 기본값
            })),
            userProfile: planContext.userProfile,
            sessionMetadata: {
                retryCount: 0,
                periodExtended: false,
                conditionsRelaxed: false
            }
        };

        const criticResult = await defaultCriticChecklist.validateResults(criticContext);

        console.log('🔍 Critic 검증 결과:', {
            hasIssue: criticResult.hasIssue,
            issueType: criticResult.issueType,
            confidence: criticResult.confidence,
            explanation: criticResult.explanation
        });

        // 🔍 벡터DB RAG 검색으로 관련 컨텍스트 수집
        console.log('🔍 벡터DB RAG 검색 시작:', message.slice(0, 50));
        const vectorResults = await vectorService.search(message, { topK: 5 });

        console.log('📊 벡터 검색 결과:', {
            found: vectorResults.length,
            topScore: vectorResults[0]?.metadata.score || 0,
            schemas: [...new Set(vectorResults.map(r => r.metadata.schema_name).filter(Boolean))]
        });

        // 디버깅용: 실행 결과 상세 로깅
        execution.results.forEach((result, index) => {
            console.log(`📊 결과 ${index + 1}:`, {
                success: result.success,
                dataType: typeof result.data,
                hasData: !!result.data,
                dataKeys: result.data ? Object.keys(result.data) : [],
                poisCount: result.data?.pois?.length || 0,
                dealsCount: result.data?.deals?.length || 0,
                error: result.error
            });
        });

        // 🤖 OpenAI 4o-mini를 사용한 자연스러운 응답 생성
        let reply = "";

        try {
            // 플래너 실행 결과를 요약해서 LLM에게 전달
            // 실제 POI 데이터를 추출하여 LLM에게 전달
            const detailedPOIData = execution.results
                .filter(result => result.success && result.data?.pois)
                .map(result => {
                    const pois = result.data.pois || [];
                    const transportation = result.data.transportation || [];

                    // 지하철역 정보만 추출 (디버깅 로그 추가)
                    console.log('🔍 전체 POI 개수:', pois.length);
                    console.log('🔍 POI 샘플 1개 전체 구조:', JSON.stringify(pois[0], null, 2));
                    console.log('🔍 POI 샘플 3개:', pois.slice(0, 3).map((p: any) => ({
                        allKeys: Object.keys(p || {}),
                        name: p.name,
                        category: p.category,
                        distance: p.distance,
                        priority: p.priority
                    })));

                    // 각 POI의 카테고리 정보를 더 자세히 로깅
                    console.log('🔍 전체 결과 데이터 구조:', JSON.stringify({
                        resultKeys: Object.keys(result.data || {}),
                        hasTransportation: !!result.data?.transportation,
                        transportationLength: result.data?.transportation?.length || 0,
                        hasPois: !!result.data?.pois,
                        poisLength: result.data?.pois?.length || 0,
                        categoryStats: result.data?.categoryStats || {},
                    }, null, 2));

                    console.log('🔍 전체 POI 카테고리 분석:');
                    const categoryStats = pois.reduce((stats: any, poi: any) => {
                        const category = poi.category || 'unknown';
                        stats[category] = (stats[category] || 0) + 1;
                        return stats;
                    }, {});
                    console.log(JSON.stringify(categoryStats, null, 2));

                    // transportation 배열에서 지하철역 정보 추출 (POI 핸들러에서 이미 분리해서 제공)
                    const subwayStations = transportation.map((station: any) => ({
                        name: station.name,
                        category: station.category,
                        distance: station.distance,
                        priority: station.priority
                    }));

                    console.log('🚇 필터링된 지하철역 개수:', subwayStations.length);
                    console.log('🚇 지하철역 목록:', subwayStations);

                    // 기타 주요 시설
                    const otherPOIs = pois.filter((poi: any) =>
                        poi.category !== '지하철역'
                    ).slice(0, 10).map((poi: any) => ({
                        name: poi.name,
                        category: poi.category,
                        distance: poi.distance,
                        priority: poi.priority
                    }));

                    return {
                        categoryStats: result.data.categoryStats || {},
                        subwayStations,
                        otherPOIs,
                        transportation: transportation.map((t: any) => ({
                            name: t.name,
                            category: t.category,
                            distance: t.distance,
                            priority: t.priority
                        }))
                    };
                })[0]; // 첫 번째 POI 검색 결과만 사용

            const planSummary = {
                userQuestion: message,
                apartmentName: planContext.slots.apartmentName,
                planActions: plan.actions.map(a => a.type),
                poiData: detailedPOIData,
                executionResults: execution.results.map(result => ({
                    success: result.success,
                    actionType: result.data?.functionName || 'unknown',
                    hasData: !!result.data,
                    dataType: result.data ? {
                        deals: result.data.deals?.length || 0,
                        pois: result.data.pois?.length || 0,
                        categoryStats: result.data.categoryStats || {},
                        transportation: result.data.transportation?.length || 0,
                        error: result.error
                    } : null
                }))
            };

            // POI 데이터를 기반으로 상세 프롬프트 구성
            let detailedDataPrompt = '';
            if (detailedPOIData) {
                detailedDataPrompt = `

=== 수집된 상세 데이터 ===
📍 카테고리별 통계:
${JSON.stringify(detailedPOIData.categoryStats, null, 2)}

🚇 지하철역 정보:
${detailedPOIData.subwayStations?.map(station =>
                    `- ${station.name} (${station.category}), 거리: ${station.distance}m`
                ).join('\n') || '지하철역 정보 없음'}

🏢 주요 시설:
${detailedPOIData.otherPOIs?.slice(0, 8).map(poi =>
                    `- ${poi.name} (${poi.category}), 거리: ${poi.distance}m`
                ).join('\n') || '주요 시설 정보 없음'}`;
            }

            // 🏠 아파트 컨텍스트 정보 구성
            let apartmentContextInfo = '';
            if (finalApartmentName) {
                apartmentContextInfo += `\n\n=== 현재 대상 아파트 ===\n`;
                apartmentContextInfo += `📍 **아파트명**: ${finalApartmentName}\n`;

                if (selectedApartmentMetadata) {
                    apartmentContextInfo += `📍 **아파트 ID**: ${selectedApartmentMetadata.id || '미상'}\n`;
                    apartmentContextInfo += `📍 **주소**: ${selectedApartmentMetadata.address || '미상'}\n`;
                    apartmentContextInfo += `📍 **좌표**: ${selectedApartmentMetadata.lat}, ${selectedApartmentMetadata.lon}\n`;
                }

                // 프론트엔드에서 미리 로딩된 전체 데이터 활용
                const fullData = apartmentFullData[finalApartmentName];
                if (fullData) {
                    apartmentContextInfo += `\n**📊 미리 로딩된 아파트 데이터**:\n`;

                    if (fullData.nearbyPOIs) {
                        apartmentContextInfo += `- 🎯 **주변 편의시설**: 총 ${fullData.nearbyPOIs.total}개\n`;
                        const categories = fullData.nearbyPOIs.categories;
                        if (categories.education?.length) {
                            apartmentContextInfo += `  - 🏫 교육시설: ${categories.education.length}개\n`;
                        }
                        if (categories.transportation?.length) {
                            apartmentContextInfo += `  - 🚇 교통시설: ${categories.transportation.length}개\n`;
                        }
                        if (categories.convenience?.length) {
                            apartmentContextInfo += `  - 🏪 편의시설: ${categories.convenience.length}개\n`;
                        }
                    }

                    if (fullData.recentDeals) {
                        apartmentContextInfo += `- 💰 **실거래가**: 최근 ${fullData.recentDeals.total}건\n`;
                        if (fullData.recentDeals.summary.recentPrice) {
                            apartmentContextInfo += `  - 최근 거래가: ${Math.floor(fullData.recentDeals.summary.recentPrice / 10000)}억원\n`;
                        }
                        if (fullData.recentDeals.summary.avgPrice) {
                            apartmentContextInfo += `  - 평균 거래가: ${Math.floor(fullData.recentDeals.summary.avgPrice / 10000)}억원\n`;
                        }
                    }

                    if (fullData.buildingInfo) {
                        apartmentContextInfo += `- 🏢 **건물정보**: ${fullData.buildingInfo.total_count || 0}개 동\n`;
                    }

                    if (fullData.areasInfo) {
                        apartmentContextInfo += `- 📐 **면적정보**: ${fullData.areasInfo.count}개 타입\n`;
                    }
                }
            }

            // 대화 히스토리에서 이전 아파트들 추출
            const previousApartments = c.session?.messageHistory
                ?.filter((msg: any) => msg.extractedSlots?.apartmentName)
                ?.map((msg: any) => msg.extractedSlots.apartmentName)
                ?.filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index) // 중복 제거
                ?.slice(-3) || []; // 최근 3개만

            const conversationContext = previousApartments.length > 0
                ? `\n\n=== 대화 히스토리 ===\n이전에 언급된 아파트들: ${previousApartments.join(', ')}\n현재 주 대상: ${finalApartmentName}`
                : '';

            // 🔍 사용자 정정사항 추적 (대화 히스토리에서)
            const userCorrections = context?.messages
                ?.filter((msg: any) =>
                    msg.message && (
                        msg.message.includes('없어') ||
                        msg.message.includes('아니') ||
                        msg.message.includes('제대로') ||
                        msg.message.includes('잘못') ||
                        msg.message.includes('그게') ||
                        msg.message.includes('아닌') ||
                        msg.message.includes('틀렸')
                    )
                )
                ?.map((msg: any) => msg.message)
                ?.slice(-5) || []; // 최근 5개 정정사항만

            // 🎯 현재 메시지가 정정사항인지 확인
            const isCurrentMessageCorrection = message && (
                message.includes('없어') ||
                message.includes('아니') ||
                message.includes('제대로') ||
                message.includes('잘못') ||
                message.includes('그게') ||
                message.includes('아닌') ||
                message.includes('틀렸')
            );

            // 📊 실제 데이터 검증 및 요약
            const validateAndSummarizeData = (poiData: any) => {
                if (!poiData) {
                    return "❌ 수집된 데이터가 없습니다.";
                }

                let summary = "✅ 실제 수집된 데이터:\n";

                // 지하철역 정보 검증
                if (poiData.subwayStations && poiData.subwayStations.length > 0) {
                    const stations = poiData.subwayStations.map((s: any) => `${s.name} (거리: ${s.distance}m)`).join(', ');
                    summary += `🚇 지하철역: ${stations}\n`;
                } else {
                    summary += `🚇 지하철역: 없음\n`;
                }

                // 기타 시설 정보
                if (poiData.otherPOIs && poiData.otherPOIs.length > 0) {
                    const facilities = poiData.otherPOIs.slice(0, 5).map((p: any) => `${p.name}(${p.category})`).join(', ');
                    summary += `🏢 주요시설: ${facilities}\n`;
                }

                // 카테고리별 통계
                if (poiData.categoryStats) {
                    const stats = Object.entries(poiData.categoryStats)
                        .map(([category, count]) => `${category}: ${count}개`)
                        .join(', ');
                    summary += `📊 시설통계: ${stats}\n`;
                }

                return summary;
            };

            const dataValidation = validateAndSummarizeData(detailedPOIData);
            const correctionsContext = userCorrections.length > 0
                ? `\n\n⚠️ **사용자 정정사항**: ${userCorrections.join(' | ')}`
                : '';

            // 🚨 현재 메시지가 정정사항인 경우 특별 처리
            const correctionAlert = isCurrentMessageCorrection
                ? `\n\n🚨 **중요**: 현재 메시지가 정정사항입니다! 사용자의 정정을 즉시 인정하고 사과하세요.`
                : '';

            // 🔍 Critic 검증 결과를 프롬프트에 반영
            const criticAlert = criticResult.hasIssue
                ? `\n\n⚠️ **데이터 검증 결과**: ${criticResult.explanation}${criticResult.userMessage ? `\n사용자 메시지: ${criticResult.userMessage}` : ''}`
                : '';

            // 🔍 벡터DB RAG 컨텍스트 구성
            const ragContext = vectorResults.length > 0
                ? `\n\n📚 **관련 데이터베이스 정보** (벡터 검색 결과):\n${vectorResults.map((result, idx) =>
                    `${idx + 1}. **${result.metadata.schema_name || '스키마'}.${result.metadata.table_name || '테이블'}** (유사도: ${result.metadata.score.toFixed(3)})\n   ${result.content.slice(0, 200)}...`
                ).join('\n\n')}`
                : '';

            const llmPrompt = `당신은 정확하고 신뢰할 수 있는 부동산 임장 도우미입니다.

**🚨 중요 규칙**:
1. **오직 제공된 실제 데이터만 사용**: 추측하거나 일반적인 지식을 사용하지 마세요
2. **사용자 정정사항 반드시 인정**: 사용자가 "없어", "아니"라고 한 내용은 절대 반박하지 마세요
3. **모르는 것은 솔직히 말하기**: 데이터에 없는 정보는 "모르겠습니다"라고 답변하세요

**사용자 질문**: ${message}${correctionsContext}${correctionAlert}${criticAlert}${ragContext}

${dataValidation}

**답변 가이드라인**:
1. **📊 데이터 기반 답변**: 위의 실제 데이터만을 인용하여 답변하세요
2. **🗣️ 정정사항 반영**: 사용자가 정정한 내용이 있다면 즉시 인정하고 사과하세요
3. **✨ 구체적 정보**: "지하철역이 있어요"가 아닌 실제 역명과 거리를 정확히 말하세요
4. **📚 벡터DB 활용**: 관련 데이터베이스 정보가 있다면 이를 참고하여 정확한 테이블/컬럼 정보 제공
5. **📝 마크다운 활용**: **굵은 글씨**, - 불릿 포인트로 가독성 높게 구성
6. **💬 적절한 길이**: 200-400자 내외로 간결하면서도 유용하게
7. **🤔 솔직한 소통**: 정보가 부족하면 솔직하게 알려주고 추가 질문 유도

**절대 하지 마세요**:
- 존재하지 않는 지하철역이나 시설을 만들어내기
- 사용자의 정정사항을 무시하거나 반박하기
- 일반적인 지식으로 추측하여 답변하기`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "당신은 정확하고 신뢰할 수 있는 부동산 임장 도우미입니다. 절대 추측하지 마세요. 오직 제공된 실제 데이터와 벡터DB 검색 결과만을 사용하여 답변하세요. 사용자가 정정한 내용이 있다면 즉시 인정하고 사과하세요. 데이터에 없는 정보는 '모르겠습니다'라고 솔직히 말하세요. 관련 데이터베이스 스키마 정보가 제공되면 이를 활용하여 정확한 정보를 제공하세요."
                    },
                    {
                        role: "user",
                        content: llmPrompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            reply = completion.choices[0]?.message?.content || "죄송해요, 응답 생성 중 오류가 발생했네요 😅";

            console.log('🤖 OpenAI 응답 생성 완료:', reply.slice(0, 100) + '...');

        } catch (llmError: any) {
            console.error('❌ OpenAI 응답 생성 오류:', llmError);
            // Fallback 메시지
            reply = "음, 응답 생성 중 문제가 생겼네요 😅 혹시 다시 한 번 물어봐 주실 수 있을까요?";
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


export default chatBotRoute;