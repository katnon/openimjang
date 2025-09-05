// apps/bff/src/routes/ai.ts
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { db } from '../lib/db';
import { sql } from 'kysely';

const aiRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// AI 요약 조회 (PostgreSQL에서 공유 요약 가져오기)
aiRoute.get('/summary/:aptId', async (c) => {
    try {
        const aptId = parseInt(c.req.param('aptId'));
        
        if (!aptId) {
            return c.json({ success: false, error: '유효한 아파트 ID가 필요합니다.' }, 400);
        }

        // PostgreSQL에서 저장된 요약 조회
        const summary = await db
            .selectFrom('oi.ai_smart_summary')
            .selectAll()
            .where('apt_id', '=', aptId)
            .executeTakeFirst();

        if (summary) {
            return c.json({
                success: true,
                summary: summary.summary,
                createdAt: summary.created_at,
                updatedAt: summary.updated_at
            });
        }

        return c.json({
            success: false,
            message: '저장된 요약이 없습니다.'
        });

    } catch (error: any) {
        console.error('❌ 요약 조회 오류:', error);
        return c.json({
            success: false,
            error: error.message || '요약 조회 중 오류가 발생했습니다.'
        }, 500);
    }
});

// AI 요약 저장 (PostgreSQL에 공유 요약 저장)
aiRoute.post('/summary/save', authMiddleware, async (c) => {
    try {
        const { aptId, aptName, jibunAddress, summary, userId } = await c.req.json();
        
        if (!aptId || !aptName || !jibunAddress || !summary || !userId) {
            return c.json({ 
                success: false, 
                error: '필수 정보가 누락되었습니다.' 
            }, 400);
        }

        // 기존 요약이 있는지 확인
        const existing = await db
            .selectFrom('oi.ai_smart_summary')
            .select(['apt_id'])
            .where('apt_id', '=', aptId)
            .executeTakeFirst();

        if (existing) {
            // 기존 요약 업데이트
            await db
                .updateTable('oi.ai_smart_summary')
                .set({
                    summary: summary,
                    user_id: userId,
                    updated_at: new Date()
                })
                .where('apt_id', '=', aptId)
                .execute();
        } else {
            // 새 요약 생성
            await db
                .insertInto('oi.ai_smart_summary')
                .values({
                    apt_id: aptId,
                    apt_nm: aptName,
                    jibun_address: jibunAddress,
                    summary: summary,
                    user_id: userId,
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .execute();
        }

        return c.json({
            success: true,
            message: '요약이 성공적으로 저장되었습니다.'
        });

    } catch (error: any) {
        console.error('❌ 요약 저장 오류:', error);
        return c.json({
            success: false,
            error: error.message || '요약 저장 중 오류가 발생했습니다.'
        }, 500);
    }
});

// AI 분석 리포트 생성
aiRoute.post('/analyze', authMiddleware, async (c) => {
    try {
        const requestData = await c.req.json();
        const { type } = requestData;

        // 기존 분석 타입 (임장 메모 분석)
        if (!type || type === 'memo_analysis') {
            const { aptId } = requestData;
            
            if (!aptId) {
                return c.json({ success: false, error: '아파트 ID가 필요합니다.' }, 400);
            }

            // 여기서는 Firebase 데이터를 직접 가져올 수 없으므로, 
            // 프론트엔드에서 필요한 데이터를 함께 전송받도록 구성
            const { memos, aptData } = requestData;

        // PostgreSQL에서 실거래 데이터 조회 (최근 1년)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const dateFilter = oneYearAgo.getFullYear() * 10000 + (oneYearAgo.getMonth() + 1) * 100 + oneYearAgo.getDate();
        
        const tradeData = await db
            .selectFrom('oi.trade_raw')
            .selectAll()
            .where('apt_cd', '=', aptId.toString())
            .where('deal_ymd', '>=', dateFilter)
            .orderBy('deal_ymd', 'desc')
            .limit(20)
            .execute();

        const prompt = `
당신은 부동산 임장 전문가입니다. 다음 정보를 바탕으로 종합적인 임장 분석 리포트를 작성해주세요.

## 사용자 임장 메모
${memos.map((memo: any, index: number) => `
${index + 1}. ${memo.title} (${memo.updatedAt})
내용: ${memo.body || '내용 없음'}
`).join('\n')}

## 아파트 정보
- 이름: ${aptData.aptName}
- 주소: ${aptData.address}
- 위치: 위도 ${aptData.lat}, 경도 ${aptData.lon}

## 실거래 데이터 (최근 거래)
${tradeData.map((trade: any, index: number) => `
${index + 1}. ${trade.deal_ymd} - ${trade.exclu_use_ar}㎡, ${trade.deal_amount}만원
   층: ${trade.floor}층, 건축년도: ${trade.build_year}년
`).join('\n')}

## 분석 요청
다음 관점에서 분석해주세요:
1. **시장 분석**: 최근 실거래 동향 및 가격 트렌드
2. **투자 가치**: 현재 시세 대비 투자 매력도
3. **임장 메모 분석**: 사용자의 현장 관찰 내용 검토
4. **종합 의견**: 투자/거주 관점에서의 최종 평가

각 섹션을 명확히 구분하고, 구체적인 수치와 근거를 제시해주세요.
마크다운 형식으로 작성해주세요.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                {
                    role: "system",
                    content: "당신은 부동산 전문가입니다. 임장 데이터를 분석하여 정확하고 실용적인 조언을 제공합니다."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_completion_tokens: 2000,
        });

        const analysis = completion.choices[0]?.message?.content || "분석을 생성할 수 없습니다.";

            return c.json({
                success: true,
                analysis,
                timestamp: new Date().toISOString()
            });
        }

        // 새로운 아파트 종합 분석 타입
        if (type === 'apartment_summary') {
            const { data, prompt } = requestData;

            if (!data || !data.aptInfo) {
                return c.json({ success: false, error: '아파트 정보가 필요합니다.' }, 400);
            }

            const completion = await openai.chat.completions.create({
                model: "gpt-5-mini",
                messages: [
                    {
                        role: "system",
                        content: "당신은 부동산 전문가입니다. 실거래가, 건물정보, 주변환경 데이터를 종합하여 정확하고 실용적인 분석을 제공합니다."
                    },
                    {
                        role: "user",
                        content: `${prompt}

**데이터:**
${JSON.stringify(data, null, 2)}`
                    }
                ],
                max_completion_tokens: 2000,
                });

            const response = completion.choices[0]?.message?.content || "분석을 생성할 수 없습니다.";

            return c.json({
                success: true,
                response,
                timestamp: new Date().toISOString()
            });
        }

        return c.json({ success: false, error: '알 수 없는 분석 타입입니다.' }, 400);

    } catch (error: any) {
        console.error('❌ AI 분석 오류:', error);
        return c.json({
            success: false,
            error: error.message || '분석 중 오류가 발생했습니다.'
        }, 500);
    }
});

// AI 채팅봇
aiRoute.post('/chat', authMiddleware, async (c) => {
    try {
        const { message, memos, aptData, aptId, chatHistory = [], userProfile } = await c.req.json();
        
        console.log('🔍 챗봇 요청 데이터:', { 
            message, 
            hasUserProfile: !!userProfile, 
            userProfile: userProfile ? Object.keys(userProfile) : null 
        });
        
        // PostgreSQL에서 실거래 데이터 조회 (aptId가 있는 경우, 최근 1년)
        let tradeData: any[] = [];
        if (aptId) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const yearFilter = oneYearAgo.getFullYear();
            
            // 매매 데이터 조회
            const tradeResults = await (db
                .selectFrom('oi.apt_deal_trade_raw' as any)
                .select([
                    'dealyear', 'dealmonth', 'dealday', 
                    'dealamount', 'excluusear', 'floor'
                ]) as any)
                .where('aptnm', '=', aptData?.aptName || '')
                .where('dealyear', '>=', yearFilter)
                .orderBy('dealyear', 'desc')
                .orderBy('dealmonth', 'desc')
                .limit(5)
                .execute();

            // 전월세 데이터 조회  
            const rentResults = await (db
                .selectFrom('oi.apt_deal_rent_raw' as any)
                .select([
                    'dealyear', 'dealmonth', 'dealday',
                    'deposit', 'monthlyrent', 'excluusear', 'floor'
                ]) as any)
                .where('aptnm', '=', aptData?.aptName || '')
                .where('dealyear', '>=', yearFilter)
                .orderBy('dealyear', 'desc')
                .orderBy('dealmonth', 'desc')
                .limit(5)
                .execute();

            tradeData = [...tradeResults, ...rentResults];
        }

        // 사용자 프로필 정보 포맷팅
        const formatUserProfile = (profile: any) => {
            if (!profile) return '사용자 프로필 정보 없음';
            
            const formatBudget = (amount: number) => {
                if (amount >= 100000000) return `${Math.floor(amount / 100000000)}억${amount % 100000000 ? Math.floor((amount % 100000000) / 10000000) + '천만' : ''}원`;
                if (amount >= 10000000) return `${Math.floor(amount / 10000000)}천만원`;
                if (amount >= 10000) return `${Math.floor(amount / 10000)}만원`;
                return `${amount}원`;
            };

            return `
- 목적: ${profile.purpose?.join(', ') || '정보 없음'}
- 직장/희망지역: ${profile.workLocation || '정보 없음'}
- 통근 반경: ${profile.commutingRadius || '정보 없음'}분
- 예산 범위: ${profile.budgetRange ? `${formatBudget(profile.budgetRange[0])} ~ ${formatBudget(profile.budgetRange[1])}` : '정보 없음'}
- 월세 범위: ${profile.monthlyRent ? `${formatBudget(profile.monthlyRent[0])} ~ ${formatBudget(profile.monthlyRent[1])}` : '정보 없음'}
- 선호 건물연식: ${profile.preferredBuildingAge || '정보 없음'}
- 가족구성: ${profile.familyType || '정보 없음'}
- 우선순위: ${profile.priorities?.join(', ') || '정보 없음'}`;
        };

        // 컨텍스트 정보 구성
        const contextInfo = `
## 사용자 프로필 정보
${formatUserProfile(userProfile)}

## 현재 아파트 정보
- 이름: ${aptData?.aptName || '정보 없음'}
- 주소: ${aptData?.address || '정보 없음'}

## 사용자의 임장 메모
${memos && memos.length > 0 ? memos.map((memo: any, index: number) => `
${index + 1}. ${memo.title}: ${memo.body || '내용 없음'}
`).join('\n') : '임장 메모 없음'}

## 최근 실거래 정보 (원본 데이터)
${tradeData && tradeData.length > 0 ? tradeData.slice(0, 5).map((trade: any, index: number) => `
${index + 1}. ${trade.dealyear}.${trade.dealmonth}.${trade.dealday}
   - 면적: ${trade.excluusear}㎡ 
   - 층수: ${trade.floor}층
   ${trade.dealamount ? `- 매매가: ${trade.dealamount}(만원 단위)` : ''}
   ${trade.deposit ? `- 보증금: ${trade.deposit}(만원 단위)` : ''}
   ${trade.monthlyrent ? `- 월세: ${trade.monthlyrent}(만원 단위)` : ''}
`).join('\n') : '실거래 정보 없음'}
`;

        // Function Calling용 도구 정의
        const tools = [
            {
                type: "function",
                function: {
                    name: "searchRealEstateDeals",
                    description: "특정 아파트의 실거래 데이터를 검색합니다. 거래 유형(매매/전세/월세)과 면적별로 필터링 가능합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            aptId: {
                                type: "number",
                                description: "아파트 ID (현재 컨텍스트의 아파트를 사용하려면 생략 가능)"
                            },
                            dealType: {
                                type: "string",
                                enum: ["매매", "전세", "월세", "전월세"],
                                description: "거래 유형 필터"
                            },
                            area: {
                                type: "number", 
                                description: "전용면적 필터 (평방미터)"
                            }
                        }
                    }
                }
            },
            {
                type: "function", 
                function: {
                    name: "getBuildingInfo",
                    description: "아파트의 건물 정보(표제부등본, 총괄표제부)를 조회합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            aptId: {
                                type: "number",
                                description: "아파트 ID"
                            }
                        },
                        required: ["aptId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "searchNearbyPOI",
                    description: "특정 위치 주변의 POI(관심지점)를 검색합니다. 학교, 병원, 마트, 지하철역 등을 찾을 수 있습니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            lat: {
                                type: "number",
                                description: "위도 (현재 아파트 위치를 사용하려면 생략 가능)"
                            },
                            lng: {
                                type: "number", 
                                description: "경도 (현재 아파트 위치를 사용하려면 생략 가능)"
                            },
                            poiType: {
                                type: "string",
                                enum: ["학교", "병원", "마트", "지하철", "버스정류장", "공원", "편의점", "은행", "전체"],
                                description: "검색할 POI 유형"
                            },
                            radius: {
                                type: "number",
                                description: "검색 반경 (미터, 기본값: 1000)"
                            }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "findSimilarApartments",
                    description: "특정 아파트와 유사한 조건의 다른 아파트를 추천합니다. 면적, 가격대, 위치, 건축년도 등을 고려합니다.",
                    parameters: {
                        type: "object",
                        properties: {
                            aptId: {
                                type: "number",
                                description: "기준이 되는 아파트 ID (현재 아파트를 사용하려면 생략 가능)"
                            },
                            priceRange: {
                                type: "number",
                                description: "가격 범위 허용 오차 (%, 기본값: 20)"
                            },
                            areaRange: {
                                type: "number", 
                                description: "면적 범위 허용 오차 (%, 기본값: 15)"
                            },
                            distanceKm: {
                                type: "number",
                                description: "검색할 거리 반경 (km, 기본값: 5)"
                            },
                            maxResults: {
                                type: "number",
                                description: "최대 결과 개수 (기본값: 5)"
                            }
                        }
                    }
                }
            }
        ];

        // 대화 히스토리 구성
        const messages = [
            {
                role: "system",
                content: `당신은 부동산 임장 전문 AI 어시스턴트입니다. 
아래 정보를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요.

## 데이터베이스 스키마 정보
**실거래가 데이터 (apt_deal_rent_raw, apt_deal_trade_raw)**
- dealamount: 매매가 (만원 단위, 예: 50000 = 5억원)
- deposit: 보증금 (만원 단위, 예: 30000 = 3억원)  
- monthlyrent: 월세 (만원 단위, 예: 200 = 200만원)
- excluusear: 전용면적 (㎡)
- floor: 층수
- dealyear, dealmonth, dealday: 거래일자

**중요:** 모든 금액은 만원 단위로 저장되어 있습니다. 
- 30000 = 3억원 (30000만원)
- 5000 = 5천만원 
- 200 = 200만원

특히 사용자의 프로필 정보(목적, 예산, 가족구성, 우선순위 등)를 고려하여 개인화된 조언을 해주세요.

필요한 경우 다음 기능들을 활용하세요:
- 실거래 데이터가 필요하면 searchRealEstateDeals 함수를 사용
- 건물 정보가 필요하면 getBuildingInfo 함수를 사용
- 주변 POI 정보가 필요하면 searchNearbyPOI 함수를 사용
- 유사한 아파트 추천이 필요하면 findSimilarApartments 함수를 사용

답변은 친근하고 이해하기 쉽게, 구체적인 근거와 함께 제공해주세요.

${contextInfo}`
            },
            ...chatHistory.map((chat: any) => ({
                role: chat.role,
                content: chat.content
            })),
            {
                role: "user",
                content: message
            }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages,
            tools,
            tool_choice: "auto",
            max_completion_tokens: 1000,
        });

        const response = completion.choices[0]?.message;
        
        // Function Calling이 있는지 확인
        if (response?.tool_calls && response.tool_calls.length > 0) {
            // Function 실행 결과를 저장할 배열
            const functionResults: any[] = [];
            
            for (const toolCall of response.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`🔧 Function 호출: ${functionName}`, functionArgs);
                
                let functionResult: any = null;
                
                try {
                    if (functionName === 'searchRealEstateDeals') {
                        functionResult = await handleSearchRealEstateDeals(functionArgs, aptId);
                    } else if (functionName === 'getBuildingInfo') {
                        functionResult = await handleGetBuildingInfo(functionArgs);
                    } else if (functionName === 'searchNearbyPOI') {
                        functionResult = await handleSearchNearbyPOI(functionArgs, aptData);
                    } else if (functionName === 'findSimilarApartments') {
                        functionResult = await handleFindSimilarApartments(functionArgs, aptData);
                    }
                } catch (error) {
                    console.error(`❌ Function 실행 오류 (${functionName}):`, error);
                    functionResult = { error: `${functionName} 실행 중 오류가 발생했습니다.` };
                }
                
                functionResults.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(functionResult)
                });
            }
            
            // Function 결과를 포함하여 다시 AI에게 요청
            const followUpMessages = [
                ...messages,
                response,
                ...functionResults
            ];
            
            const finalCompletion = await openai.chat.completions.create({
                model: "gpt-5-mini", 
                messages: followUpMessages,
                max_completion_tokens: 1000,
                });
            
            const reply = finalCompletion.choices[0]?.message?.content || "죄송합니다. 답변을 생성할 수 없습니다.";
            
            return c.json({
                success: true,
                reply,
                timestamp: new Date().toISOString()
            });
        }
        
        // 일반 답변
        const reply = response?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

        return c.json({
            success: true,
            reply,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ AI 채팅 오류:', error);
        return c.json({
            success: false,
            error: error.message || '채팅 중 오류가 발생했습니다.'
        }, 500);
    }
});

// 아파트 데이터가 포함된 챗봇 API
aiRoute.post("/chat-with-data", async (c) => {
    try {
        const idToken = c.req.header("Authorization")?.replace("Bearer ", "");
        if (!idToken) {
            return c.json({ success: false, error: "인증이 필요합니다." }, 401);
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        console.log("✅ 토큰 검증 성공:", userId);

        const requestData = await c.req.json();
        const { message, apartmentId, memoData, chatHistory = [], userProfile = {} } = requestData;

        console.log(`🔍 데이터 포함 챗봇 요청:`, {
            message,
            apartmentId,
            hasMemo: !!memoData,
            historyLength: chatHistory.length,
            hasUserProfile: !!userProfile
        });

        // 아파트 데이터 수집 (apartmentId가 있는 경우)
        let apartmentData = null;
        if (apartmentId) {
            apartmentData = await collectApartmentData(parseInt(apartmentId));
        }

        // 프롬프트 구성
        let systemPrompt = `당신은 부동산 임장 전문가 "임장봇"입니다.

## 기본 역할
- 부동산 임장(현장답사) 전문가로서 투자/거주 관점에서 조언 제공
- 실거래 데이터, 건물 정보, 주변 환경을 종합적으로 분석
- 사용자의 온보딩 프로필 정보를 바탕으로 맞춤형 조언 제공
- 친근하고 전문적인 톤으로 대화

## 데이터베이스 스키마 정보
- deal_amount: 거래금액 (만원 단위, 30000 = 3억원)
- exclu_use_ar: 전용면적 (㎡)
- deal_ymd: 거래년월일 (YYYYMMDD)
- build_year: 건축년도`;

        // 사용자 프로필 정보 추가
        if (userProfile && Object.keys(userProfile).length > 0) {
            systemPrompt += `\n\n## 사용자 프로필 정보\n`;
            if (userProfile.purpose) systemPrompt += `- 목적: ${userProfile.purpose}\n`;
            if (userProfile.budgetRange) systemPrompt += `- 예산: ${userProfile.budgetRange}\n`;
            if (userProfile.familyType) systemPrompt += `- 가족구성: ${userProfile.familyType}\n`;
            if (userProfile.workLocation) systemPrompt += `- 직장위치: ${userProfile.workLocation}\n`;
            if (userProfile.priorities) systemPrompt += `- 우선순위: ${userProfile.priorities?.join(', ')}\n`;
        }

        // 아파트 데이터 추가
        if (apartmentData?.basic) {
            systemPrompt += `\n\n## 현재 분석 대상 아파트 정보
- 이름: ${apartmentData.basic.aptnm}
- 주소: ${apartmentData.basic.roadnmaddr || apartmentData.basic.jibunaddr}
- 위치: 위도 ${apartmentData.basic.lat}, 경도 ${apartmentData.basic.lon}`;

            // 실거래 데이터 추가
            if (apartmentData.recentDeals && apartmentData.recentDeals.length > 0) {
                systemPrompt += `\n\n## 최근 실거래 데이터 (${apartmentData.recentDeals.length}건)`;
                apartmentData.recentDeals.slice(0, 10).forEach((deal: any, index: number) => {
                    systemPrompt += `\n${index + 1}. ${deal.deal_ymd} - ${deal.exclu_use_ar}㎡, ${deal.deal_amount}만원, ${deal.floor}층 (건축년도: ${deal.build_year})`;
                });
            }

            // 건물 정보 추가
            if (apartmentData.building?.recap) {
                const recap = apartmentData.building.recap;
                systemPrompt += `\n\n## 건물 정보 (총괄표제부)
- 대지면적: ${recap.platarea}㎡
- 건축면적: ${recap.archarea}㎡  
- 연면적: ${recap.totarea}㎡
- 지상층수: ${recap.grndflrcnt}층
- 지하층수: ${recap.ugrndflrcnt}층
- 세대수: ${recap.hhldcnt}세대
- 주차대수: ${recap.totpkngcnt}대
- 사용승인일: ${recap.useaprday}`;
            }
        }

        // 임장 메모 데이터 추가
        if (memoData) {
            systemPrompt += `\n\n## 사용자 임장 메모
- 작성일: ${memoData.createdAt}
- 메모 내용: ${memoData.content}`;
            
            if (memoData.photos && memoData.photos.length > 0) {
                systemPrompt += `\n- 첨부사진: ${memoData.photos.length}장`;
            }
        }

        systemPrompt += `\n\n답변 시 위 정보들을 종합하여 전문적이면서도 이해하기 쉽게 조언해주세요.`;

        // 대화 메시지 구성
        const messages = [
            { role: "system", content: systemPrompt },
            ...chatHistory.map((chat: any) => ({
                role: chat.role,
                content: chat.content
            })),
            { role: "user", content: message }
        ];

        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "searchRealEstateDeals",
                        description: "특정 아파트의 실거래 데이터를 검색합니다.",
                        parameters: {
                            type: "object",
                            properties: {
                                aptId: { type: "number", description: "아파트 ID" },
                                dealType: { 
                                    type: "string", 
                                    enum: ["매매", "전세", "월세"], 
                                    description: "거래 유형" 
                                }
                            }
                        }
                    }
                },
                {
                    type: "function", 
                    function: {
                        name: "findSimilarApartments",
                        description: "현재 아파트와 유사한 조건의 다른 아파트를 추천합니다.",
                        parameters: {
                            type: "object",
                            properties: {
                                priceRange: { type: "number", description: "가격 범위 허용 오차 (%)" },
                                distanceKm: { type: "number", description: "검색할 거리 반경 (km)" }
                            }
                        }
                    }
                }
            ],
            tool_choice: "auto",
            max_completion_tokens: 1000,
        });

        const response = completion.choices[0]?.message;

        // Function Calling이 있는지 확인
        if (response?.tool_calls && response.tool_calls.length > 0) {
            const functionResults: any[] = [];
            
            for (const toolCall of response.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                let functionResult;
                try {
                    if (functionName === 'searchRealEstateDeals') {
                        functionResult = await handleSearchRealEstateDeals(functionArgs, parseInt(apartmentId));
                    } else if (functionName === 'findSimilarApartments') {
                        functionResult = await handleFindSimilarApartments(functionArgs, apartmentData?.basic);
                    }
                } catch (error) {
                    console.error(`❌ Function 실행 오류 (${functionName}):`, error);
                    functionResult = { error: `${functionName} 실행 중 오류가 발생했습니다.` };
                }
                
                functionResults.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(functionResult)
                });
            }
            
            // Function 결과를 포함하여 다시 AI에게 요청
            const followUpMessages = [
                ...messages,
                response,
                ...functionResults
            ];
            
            const finalCompletion = await openai.chat.completions.create({
                model: "gpt-5-mini", 
                messages: followUpMessages,
                max_completion_tokens: 1000,
            });
            
            const reply = finalCompletion.choices[0]?.message?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

            return c.json({
                success: true,
                reply,
                apartmentData: apartmentData?.basic || null,
                timestamp: new Date().toISOString()
            });
        }

        // 일반 답변
        const reply = response?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

        return c.json({
            success: true,
            reply,
            apartmentData: apartmentData?.basic || null,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ 데이터 포함 AI 채팅 오류:', error);
        return c.json({
            success: false,
            error: error.message || '챗봇 응답을 생성할 수 없습니다.'
        }, 500);
    }
});

