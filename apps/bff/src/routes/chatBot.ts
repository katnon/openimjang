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

        // 대화 히스토리에서 이전 질문들의 상세 정보 추출
        const previousQuestions = c.session?.messageHistory
            ?.filter((msg: any) => msg.extractedSlots || msg.message)
            ?.map((msg: any) => {
                const slots = msg.extractedSlots || {};
                return {
                    message: msg.message?.slice(0, 50) + (msg.message?.length > 50 ? '...' : ''),
                    apartmentName: slots.apartmentName,
                    area: slots.area,
                    dealType: slots.dealType,
                    region: slots.region
                };
            })
            ?.filter((q: any) => q.apartmentName || q.area || q.dealType) // 의미있는 정보가 있는 것만
            ?.slice(-3) || []; // 최근 3개만

        // 연속 질문 패턴 감지 (같은 아파트, 다른 면적)
        const hasAreaComparison = previousQuestions.length >= 2 && 
            previousQuestions.some(q => q.area && q.apartmentName === finalApartmentName);

        // 풍부한 대화 컨텍스트 구성
        const conversationContext = previousQuestions.length > 0
            ? `\n\n=== 대화 맥락 ===\n${previousQuestions.map((q, idx) => 
                `${idx + 1}번째 질문: "${q.message}" (아파트: ${q.apartmentName || '미지정'}, 면적: ${q.area || '미지정'}, 유형: ${q.dealType || '미지정'})`
              ).join('\n')}
현재 질문 대상: ${finalApartmentName} ${c.slots?.area ? c.slots.area + '㎡' : ''} ${c.slots?.dealType || ''}
${hasAreaComparison ? '⚠️ 면적 비교 질문 패턴 감지됨 - 이전 질문과의 연관성 고려 필요' : ''}`
            : '';

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
                previousQuestions, // 이전 질문들의 상세 정보
                hasAreaComparison, // 면적 비교 패턴 감지 여부
                conversationContext, // 대화 맥락
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

        // 🔍 벡터DB RAG 검색 제거: 의미 없는 검색 대신 실제 DB 데이터에 집중
        // console.log('🔍 벡터DB RAG 검색 시작:', message.slice(0, 50));
        // const vectorResults = await vectorService.search(message, { topK: 5 });
        const vectorResults: any[] = []; // 빈 배열로 대체

        // console.log('📊 벡터 검색 결과:', {
        //     found: vectorResults.length,
        //     topScore: vectorResults[0]?.metadata.score || 0,
        //     schemas: [...new Set(vectorResults.map(r => r.metadata.schema_name).filter(Boolean))]
        // });

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

            // 🎯 플래너 실행 결과 데이터 구성 (면적별 정보 강조)
            const plannerDataContext = execution.results && execution.results.length > 0
                ? `\n\n📊 **실제 수집된 데이터 (절대적 기준)**:\n${execution.results.filter(r => r.success && r.data).map((result, idx) => {
                    if (typeof result.data === 'string') {
                        return `${idx + 1}. ${result.data}`;
                    } else if (result.data && result.data.rows) {
                        const rowCount = result.data.rows.length;
                        
                        // 거래 유형별 실제 가격 정보 추출
                        const dealAnalysis = {
                            매매: [],
                            전세: [],
                            월세: []
                        };
                        
                        result.data.rows.forEach(row => {
                            const area = Math.round(row.exclu_use_ar || row.area || 0);
                            const dealAmount = row.deal_amount;
                            const deposit = row.deposit;
                            const monthlyRent = row.monthly_rent;
                            
                            if (dealAmount) {
                                dealAnalysis.매매.push(`${area}㎡: ${dealAmount.toLocaleString()}만원`);
                            } else if (deposit && (!monthlyRent || monthlyRent === 0)) {
                                dealAnalysis.전세.push(`${area}㎡: ${deposit.toLocaleString()}만원`);
                            } else if (deposit && monthlyRent > 0) {
                                dealAnalysis.월세.push(`${area}㎡: 보증금${deposit.toLocaleString()}만원/월세${monthlyRent.toLocaleString()}만원`);
                            }
                        });
                        
                        let priceBreakdown = '';
                        if (dealAnalysis.매매.length > 0) {
                            priceBreakdown += `\n   🏷️ 매매가 (${dealAnalysis.매매.length}건): ${dealAnalysis.매매.slice(0, 5).join(', ')}`;
                        }
                        if (dealAnalysis.전세.length > 0) {
                            priceBreakdown += `\n   🏠 전세가 (${dealAnalysis.전세.length}건): ${dealAnalysis.전세.slice(0, 5).join(', ')}`;
                        }
                        if (dealAnalysis.월세.length > 0) {
                            priceBreakdown += `\n   🏡 월세 (${dealAnalysis.월세.length}건): ${dealAnalysis.월세.slice(0, 3).join(', ')}`;
                        }
                        
                        return `${idx + 1}. 🚨 **반드시 이 데이터만 사용하세요** (총 ${rowCount}건):${priceBreakdown}`;
                    } else if (result.data && result.data.results) {
                        return `${idx + 1}. 검색 결과: ${JSON.stringify(result.data.results.slice(0, 2))}...`;
                    } else {
                        return `${idx + 1}. 처리 완료: ${result.actionType}`;
                    }
                }).join('\n\n')}`
                : '';

            const llmPrompt = `🚨 **매우 중요**: 아래 실제 거래 데이터의 정확한 가격만 사용하세요! 절대 추측하거나 다른 가격을 말하지 마세요!

**사용자 질문**: ${message}${correctionsContext}${correctionAlert}${criticAlert}${conversationContext}${apartmentContextInfo}

${dataValidation}

**🔥 필수 준수사항**:
1. 매매가는 deal_amount 값만 사용 (예: 73500만원 → "7억 3천 5백만원")
2. 전세가는 deposit 값 중 monthly_rent가 0인 것만 사용 (예: 30000만원 → "3억원")  
3. 월세는 deposit + monthly_rent 조합만 사용
4. 실제 데이터에 없는 가격은 절대 말하지 말 것

**분석 지침**:
- 실거래가 질문 시: 거래 유형별(매매/전세/월세) 분석, 가장 활발한 면적대, 최근 시세 동향, 주변 단지 대비 경쟁력
- 주변환경 질문 시: 교통 접근성(역세권 여부), 생활편의시설 도보권, 인프라 종합 평가  
- 건물정보 질문 시: 핵심 스펙(층수, 세대수, 구조 등)과 실용적 의미 설명
- 연속 질문 시: 이전 대화 맥락을 고려하여 "84㎡는 3억대, 59㎡는 2억 중반대" 같은 자연스러운 비교 답변

**거래 유형별 답변 스타일**:
- 매매: "청구e편한세상 84㎡ 매매가는 최근 3억 2천만원대에서 거래되고 있어요. 작년 대비 5% 정도 올랐는데..."
- 전세: "전세는 2억 8천만원 선에서 형성되고 있고, 요즘 전세 물건이 많이 나오지 않아서 구하기가 쉽지 않아요"
- 월세: "월세는 보증금 5천만원에 월 120만원 정도가 시세인데, 최근 전세 대신 월세 선호하는 분들이 늘고 있어요"
- 통합: "84㎡ 기준으로 매매 3억대, 전세 2억 8천, 월세 보증금 5천에 120만원 정도가 현재 시세예요"

**면적별 비교 질문 처리**:
- 같은 아파트의 다른 면적을 물어볼 때는 이전 대화를 참고하여 비교 형태로 답변
- 예: "84㎡는 3억 2천 정도인데, 59㎡는 2억 7천 정도에서 거래되고 있어요. 84㎡가 더 인기가 많아서..."
- 예: "앞에서 말씀드린 84㎡보다 59㎡가 약간 더 저렴하죠. 면적 차이만큼 가격도 비례해서..."

**추가 컨텍스트**:${ragContext}${plannerDataContext}

**⚠️ 절대 금지사항 (매우 중요)**:
- 실제 데이터에 없는 면적이나 거래가를 지어내서 답변하기
- 59㎡ 데이터가 없으면 "59㎡ 거래 데이터가 없습니다"라고 정확히 말하기
- 존재하지 않는 지하철역이나 시설을 만들어내기
- 사용자의 정정사항을 무시하거나 반박하기
- 일반적인 지식으로 추측하여 답변하기
- 이전 대화 맥락을 무시하고 매번 처음부터 설명하기

**데이터 검증 필수**:
- 수집된 데이터에서 해당 면적이 실제로 존재하는지 반드시 확인
- 데이터에 없는 면적을 물어보면 "해당 면적 거래 데이터가 없어요" 명확히 답변
- 실제 거래된 면적만 언급하고 가격도 실제 데이터 기준으로만 답변`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `당신은 10년 경력의 부동산 중개사입니다. 마치 친한 중개사 선배가 조언해주듯이 자연스럽고 전문적으로 대화하세요.

**🚨 최우선 원칙 - 데이터 정확성:**
- 제공된 실제 거래 데이터에만 기반해서 답변
- 존재하지 않는 면적(예: 59㎡)을 물어보면 "59㎡ 거래 데이터가 없어요"라고 명확히 답변
- 절대로 추측하거나 일반적인 지식으로 답변하지 말 것
- 실제 데이터에서 확인된 면적과 가격만 언급

**말투와 스타일:**
- 자연스러운 구어체 사용 ("~거든요", "~어요", "~죠", "~네요")
- 전문용어와 일상어를 적절히 섞어서 친근하게
- 부동산 전문가의 살아있는 경험과 인사이트 반영
- 예: "청구e편한세상이요? 여기 진짜 좋아요! 2,5,6호선 트리플역세권이라 교통은 말할 것도 없고"
- 예: "84㎡가 거래가 제일 많은데, 요즘 3억대 초중반에서 움직이고 있어요"
- 예: "이 단지는 워낙 입지가 좋아서 가격이 잘 안 떨어지는 편이거든요"

**실거래가 분석할 때:**
- 거래 유형별로 구분해서 설명 (매매/전세/월세)
- 실제 데이터에 존재하는 면적대만 언급
- 최근 3-6개월 시세 흐름 설명 ("요즘 ~하는 추세", "작년 대비 ~정도")
- 거래 유형별 특징 설명 (매매는 가격 상승률, 전세는 구하기 어려움, 월세는 보증금/월세 비율)
- 왜 그런 가격인지 근거 설명 (교통, 학군, 개발호재 등)
- 매수/매도 타이밍에 대한 솔직한 의견

**면적 관련 질문 처리:**
- 데이터에 없는 면적을 물어보면: "59㎡ 거래 데이터가 없네요. 실제로는 84㎡, 85㎡ 위주로 거래되고 있어요"
- 실제 존재하는 면적만 언급하고 가격 정보 제공

**주변환경 설명할 때:**
- "도보 5분", "걸어서 10분" 같은 구체적인 거리
- "아이 키우기 좋은 환경", "직장인이 살기 편한 곳" 등 라이프스타일 관점
- "요즘 이 동네가 뜨고 있어요" 같은 트렌드 설명

**절대 주의사항:**
- 데이터 없는 내용은 절대 지어내지 말 것
- 존재하지 않는 면적의 가격을 만들어내지 말 것
- 로봇 같은 딱딱한 나열 금지
- 틀렸을 때는 바로 인정하고 "죄송해요, 제가 착각했네요"식으로 자연스럽게`
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