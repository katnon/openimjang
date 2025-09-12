// apps/bff/src/routes/aiChat.ts - 새로운 표준 패턴 적용 + 슬롯 미들웨어 통합
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { slotMiddleware, getSlotStatus, deleteSession } from '../middleware/sessionSlots';
// ⚠️ LEGACY Function Calling imports - legacy 엔드포인트에서만 사용
import { tools as functionTools } from '../ai/tools';
import { handlers as functionHandlers } from '../ai/handlers';
import { validateSchema } from '../ai/tools/validation';
import { processAIResponse } from '../ai/processors/responseProcessor';

// 플래너 시스템 import
import { 
  defaultPlanner, 
  defaultExecutor, 
  registerBridgeHandlers, 
  PlanContext, 
  SystemCapabilities,
  PlanConstraints 
} from '../ai/planner';

const aiChatRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 플래너 시스템 초기화
registerBridgeHandlers(defaultExecutor);
console.log('🎯 플래너 시스템 초기화 완료');

// POST /chat-legacy - 기존 Function Calling (사용 중단)
aiChatRoute.post('/chat-legacy', authMiddleware, slotMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🔍 챗봇 요청:', { 
            message: message?.slice(0, 100) + '...',
            extractedApartments: context?.extractedApartments?.length || 0
        });

        // 1) 시스템/유저 메시지 구성 (사용자 프로필 + 대화 기록 + 슬롯 정보 + 추출된 아파트 정보 포함)
        const systemPrompt = createPersonalizedSystemPrompt(
            context?.userProfile || c.session?.userProfile, 
            context?.messages || c.session?.messageHistory,
            c.slots,
            context?.extractedApartments // @아파트명들 전달
        );
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
                        content: JSON.stringify(result)
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

        // 4) 최종 답변 처리 및 스마트 링크 생성
        const finalMsg = resp.choices?.[0]?.message?.content ?? '죄송합니다. 답변을 생성하지 못했습니다.';
        
        // 스마트 링크 처리
        let processedResponse;
        try {
            processedResponse = await processAIResponse(finalMsg);
            console.log('🔗 스마트 링크 생성 완료:', {
                entitiesCount: processedResponse.detectedEntities.length,
                processingTime: processedResponse.metadata.processingTime
            });
        } catch (error: any) {
            console.error('❌ 스마트 링크 처리 실패:', error);
            // 실패 시 원본 텍스트 사용
            processedResponse = {
                htmlContent: finalMsg,
                detectedEntities: [],
                metadata: {
                    originalLength: finalMsg.length,
                    processedLength: finalMsg.length,
                    entitiesCount: 0,
                    processingTime: 0
                }
            };
        }
        
        return c.json({ 
            success: true, 
            reply: processedResponse.htmlContent,
            originalReply: finalMsg,
            detectedEntities: processedResponse.detectedEntities,
            linkMetadata: processedResponse.metadata,
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
 * 사용자 프로필, 대화 기록, 슬롯 정보, 추출된 아파트 정보를 기반으로 개인화된 시스템 프롬프트를 생성합니다
 */
function createPersonalizedSystemPrompt(userProfile: any, recentMessages?: any[], currentSlots?: any, extractedApartments?: Array<{name: string; id?: number; address?: string; lat?: number; lon?: number}>): string {
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

    // 슬롯 정보가 있는 경우 컨텍스트 추가 (새로운 기능)
    if (currentSlots && Object.keys(currentSlots).length > 0) {
        console.log('🎯 현재 슬롯 정보 기반 컨텍스트 추가:', Object.keys(currentSlots));
        
        const slotContext = createSlotContext(currentSlots);
        basePrompt += slotContext;
    }

    // 추출된 아파트 정보가 있는 경우 컨텍스트 추가
    if (extractedApartments && extractedApartments.length > 0) {
        console.log('🏠 추출된 아파트 정보 기반 컨텍스트 추가:', extractedApartments.map(a => a.name).join(', '));
        
        let apartmentContext = `

📍 **현재 언급된 아파트 정보 - 사용자가 @로 언급한 아파트들입니다:**`;

        extractedApartments.forEach((apt, index) => {
            apartmentContext += `
- **아파트 ${index + 1}**: ${apt.name}`;
            if (apt.address) {
                apartmentContext += ` (${apt.address})`;
            }
            if (apt.id) {
                apartmentContext += ` [ID: ${apt.id}]`;
            }
        });

        apartmentContext += `

**@아파트명 처리 지침:**
- 사용자가 @아파트명을 언급했다면 해당 아파트에 대한 상세 정보를 우선 제공하세요
- 복수의 아파트가 언급된 경우 모든 아파트에 대해 비교 분석을 제공하세요
- 실거래가 검색 시 언급된 아파트명을 그대로 사용하세요

**주변정보 문의 대응:**
- 사용자가 아파트 주변시설을 물어보면 ALWAYS searchNearbyPOI 함수를 호출하세요
- 슬롯에 apartmentMetadata가 있다면 contextAptData 파라미터로 전달하세요
- POI 검색 시 contextAptData 형식: {lat: 위도, lon: 경도, name: 아파트명, address: 주소}
- POI 검색 결과는 반드시 상세하고 구체적으로 설명하여 사용자에게 유용한 정보를 제공하세요
- "주변에 뭐가 있나요?", "편의시설은?", "교통은?" 등의 질문에 적극적으로 POI 검색을 활용하세요`;

        basePrompt += apartmentContext;
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
 * 현재 슬롯 정보를 기반으로 컨텍스트를 생성합니다 (새로운 슬롯 시스템)
 */
function createSlotContext(slots: any): string {
    let slotContext = `

🎯 **현재 대화 컨텍스트 (슬롯 기반) - 이 정보를 우선적으로 참조하세요:**`;

    // 아파트 정보
    if (slots.apartmentName) {
        slotContext += `
- **현재 아파트**: ${slots.apartmentName}`;
        if (slots.complexNumber) {
            slotContext += ` ${slots.complexNumber}`;
        }
        
        // 메타데이터 정보 추가
        if (slots.apartmentMetadata) {
            const metadata = slots.apartmentMetadata;
            if (metadata.lat && metadata.lon) {
                slotContext += ` (좌표: ${metadata.lat}, ${metadata.lon})`;
            }
            if (metadata.address) {
                slotContext += ` [주소: ${metadata.address}]`;
            }
        }
    }

    // 지역 정보
    if (slots.region) {
        slotContext += `
- **지역**: ${slots.region}`;
    }

    // 거래 조건
    if (slots.dealType) {
        slotContext += `
- **거래유형**: ${slots.dealType}`;
    }

    if (slots.area) {
        slotContext += `
- **면적**: ${slots.area}㎡`;
    }

    if (slots.areaRange) {
        slotContext += `
- **면적 범위**: ${slots.areaRange[0]}~${slots.areaRange[1]}㎡`;
    }

    if (slots.priceRange) {
        slotContext += `
- **가격 범위**: ${slots.priceRange[0]}~${slots.priceRange[1]}만원`;
    }

    if (slots.period) {
        slotContext += `
- **기간**: ${slots.period}`;
    }
    
    // 히든 슬롯 데이터 표시
    if (slots.realEstateDeals && slots.realEstateDeals.deals.length > 0) {
        const dealsInfo = slots.realEstateDeals;
        slotContext += `
- **실거래가 데이터**: ${dealsInfo.deals.length}건 (${dealsInfo.params.period}, ${dealsInfo.params.dealTypes.join('/')})`;
    }
    
    if (slots.buildingLandInfo) {
        const buildingInfo = slots.buildingLandInfo;
        slotContext += `
- **건물/토지 정보**: 로드됨 (건물 ${buildingInfo.buildingInfo?.title_infos?.length || 0}개, 용도지역 ${buildingInfo.landuseInfo?.landuse_zones?.length || 0}개)`;
    }
    
    if (slots.poiInfo && slots.poiInfo.pois.length > 0) {
        const poiInfo = slots.poiInfo;
        slotContext += `
- **주변 편의시설**: ${poiInfo.totalCount}개 (${poiInfo.searchConditions.radius}m 반경)`;
    }

    slotContext += `

**슬롯 기반 참조 해석 가이드:**
1. "그 아파트", "거기" → ${slots.apartmentName || '(아파트명 없음)'}
2. "그 단지" → ${slots.complexNumber || '(단지 정보 없음)'}
3. "그 지역" → ${slots.region || '(지역 정보 없음)'}
4. "그 크기", "같은 면적" → ${slots.area ? slots.area + '㎡' : '(면적 정보 없음)'}
5. 사용자가 불완전한 정보를 제공하면 위 슬롯 정보로 자동 보완하여 함수 호출

**중요**: 사용자가 "그 아파트"나 "거기" 등의 지시어를 사용하면, 반드시 위 슬롯 정보를 참조하여 구체적인 값으로 치환한 후 함수를 호출하세요.

**POI 검색 시 슬롯 활용 가이드:**
- 아파트 메타데이터가 있으면 contextAptData로 전달: {lat: ${slots.apartmentMetadata?.lat || 'null'}, lon: ${slots.apartmentMetadata?.lon || 'null'}, name: "${slots.apartmentName || ''}", address: "${slots.apartmentMetadata?.address || ''}"}
- 슬롯의 좌표 정보를 최우선으로 활용하여 정확한 위치 기반 POI 검색 수행

**히든 슬롯 데이터 활용 가이드:**
- realEstateDeals가 있으면 실거래가 질문에 즉시 응답 (Function Call 대신 슬롯 데이터 활용)
- buildingLandInfo가 있으면 건물/토지 정보 질문에 즉시 응답 
- poiInfo가 있으면 주변 편의시설 질문에 즉시 응답
- 슬롯 데이터가 최신인지 확인 (loadedAt 필드 참고)
- 슬롯 데이터가 있으면 "이미 로드된 정보를 바탕으로" 라고 명시하여 응답`;

    return slotContext;
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

// POST /chat - 플래너 기반 대화 처리 (새로운 표준)
aiChatRoute.post('/chat', authMiddleware, slotMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🎯 플래너 기반 챗봇 요청:', { message: message?.slice(0, 100) + '...' });

        // 0. Clarify 모드 확인 및 처리
        const { clarifyResponseHandler } = await import('../ai/clarify/responseHandler');
        
        if (clarifyResponseHandler.isInClarifyMode(c.session)) {
            const pendingField = c.session.pendingClarify?.field;
            
            console.log('🤔 Clarify 모드 - 응답 처리:', { field: pendingField });
            
            const clarifyResult = await clarifyResponseHandler.processUserResponse(
                message,
                pendingField,
                c.slots || {},
                context?.userProfile || c.session?.userProfile
            );

            if (!clarifyResult.success) {
                return c.json({
                    success: false,
                    error: clarifyResult.error || 'Clarify 응답 처리 실패'
                }, 400);
            }

            // 슬롯 업데이트
            if (clarifyResult.updatedSlots) {
                // 슬롯 미들웨어를 통해 업데이트
                Object.assign(c.slots || {}, clarifyResult.updatedSlots);
            }

            // 추가 Clarify가 필요한 경우
            if (clarifyResult.needsMoreClarification && clarifyResult.nextClarifyField) {
                // 다음 Clarify 질문 생성
                const { defaultClarifyPolicy } = await import('../ai/clarify/policy');
                const { ClarifyContext } = await import('../ai/clarify/types');
                
                const clarifyContext: ClarifyContext = {
                    currentSlots: c.slots || {},
                    reason: 'missing',
                    userProfile: context?.userProfile || c.session?.userProfile
                };

                const nextQuestion = await defaultClarifyPolicy.generateQuestion(
                    clarifyResult.nextClarifyField as any,
                    clarifyContext
                );

                clarifyResponseHandler.setClarifyMode(
                    c.session,
                    clarifyResult.nextClarifyField,
                    nextQuestion.question
                );

                return c.json({
                    success: true,
                    reply: nextQuestion.question,
                    clarify: true,
                    field: clarifyResult.nextClarifyField,
                    suggestions: nextQuestion.suggestions,
                    hint: nextQuestion.hint
                });
            } else {
                // Clarify 완료 - 일반 플래너 진행
                clarifyResponseHandler.clearClarifyMode(c.session);
                console.log('✅ Clarify 완료 - 플래너 실행 계속');
            }
        }

        // 1. 플랜 컨텍스트 생성
        const planContext: PlanContext = {
            question: message,
            intent: { category: 'general', confidence: 0, entities: [], actions: [] }, // 플래너에서 분석
            slots: c.slots || {},
            userProfile: context?.userProfile || c.session?.userProfile,
            sessionHistory: {
                messageCount: c.session?.messageHistory?.length || 0,
                lastQuestionTypes: [], // 추후 구현
                completedActions: [],
                failedActions: []
            },
            capabilities: {
                availableFunctions: ['searchRealEstate', 'searchPOI', 'getBuildingInfo'],
                maxExecutionTime: 30000,
                allowedDataSources: ['database', 'external_api'],
                supportedOutputFormats: ['text', 'json']
            },
            constraints: {
                maxActions: 5,
                timeoutMs: 30000,
                qualityLevel: 'balanced'
            }
        };

        // 2. 플랜 생성
        const plan = await defaultPlanner.createPlan(planContext);
        
        console.log('📋 생성된 플랜:', {
            planId: plan.id,
            totalSteps: plan.totalSteps,
            actionTypes: plan.actions.map(a => a.type)
        });

        // 3. 플랜 실행
        const results = [];
        let clarifyRequired = false;

        for (const action of plan.actions) {
            console.log(`🔧 액션 실행: ${action.type} - ${action.name}`);
            
            const result = await defaultExecutor.executeAction(action, planContext, results);
            results.push(result);

            // Clarify가 필요한 경우 즉시 반환
            if (result.success && result.data?.type === 'clarify_required') {
                clarifyRequired = true;
                
                // Clarify 모드 설정
                clarifyResponseHandler.setClarifyMode(
                    c.session,
                    result.data.field,
                    result.data.message
                );
                
                return c.json({
                    success: true,
                    reply: result.data.message,
                    clarify: true,
                    field: result.data.field,
                    suggestions: result.data.suggestions,
                    hint: result.data.hint,
                    expectedResponseType: result.data.expectedResponseType,
                    planId: plan.id,
                    executedActions: results.length
                });
            }

            // 실패한 액션은 로그만 남기고 계속 진행
            if (!result.success) {
                console.warn(`⚠️ 액션 실패: ${action.type} - ${result.error}`);
            }
        }

        // 4. 최종 결과 반환
        const finalResult = results[results.length - 1];
        const finalMessage = generateFinalMessage(results, planContext);

        return c.json({
            success: true,
            reply: finalMessage,
            planId: plan.id,
            executedActions: results.length,
            successfulActions: results.filter(r => r.success).length,
            results: results.map(r => ({
                actionId: r.actionId,
                success: r.success,
                executionTime: r.executionTime
            }))
        });

    } catch (error: any) {
        console.error('❌ 플래너 기반 챗봇 처리 오류:', error);
        return c.json({
            success: false,
            error: error.message || '플래너 처리 중 오류가 발생했습니다.'
        }, 500);
    }
});

// 슬롯 상태 조회 엔드포인트 (디버깅용)
aiChatRoute.get('/slots', authMiddleware, getSlotStatus);

// 세션 삭제 엔드포인트 (디버깅용)  
aiChatRoute.delete('/sessions/:sessionId', authMiddleware, deleteSession);

// TEST-ONLY: 인증 없이 플래너 시스템을 테스트할 수 있는 엔드포인트 (개발용)
aiChatRoute.post('/test-chat', slotMiddleware, async (c) => {
    try {
        const { message, context } = await c.req.json();
        
        console.log('🧪 플래너 테스트 요청:', { message: message?.slice(0, 100) + '...' });

        // 1. 플랜 컨텍스트 생성
        const planContext: PlanContext = {
            intent: null, // 플래너가 분석함
            slots: c.slots,
            userProfile: context?.userProfile || c.session?.userProfile || {
                purpose: ['매매', '투자'],
                workLocation: '강남역',
                commutingRadius: 30
            },
            sessionHistory: {
                messages: context?.messages || c.session?.messageHistory || [],
                lastQuestionTypes: [],
                context: {},
                timestamp: new Date()
            }
        };

        // 2. 플랜 생성
        const plan = await defaultPlanner.createPlan(planContext);
        
        console.log('📋 생성된 테스트 플랜:', {
            planId: plan.id,
            actionCount: plan.actions.length,
            constraints: plan.constraints
        });

        // 3. 시스템 능력 정의
        const capabilities: SystemCapabilities = {
            availableFunctions: ['searchRealEstate', 'searchPOI', 'getBuildingInfo'],
            maxExecutionTime: 30000,
            allowedDataSources: ['database', 'external_api'],
            supportedOutputFormats: ['text', 'json']
        };

        // 4. 플랜 실행
        const execution = await defaultExecutor.executeWithCritic(plan, planContext);
        
        console.log('✅ 플랜 실행 완료:', {
            status: execution.status,
            resultCount: execution.results.length,
            criticResult: execution.criticResult?.hasIssue || false
        });

        // 5. 응답 생성
        let reply = "플래너 시스템이 작업을 완료했습니다.\\n\\n";
        
        // 실행 결과를 기반으로 응답 생성
        for (const result of execution.results) {
            if (result.success && result.data) {
                if (result.data.type === 'clarify_required') {
                    reply += `❓ ${result.data.message}\\n`;
                } else if (result.data.deals) {
                    reply += `🏠 실거래 ${result.data.totalCount || result.data.deals.length}건을 찾았습니다.\\n`;
                } else if (result.data.pois) {
                    reply += `📍 주변 편의시설 ${result.data.totalCount || result.data.pois.length}개를 찾았습니다.\\n`;
                } else {
                    reply += `✅ 작업이 완료되었습니다.\\n`;
                }
            } else {
                reply += `⚠️ 작업 중 오류가 발생했습니다: ${result.error}\\n`;
            }
        }

        if (execution.criticResult?.hasIssue) {
            reply += `\\n🔍 Critic 검증: ${execution.criticResult.explanation}`;
        }

        return c.json({
            success: true,
            reply,
            plannerUsed: true,
            executionId: execution.planId,
            actionCount: execution.results.length
        });
    } catch (error: any) {
        console.error('❌ 플래너 테스트 오류:', error);
        return c.json({
            success: false,
            error: error.message,
            plannerUsed: true
        }, 500);
    }
});

export default aiChatRoute;