// Function Calling 핸들러들
async function handleSearchRealEstateDeals(args: any, contextAptId?: number) {
    const { aptId: requestedAptId, dealType, area } = args;
    const targetAptId = requestedAptId || contextAptId;
    
    if (!targetAptId) {
        return { error: "아파트 ID가 필요합니다." };
    }

    try {
        console.log(`🔍 실거래가 검색: aptId=${targetAptId}, dealType=${dealType || '전체'}, area=${area || '전체'}`);
        
        // 기존 search.ts 로직 활용
        const aptInfo = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["apt_nm", "jibun_address"]) as any)
            .where("id", "=", targetAptId)
            .executeTakeFirst();

        if (!aptInfo) {
            return { error: "아파트를 찾을 수 없습니다." };
        }

        let results: any[] = [];

        // 매매 데이터 조회 (apt_deal_trade_raw, 최근 1년)
        if (!dealType || dealType === "매매") {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const yearFilter = oneYearAgo.getFullYear();
            
            let tradeQuery = (db
                .selectFrom("oi.apt_deal_trade_raw" as any)
                .select([
                    "dealyear as deal_year", "dealmonth as deal_month", "dealday as deal_day",
                    "dealamount as deal_amount", 
                    "excluusear as exclu_use_ar", "floor"
                ]) as any)
                .where("aptnm", "=", aptInfo.apt_nm)
                .where("dealyear", ">=", yearFilter);

            if (area) {
                tradeQuery = tradeQuery.where("excluusear", "=", area);
            }

            const tradeResults = await tradeQuery
                .orderBy("dealyear", "desc")
                .orderBy("dealmonth", "desc") 
                .orderBy("dealday", "desc")
                .limit(20)
                .execute();

            // 매매 데이터에 타입 표시 추가
            const formattedTradeResults = tradeResults.map((trade: any) => ({
                ...trade,
                deal_type: "매매",
                deposit: null,
                monthly_rent: null
            }));

            results.push(...formattedTradeResults);
        }

        // 전월세 데이터 조회 (apt_deal_rent_raw, 최근 1년)
        if (!dealType || ["전세", "월세", "전월세"].includes(dealType)) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const yearFilter = oneYearAgo.getFullYear();
            
            let rentQuery = (db
                .selectFrom("oi.apt_deal_rent_raw" as any)
                .select([
                    "dealyear as deal_year", "dealmonth as deal_month", "dealday as deal_day",
                    "deposit", "monthlyrent as monthly_rent",
                    "excluusear as exclu_use_ar", "floor"
                ]) as any)
                .where("aptnm", "=", aptInfo.apt_nm)
                .where("dealyear", ">=", yearFilter);

            // 거래 유형별 필터링
            if (dealType === "전세") {
                rentQuery = rentQuery.where((eb: any) => eb.or([
                    eb("monthlyrent", "=", 0),
                    eb("monthlyrent", "is", null)
                ]));
            } else if (dealType === "월세") {
                rentQuery = rentQuery.where("monthlyrent", ">", 0);
            }

            if (area) {
                rentQuery = rentQuery.where("excluusear", "=", area);
            }

            const rentResults = await rentQuery
                .orderBy("dealyear", "desc")
                .orderBy("dealmonth", "desc")
                .orderBy("dealday", "desc") 
                .limit(20)
                .execute();

            // 전월세 데이터에 타입 표시 추가
            const formattedRentResults = rentResults.map((rent: any) => ({
                ...rent,
                deal_type: rent.monthly_rent > 0 ? "월세" : "전세",
                deal_amount: null
            }));

            results.push(...formattedRentResults);
        }

        // 최신순으로 정렬
        results.sort((a, b) => {
            if (a.deal_year !== b.deal_year) return b.deal_year - a.deal_year;
            if (a.deal_month !== b.deal_month) return b.deal_month - a.deal_month;
            return b.deal_day - a.deal_day;
        });

        // 최대 20건으로 제한
        results = results.slice(0, 20);

        return {
            aptName: aptInfo.apt_nm,
            jibunAddress: aptInfo.jibun_address,
            dealType: dealType || "전체",
            area: area || "전체",
            count: results.length,
            dataSchema: {
                dealamount: "매매가 (만원 단위)",
                deposit: "보증금 (만원 단위)", 
                monthly_rent: "월세 (만원 단위)",
                exclu_use_ar: "전용면적 (㎡)",
                floor: "층수",
                note: "모든 금액은 만원 단위입니다. 예: 30000 = 3억원"
            },
            deals: results
        };

    } catch (error) {
        console.error("❌ 실거래가 검색 오류:", error);
        return { error: "실거래가 검색 중 오류가 발생했습니다." };
    }
}

