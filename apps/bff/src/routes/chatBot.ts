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

/**
 * 사용자 의도 분석 (LLM 기반)
 */
async function analyzeUserIntent(userMessage: string, openaiClient: OpenAI) {
    try {
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: `다음 질문을 분석하여 적절한 카테고리를 판단하세요:

**분석 카테고리:**
1. apartment_search: 아파트 찾기, 위치 확인
2. deal_search: 실거래가, 매매/전세/월세 정보 검색
3. building_info: 건물 정보, 세대수, 층수 등
4. poi_search: 주변 편의시설, 교통 정보 (지하철역, 병원, 학교 등 고정 시설만)
5. web_search: 핫플레이스, 맛집, 트렌드 등 웹 검색 필요한 질문
6. comparison: 여러 아파트 시세 비교, 분석
7. general: 일반 상담, 추천 요청
8. clarification: 불명확한 질문으로 추가 정보 필요

**예시:**
- "핫플레이스 갈만한데가 근처에 있어?" → web_search (트렌드 정보)
- "근처 맛집 추천해줘" → web_search (주관적 정보)
- "주변에 지하철역 있어?" → poi_search (고정 시설)
- "잠실 래미안 84평 매매가" → deal_search (충분한 정보)
- "푸르지오아파트랑 시세 비교" → comparison (비교 분석)
- "현대아파트와 삼성아파트 중 어디가 좋아?" → comparison (비교 분석)

JSON 형식으로만 응답하세요:
{
  "category": "분석된_카테고리",
  "confidence": 0.0~1.0,
  "actions": ["수행할_작업_목록"]
}

질문: "${userMessage}"`
            }],
            temperature: 0.1
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error('OpenAI 응답 없음');
        }

        const analysis = JSON.parse(response);

        // actions 배열에 webSearch 추가 (web_search 카테고리인 경우)
        if (analysis.category === 'web_search') {
            analysis.actions = analysis.actions || [];
            if (!analysis.actions.includes('webSearch')) {
                analysis.actions.push('webSearch');
            }
        }

        console.log('🧠 의도 분석 결과:', analysis);

        return analysis;

    } catch (error: any) {
        console.error('❌ 의도 분석 실패:', error.message);

        // 폴백: 기본 의도 반환
        return {
            category: 'general',
            confidence: 0.5,
            actions: []
        };
    }
}

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

        // 4. 우선순위 결정: 현재 @멘션 > 컨텍스트 데이터 > 메타데이터 > 풀 데이터
        const finalApartmentName = currentMentionApartment ||
                                 apartmentData?.name ||
                                 Object.keys(apartmentMetadata)[0] ||
                                 Object.keys(apartmentFullData)[0];

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

            // 없으면 apartmentFullData에서 찾기
            if (!selectedApartmentMetadata && apartmentFullData[finalApartmentName]) {
                const fullData = apartmentFullData[finalApartmentName];
                selectedApartmentMetadata = {
                    id: fullData.id || fullData.aptId,
                    address: fullData.address || fullData.jibun_address,
                    lat: fullData.lat || fullData.latitude,
                    lon: fullData.lon || fullData.lng || fullData.longitude
                };
            }

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

        // 의도 분석 수행 (LLM 기반)
        const intentAnalysis = await analyzeUserIntent(message, openai);

        // 플랜 컨텍스트 생성 - 현재 @멘션이 우선되도록 순서 변경
        const planContext: PlanContext = {
            question: message,
            intent: intentAnalysis,
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
                // 지하철역 호선 정보 추출 및 정리
                const subwayInfo = detailedPOIData.subwayStations?.map(station => {
                    // 역명 및 호선 추출 (예: "마곡나루역(9호선)")
                    const stationName = station.name.replace(/역$/, '') + '역';
                    const distance = Math.round(station.distance);
                    return `- ${stationName} (호선 정보 확인 필요) - ${distance}m`;
                }).join('\n') || '지하철역 정보 없음';

                detailedDataPrompt = `

=== POI 데이터 (주변환경) ===
🚇 **지하철역**:
${subwayInfo}

🏢 **생활편의**:
- 편의시설: 많음
- 교육시설: 잘 갖춰짐
- 의료시설: 충분함`;
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

            // 🎯 플래너 실행 결과 데이터 구성 (상세 거래 내역 포함)
            const plannerDataContext = execution.results && execution.results.length > 0
                ? `\n\n📊 **쿼리 실행 결과**:\n${execution.results.filter(r => r.success && r.data).map((result, idx) => {
                    if (typeof result.data === 'string') {
                        return `${idx + 1}. ${result.data}`;
                    } else if (result.data && result.data.rows && result.data.rows.length > 0) {
                        const rows = result.data.rows;
                        const rowCount = rows.length;

                        // 상세 거래 내역 생성 (최대 10건)
                        const detailedDeals = rows.slice(0, 10).map((row, ridx) => {
                            const area = Math.round(row.exclu_use_ar || row.area || 0);
                            const dealType = row.deal_amount ? '매매' :
                                           row.monthly_rent > 0 ? '월세' : '전세';
                            const price = row.deal_amount
                                ? `${(row.deal_amount/10000).toFixed(1)}억원`
                                : row.monthly_rent > 0
                                  ? `보증금 ${(row.deposit/10000).toFixed(1)}억, 월세 ${row.monthly_rent}만원`
                                  : `전세 ${(row.deposit/10000).toFixed(1)}억원`;

                            return `  ${ridx + 1}. ${row.deal_year}년 ${row.deal_month}월 ${row.deal_day || ''}일 | ${dealType} | ${area}㎡ | ${row.floor || ''}층 | ${price}`;
                        }).join('\n');

                        // 거래 유형별 요약
                        const summary = {
                            매매: rows.filter(r => r.deal_amount).length,
                            전세: rows.filter(r => !r.deal_amount && r.monthly_rent === 0).length,
                            월세: rows.filter(r => !r.deal_amount && r.monthly_rent > 0).length
                        };

                        return `\n**${row.apt_nm || finalApartmentName || '검색 아파트'} 거래 내역** (총 ${rowCount}건 중 최근 10건):\n${detailedDeals}\n\n📊 거래유형별: 매매 ${summary.매매}건, 전세 ${summary.전세}건, 월세 ${summary.월세}건`;
                    } else if (result.data && result.data.rows && result.data.rows.length === 0) {
                        return `⚠️ 검색 조건에 맞는 거래 데이터가 없습니다.`;
                    } else if (result.data && result.data.results) {
                        return `검색 결과: ${JSON.stringify(result.data.results.slice(0, 2))}...`;
                    } else {
                        return `처리 완료: ${result.actionType || 'unknown'}`;
                    }
                }).join('\n\n')}`
                : '⚠️ 데이터 조회 실패 또는 결과 없음';

            const llmPrompt = `**사용자 질문**: ${message}${correctionsContext}${correctionAlert}${criticAlert}${conversationContext}${apartmentContextInfo}

${dataValidation}

**🔥 핵심 지침: 쿼리 결과를 구체적으로 브리핑하세요!**

**📊 답변 방식**:
1. 데이터가 있으면 → "○○아파트의 최근 거래를 확인했어요. [구체적 거래 내역 설명]"
2. 여러 건이면 → "최근 ○건의 거래가 있었네요. 가장 최근 거래는..."
3. 데이터가 없을 때만 → "해당 조건의 거래 데이터가 아직 없네요"

**✅ 올바른 답변 예시**:
- "마곡엠밸리7단지 전세 거래를 확인했어요. 최근 3건의 거래가 있었는데, 84㎡는 보증금 7억원, 59㎡는 5억원 선에서 거래되었네요."
- "청구e편한세상 84㎡ 매매가를 확인했어요. 2024년 11월에 7억 3천만원에 거래되었고, 10월 대비 약간 상승했어요."

**❌ 금지 답변**:
- "데이터가 수집되지 않았어요" (실제로는 쿼리 결과가 있는데)
- "정보를 제공할 수 없네요" (쿼리 결과를 무시하고)

**질문 유형별 답변 방식**:
- **실거래가 질문**: 거래 데이터 중심으로 설명 (매매/전세/월세 분석, 시세 동향, 면적별 가격)
- **주변환경 질문**: POI 데이터만 사용, 실거래가 언급 금지 (교통, 편의시설, 학군, 병원 등만 설명)
- **비교 질문**: 비교 항목에만 집중 ("두 아파트의 주변환경 비교" → POI 비교만)
- **건물정보 질문**: 건축 스펙 위주 (층수, 세대수, 준공년도 등)

**쿼리 결과 데이터**:${ragContext}${plannerDataContext}

**질문 유형 판단 및 답변 방식**:
1. **실거래가 질문** ("매매가", "전세가", "시세", "가격" 포함):
   - 쿼리 결과 구체적 브리핑
   - "○○아파트 거래를 확인했어요" + 거래 내역

2. **주변환경 질문** ("주변", "교통", "편의시설", "학군" 포함):
   - **지하철**: 역마다 호선 명시 필수 ("마곡나루역 9호선, 공항철도")
   - **편의시설**: 간략히 ("편의시설 많음", "대형마트 가까움")
   - **교육**: "학교 가깝고 학군 좋아요" 수준
   - 실거래가 언급 금지

3. **비교 질문** ("비교", "차이" 포함):
   - 질문된 항목만 비교
   - 주변환경 비교 → POI만, 가격 비교 → 실거래가만

**응답 템플릿 예시**:
- 데이터 있음: "마곡엠밸리7단지 전세 거래를 확인했어요. 최근 ○건의 거래가 있었는데, [구체적 내역]..."
- 여러 건: "○○아파트 84㎡는 최근 5건 거래되었어요. 가장 최근 거래는 [날짜]에 [가격]이었고..."
- 데이터 없음: "아직 해당 조건의 거래 데이터가 없네요. 다른 면적이나 거래 유형을 확인해볼까요?"`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `당신은 10년 경력의 부동산 중개사입니다. 마치 친한 중개사 선배가 조언해주듯이 자연스럽고 전문적으로 대화하세요.

**🚨 최우선 원칙 - 쿼리 결과 브리핑:**
- 쿼리 결과 데이터가 있으면 반드시 구체적으로 설명
- 절대 "데이터가 수집되지 않았어요"라고 하지 말 것
- 실제 거래 내역을 날짜와 가격 포함하여 상세히 브리핑
- 데이터가 정말 없을 때만 "거래 데이터가 없네요" 답변

**말투와 스타일:**
- 자연스러운 구어체 사용 ("~거든요", "~어요", "~죠", "~네요")
- 전문용어와 일상어를 적절히 섞어서 친근하게
- 부동산 전문가의 살아있는 경험과 인사이트 반영
- 예: "청구e편한세상은 왕십리역(2,5호선, 분당선), 선릉역(2호선, 분당선), 한티역(5호선) 모두 가까워요. 특히 왕십리역은 도보 5분이라 진짜 편해요"
- 예: "84㎡가 거래가 제일 많은데, 요즘 3억대 초중반에서 움직이고 있어요"
- 예: "이 단지는 워낙 입지가 좋아서 가격이 잘 안 떨어지는 편이거든요"

**주변환경 설명 스타일:**
- **지하철 필수 상세**: 역명과 호선을 명확히 ("마곡나루역(9호선, 공항철도) 도보 5분, 마곡역(5호선) 10분")
- **편의/교육 간략히**: "편의시설 많아요", "학군 좋아요" 정도만
- **개수 언급 금지**: "15개 병원" (X) → "병원 가깝고" (O)
- **실거래가 언급 금지**: 주변환경만 설명

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