async function handleGetBuildingInfo(args: any) {
    const { aptId } = args;
    
    if (!aptId) {
        return { error: "아파트 ID가 필요합니다." };
    }

    try {
        console.log(`🏗️ 건물 정보 검색: aptId=${aptId}`);
        
        const buildingInfos = await (db
            .selectFrom("oi.apt_building_info" as any)
            .select([
                "id", "type", "dongnm", "bldnm", "platplc", "platarea", "archarea",
                "totarea", "grndflrcnt", "ugrndflrcnt", "mainpurpscdnm", "strctcdnm",
                "roofcdnm", "hhldcnt", "mainbldcnt", "atchbldcnt", "totpkngcnt",
                "useaprday", "created_at"
            ]) as any)
            .where("apt_id", "=", aptId)
            .orderBy("type", "desc")
            .orderBy("dongnm", "asc")
            .execute();

        if (!buildingInfos || buildingInfos.length === 0) {
            return { error: "건물 정보를 찾을 수 없습니다." };
        }

        const recapInfo = buildingInfos.find((info: any) => info.type === 'recap') || null;
        const titleInfos = buildingInfos.filter((info: any) => info.type === 'title');

        return {
            recapInfo,
            titleInfos,
            totalCount: buildingInfos.length
        };

    } catch (error) {
        console.error("❌ 건물 정보 검색 오류:", error);
        return { error: "건물 정보 검색 중 오류가 발생했습니다." };
    }
}

async function handleSearchNearbyPOI(args: any, contextAptData?: any) {
    const { lat: requestedLat, lng: requestedLng, poiType, radius = 1000 } = args;
    
    // 위치 정보 결정 (요청된 좌표 또는 컨텍스트의 아파트 위치)
    const targetLat = requestedLat || contextAptData?.lat;
    const targetLng = requestedLng || contextAptData?.lon;
    
    if (!targetLat || !targetLng) {
        return { error: "위치 정보(위도/경도)가 필요합니다." };
    }

    try {
        console.log(`🗺️ POI 검색: lat=${targetLat}, lng=${targetLng}, type=${poiType || '전체'}, radius=${radius}m`);
        
        // POI 타입에 따른 카테고리 매핑 (카카오맵 API 카테고리 코드 기준)
        const categoryMap: { [key: string]: string[] } = {
            "학교": ["SC4", "AC5"], // 학교, 학원
            "병원": ["HP8"], // 병원
            "마트": ["MT1"], // 대형마트
            "지하철": ["SW8"], // 지하철역
            "버스정류장": ["BK9"], // 은행 (버스정류장은 별도 API 필요)
            "공원": ["PK6"], // 공원
            "편의점": ["CS2"], // 편의점
            "은행": ["BK9"] // 은행
        };

        // 검색할 카테고리 결정
        let categories: string[] = [];
        if (!poiType || poiType === "전체") {
            // 전체 검색시 주요 카테고리들
            categories = ["SC4", "HP8", "MT1", "SW8", "PK6", "CS2", "BK9"];
        } else if (categoryMap[poiType]) {
            categories = categoryMap[poiType];
        } else {
            return { error: `지원하지 않는 POI 유형입니다: ${poiType}` };
        }

        // 카카오 Local API를 사용하여 POI 검색
        const KAKAO_REST_KEY = process.env.VITE_KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
        
        if (!KAKAO_REST_KEY) {
            return { error: "카카오 REST API 키가 설정되지 않았습니다." };
        }

        const searchPromises = categories.map(async (category) => {
            try {
                const response = await fetch(
                    `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${category}&x=${targetLng}&y=${targetLat}&radius=${radius}&size=15`,
                    {
                        headers: {
                            'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
                        }
                    }
                );
                
                if (!response.ok) {
                    console.error(`카카오 API 오류 (${category}):`, response.status, response.statusText);
                    return { category, documents: [] };
                }
                
                const data = await response.json();
                return { category, documents: data.documents || [] };
            } catch (error) {
                console.error(`POI 검색 오류 (${category}):`, error);
                return { category, documents: [] };
            }
        });

        const results = await Promise.all(searchPromises);
        
        // 결과 정리 및 포맷팅
        let allPOIs: any[] = [];
        const categoryNames: { [key: string]: string } = {
            "SC4": "학교",
            "AC5": "학원", 
            "HP8": "병원",
            "MT1": "대형마트",
            "SW8": "지하철역",
            "BK9": "은행",
            "PK6": "공원",
            "CS2": "편의점"
        };

        results.forEach(({ category, documents }) => {
            documents.forEach((poi: any) => {
                allPOIs.push({
                    name: poi.place_name,
                    category: categoryNames[category] || category,
                    address: poi.address_name,
                    roadAddress: poi.road_address_name,
                    distance: parseInt(poi.distance || 0),
                    x: parseFloat(poi.x),
                    y: parseFloat(poi.y),
                    phone: poi.phone || null,
                    url: poi.place_url || null
                });
            });
        });

        // 거리순 정렬
        allPOIs.sort((a, b) => a.distance - b.distance);
        
        // 카테고리별 통계
        const categoryStats: { [key: string]: number } = {};
        allPOIs.forEach(poi => {
            categoryStats[poi.category] = (categoryStats[poi.category] || 0) + 1;
        });

        return {
            searchLocation: { lat: targetLat, lng: targetLng },
            searchRadius: radius,
            poiType: poiType || "전체",
            totalCount: allPOIs.length,
            categoryStats,
            pois: allPOIs.slice(0, 30) // 최대 30개 결과만 반환
        };

    } catch (error) {
        console.error("❌ POI 검색 오류:", error);
        return { error: "POI 검색 중 오류가 발생했습니다." };
    }
}

async function handleFindSimilarApartments(args: any, contextAptData?: any) {
    const {
        aptId: requestedAptId,
        priceRange = 20, // 가격 범위 허용 오차 (%)
        areaRange = 15,  // 면적 범위 허용 오차 (%)
        distanceKm = 5,  // 검색 반경 (km)
        maxResults = 5   // 최대 결과 개수
    } = args;

    // 기준 아파트 결정 (요청된 aptId 또는 컨텍스트의 아파트)
    const baseAptId = requestedAptId || contextAptData?.id;
    
    if (!baseAptId) {
        return { error: "기준이 되는 아파트 ID가 필요합니다." };
    }

    try {
        console.log(`🏠 유사 아파트 검색: baseAptId=${baseAptId}, 가격범위=${priceRange}%, 면적범위=${areaRange}%, 거리=${distanceKm}km`);

        // 1. 기준 아파트 정보 조회
        const baseApt = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["id", "aptnm", "roadnmaddr", "lat", "lon"])
            .where("id", "=", baseAptId)
            .executeTakeFirst() as any);

        if (!baseApt) {
            return { error: "기준 아파트 정보를 찾을 수 없습니다." };
        }

        // 2. 기준 아파트의 최근 실거래 데이터로 기준값 설정
        const baseDeals = await (db
            .selectFrom("oi.apt_deal_trade_raw" as any)
            .select(["deal_amount", "exclu_use_ar", "deal_ymd"])
            .where("apt_id", "=", baseAptId)
            .orderBy("deal_ymd", "desc")
            .limit(10)
            .execute() as any);

        if (!baseDeals || baseDeals.length === 0) {
            return { error: "기준 아파트의 실거래 데이터를 찾을 수 없습니다." };
        }

        // 기준값 계산 (최근 거래의 평균값 사용)
        const avgPrice = baseDeals.reduce((sum: number, deal: any) => sum + deal.deal_amount, 0) / baseDeals.length;
        const avgArea = baseDeals.reduce((sum: number, deal: any) => sum + deal.exclu_use_ar, 0) / baseDeals.length;

        const priceMin = avgPrice * (1 - priceRange / 100);
        const priceMax = avgPrice * (1 + priceRange / 100);
        const areaMin = avgArea * (1 - areaRange / 100);
        const areaMax = avgArea * (1 + areaRange / 100);

        console.log(`📊 기준값: 가격 ${Math.round(avgPrice)}만원 (${Math.round(priceMin)}-${Math.round(priceMax)}), 면적 ${Math.round(avgArea)}㎡ (${Math.round(areaMin)}-${Math.round(areaMax)})`);

        // 3. 거리 반경 내의 아파트 검색
        const candidateApts = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["id", "aptnm", "roadnmaddr", "lat", "lon"])
            .where(({ eb, or, and }) => and([
                eb.fn("ST_DWithin", [
                    eb.fn("ST_GeogFromText", [`POINT(${baseApt.lon} ${baseApt.lat})`]),
                    eb.fn("ST_GeogFromText", [eb.fn("CONCAT", ["POINT(", "lon", " ", "lat", ")"])]),
                    distanceKm * 1000 // 미터 단위로 변환
                ]),
                eb("id", "!=", baseAptId) // 자기 자신 제외
            ]))
            .limit(100) // 성능을 위해 제한
            .execute() as any);

        console.log(`🔍 반경 ${distanceKm}km 내 후보 아파트: ${candidateApts.length}개`);

        // 4. 각 후보 아파트의 최근 실거래 정보와 유사도 계산
        const similarityPromises = candidateApts.map(async (apt: any) => {
            const recentDeals = await (db
                .selectFrom("oi.apt_deal_trade_raw" as any)
                .select(["deal_amount", "exclu_use_ar", "deal_ymd"])
                .where("apt_id", "=", apt.id)
                .orderBy("deal_ymd", "desc")
                .limit(5)
                .execute() as any);

            if (!recentDeals || recentDeals.length === 0) {
                return null; // 실거래 데이터가 없는 아파트는 제외
            }

            const aptAvgPrice = recentDeals.reduce((sum: number, deal: any) => sum + deal.deal_amount, 0) / recentDeals.length;
            const aptAvgArea = recentDeals.reduce((sum: number, deal: any) => sum + deal.exclu_use_ar, 0) / recentDeals.length;

            // 가격과 면적이 범위 내에 있는지 확인
            const isPriceInRange = aptAvgPrice >= priceMin && aptAvgPrice <= priceMax;
            const isAreaInRange = aptAvgArea >= areaMin && aptAvgArea <= areaMax;

            if (!isPriceInRange && !isAreaInRange) {
                return null; // 조건에 맞지 않으면 제외
            }

            // 거리 계산 (간단한 유클리드 거리)
            const distance = Math.sqrt(
                Math.pow(apt.lat - baseApt.lat, 2) + Math.pow(apt.lon - baseApt.lon, 2)
            ) * 111000; // 대략적인 미터 변환

            // 유사도 점수 계산 (낮을수록 유사함)
            const priceScore = Math.abs(aptAvgPrice - avgPrice) / avgPrice;
            const areaScore = Math.abs(aptAvgArea - avgArea) / avgArea;
            const distanceScore = distance / (distanceKm * 1000);

            const totalScore = priceScore * 0.4 + areaScore * 0.3 + distanceScore * 0.3;

            return {
                aptInfo: apt,
                avgPrice: Math.round(aptAvgPrice),
                avgArea: Math.round(aptAvgArea),
                distance: Math.round(distance),
                recentDealsCount: recentDeals.length,
                latestDealDate: recentDeals[0]?.deal_ymd,
                similarityScore: totalScore,
                isPriceInRange,
                isAreaInRange
            };
        });

        const results = (await Promise.all(similarityPromises))
            .filter((result: any) => result !== null) // null 제외
            .sort((a: any, b: any) => a.similarityScore - b.similarityScore) // 유사도순 정렬
            .slice(0, maxResults); // 최대 결과 개수 제한

        console.log(`✅ 유사 아파트 ${results.length}개 발견`);

        return {
            baseApartment: {
                id: baseApt.id,
                name: baseApt.aptnm,
                address: baseApt.roadnmaddr,
                avgPrice: Math.round(avgPrice),
                avgArea: Math.round(avgArea)
            },
            searchCriteria: {
                priceRange: `${Math.round(priceMin)}-${Math.round(priceMax)}만원`,
                areaRange: `${Math.round(areaMin)}-${Math.round(areaMax)}㎡`,
                distanceKm,
                maxResults
            },
            similarApartments: results.map((result: any) => ({
                id: result.aptInfo.id,
                name: result.aptInfo.aptnm,
                address: result.aptInfo.roadnmaddr,
                location: { lat: result.aptInfo.lat, lng: result.aptInfo.lon },
                avgPrice: result.avgPrice,
                avgArea: result.avgArea,
                distance: result.distance,
                recentDealsCount: result.recentDealsCount,
                latestDealDate: result.latestDealDate,
                similarityScore: Math.round(result.similarityScore * 1000) / 1000 // 소수점 3자리까지
            })),
            totalCandidates: candidateApts.length,
            foundCount: results.length
        };

    } catch (error) {
        console.error("❌ 유사 아파트 검색 오류:", error);
        return { error: "유사 아파트 검색 중 오류가 발생했습니다." };
    }
}

// 종합 아파트 정보 수집 함수
async function collectApartmentData(aptId: number) {
    try {
        console.log(`📊 아파트 종합 정보 수집: aptId=${aptId}`);
        
        // 병렬로 모든 정보 수집
        const [
            aptInfo,
            deals,
            buildingInfo,
            pnu,
            landuse,
            nearby
        ] = await Promise.allSettled([
            // 기본 아파트 정보
            (db
                .selectFrom("oi.apt_info" as any)
                .select(["id", "aptnm", "roadnmaddr", "jibunaddr", "lat", "lon"])
                .where("id", "=", aptId)
                .executeTakeFirst() as any),
            
            // 최근 실거래 데이터 (최근 1년, 최대 20건)
            (() => {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const yearFilter = oneYearAgo.getFullYear();
                
                return db
                    .selectFrom("oi.apt_deal_trade_raw" as any)
                    .select(["dealyear", "dealmonth", "dealday", "dealamount", "excluusear", "floor", "buildyear"])
                    .where("apt_id", "=", aptId)
                    .where("dealyear", ">=", yearFilter)
                    .orderBy("dealyear", "desc")
                    .orderBy("dealmonth", "desc")
                    .orderBy("dealday", "desc")
                    .limit(20)
                    .execute() as any;
            })(),
            
            // 건물 정보
            (db
                .selectFrom("oi.apt_building_info" as any)
                .select([
                    "type", "dongnm", "bldnm", "platarea", "archarea", 
                    "totarea", "grndflrcnt", "ugrndflrcnt", "mainpurpscdnm",
                    "hhldcnt", "totpkngcnt", "useaprday"
                ])
                .where("apt_id", "=", aptId)
                .execute() as any),
            
            // PNU (부동산고유번호) - 간소화된 쿼리
            Promise.resolve({ pnu: null }), // 일단 간소화
            
            // 토지이용계획 - 간소화된 쿼리  
            Promise.resolve({ landuse_zones: [] }), // 일단 간소화
            
            // 주변 POI 정보 - 간소화
            Promise.resolve({ pois: [] }) // 일단 간소화
        ]);

        // 결과 정리
        const apartmentData: any = {};

        // 기본 정보
        if (aptInfo.status === 'fulfilled' && aptInfo.value) {
            apartmentData.basic = aptInfo.value;
        }

        // 실거래 데이터
        if (deals.status === 'fulfilled' && deals.value) {
            apartmentData.recentDeals = deals.value;
        }

        // 건물 정보
        if (buildingInfo.status === 'fulfilled' && buildingInfo.value) {
            const recap = buildingInfo.value.find((info: any) => info.type === 'recap');
            const titles = buildingInfo.value.filter((info: any) => info.type === 'title');
            apartmentData.building = {
                recap: recap || null,
                titles: titles || []
            };
        }

        console.log(`📊 아파트 종합 정보 수집 완료: 실거래 ${apartmentData.recentDeals?.length || 0}건, 건물정보 ${apartmentData.building?.titles?.length || 0}개동`);
        
        return apartmentData;
        
    } catch (error) {
        console.error("❌ 아파트 종합 정보 수집 오류:", error);
        return null;
    }
}

export { aiRoute };