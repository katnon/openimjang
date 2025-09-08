// apps/bff/src/routes/ai.ts
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { db } from '../lib/db';
import { sql } from 'kysely';
import admin from 'firebase-admin';

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
            model: "gpt-4o-mini",
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
                model: "gpt-4o-mini",
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
            model: "gpt-4o-mini",
            messages,
            tools,
            tool_choice: "auto",
            max_completion_tokens: 1000,
        });

        console.log('✅ OpenAI API 호출 완료');
        
        const response = completion.choices[0]?.message;
        
        console.log('🤖 OpenAI API 응답:', {
            response: response?.content?.substring(0, 100) + '...',
            tool_calls: response?.tool_calls?.length || 0,
            choices_length: completion.choices?.length || 0,
            full_response_exists: !!response?.content
        });
        
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
                model: "gpt-4o-mini", 
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

        // 아파트 기본 정보 및 사용자 메모 수집 (apartmentId가 있는 경우)
        let apartmentBasicInfo = null;
        let userApartmentMemos: any[] = [];
        
        if (apartmentId) {
            try {
                const aptInfo = await db
                    .selectFrom('oi.apt_info')
                    .select(['id', 'apt_nm as aptnm', 'jibun_address as jibunaddr', 'lat', 'lon'])
                    .where('id', '=', parseInt(apartmentId))
                    .executeTakeFirst();
                
                if (aptInfo) {
                    apartmentBasicInfo = aptInfo;
                    console.log('🏠 아파트 기본 정보 수집:', aptInfo.aptnm);
                    
                    // 해당 아파트에 대한 사용자 메모 조회
                    try {
                        const userMemosRef = admin.firestore()
                            .collection('users')
                            .doc(userId)
                            .collection('memos')
                            .where('aptId', '==', apartmentId);
                            
                        const memosSnapshot = await userMemosRef.get();
                        
                        if (!memosSnapshot.empty) {
                            userApartmentMemos = memosSnapshot.docs.map(doc => {
                                const data = doc.data();
                                return {
                                    id: doc.id,
                                    title: data.title || '',
                                    body: data.body || '',
                                    createdAt: data.createdAt?.toDate() || new Date(),
                                    updatedAt: data.updatedAt?.toDate() || new Date(),
                                };
                            }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // 최신순 정렬
                            
                            console.log(`📝 해당 아파트 메모 ${userApartmentMemos.length}개 발견`);
                        }
                    } catch (memoError) {
                        console.error('❌ 사용자 메모 조회 실패:', memoError);
                    }
                }
            } catch (error) {
                console.error('❌ 아파트 기본 정보 수집 실패:', error);
            }
        }

        // 프롬프트 구성 (간소화 버전)
        let systemPrompt = `당신은 부동산 임장 전문가 "임장봇"입니다.

## 기본 역할
- 부동산 임장(현장답사) 전문가로서 투자/거주 관점에서 조언 제공
- 필요한 경우 제공된 함수를 사용하여 실거래 데이터, 건물 정보, 주변 환경을 검색하고 분석
- 사용자의 온보딩 프로필 정보를 바탕으로 맞춤형 조언 제공
- 친근하고 전문적인 톤으로 대화

## 데이터베이스 스키마 정보
- deal_amount: 거래금액 (만원 단위, 30000 = 3억원)
- exclu_use_ar: 전용면적 (㎡)
- deal_ymd: 거래년월일 (YYYYMMDD)
- build_year: 건축년도

## 사용 가능한 함수들
- smartSearch: 🌟 추천! 사용자 입력을 자동 분석하여 최적의 검색 수행 (아파트명/주소/브랜드 자동 판별)
- searchApartmentDeals: 실거래가 데이터 검색 (정확한 아파트명을 알 때)
- searchApartmentBuildingInfo: 건물 정보 검색 (정확한 아파트명을 알 때)
- searchNearbyInfo: 주변 시설 정보 검색
- webSearch: 웹에서 최신 뉴스, 개발 계획, 이슈 검색

## 검색 우선순위
1. 사용자가 모호하거나 복잡한 검색어를 입력하면 → smartSearch 사용
   예: "신당동 840", "래미안", "현대 아파트", "강남 재개발"
2. 정확한 아파트명을 알고 있으면 → searchApartmentDeals 또는 searchApartmentBuildingInfo
3. 최신 정보나 뉴스가 필요하면 → webSearch

## 검색 실패 시 대응 가이드
검색 결과가 없거나 error가 반환된 경우:
1. 사용자에게 더 구체적인 정보를 요청하세요
   - "정확한 아파트명을 다시 확인해 주시겠어요?"
   - "혹시 '○○동 ○○번지'처럼 지번 주소를 아시나요?"
   - "다른 이름으로 불리거나 비슷한 이름의 아파트일 수 있을까요?"
2. 유사한 대안을 제시하세요
   - searchTips가 있으면 해당 팁을 안내
   - 주변 지역의 다른 아파트 검색을 제안
3. 여러 결과가 나온 경우 사용자의 선택을 유도하세요
   - "검색 결과 여러 아파트가 나왔습니다. 어느 것을 찾으시나요?"

## 웹 검색 사용 가이드
다음의 경우 반드시 webSearch 함수를 사용하세요:
- "최근 이슈", "뉴스", "개발", "재개발", "재건축" 등 최신 정보 요청
- "호재", "계획", "전망" 등 미래 계획 관련 질문
- 데이터베이스에 없는 최신 정보가 필요한 경우
- DB 검색이 실패했지만 사용자가 확신하는 경우
- 예: "현대연예인 아파트 최근 이슈" → webSearch("현대연예인 아파트 최근 이슈")

## 검색 전략
1. 먼저 정확한 이름으로 검색 시도
2. 실패 시 지역명이나 건설사명을 분리해서 재검색
3. 여전히 실패하면 웹 검색으로 대체 정보 제공
4. 최종적으로 사용자에게 clarification 요청

데이터가 필요할 때는 반드시 해당 함수를 호출하여 최신 정보를 가져와주세요.`;

        // 사용자 프로필 정보 추가
        if (userProfile && Object.keys(userProfile).length > 0) {
            systemPrompt += `\n\n## 사용자 프로필 정보\n`;
            if (userProfile.purpose) systemPrompt += `- 목적: ${userProfile.purpose}\n`;
            if (userProfile.budgetRange) systemPrompt += `- 예산: ${userProfile.budgetRange}\n`;
            if (userProfile.familyType) systemPrompt += `- 가족구성: ${userProfile.familyType}\n`;
            if (userProfile.workLocation) systemPrompt += `- 직장위치: ${userProfile.workLocation}\n`;
            if (userProfile.priorities) systemPrompt += `- 우선순위: ${userProfile.priorities?.join(', ')}\n`;
        }

        // 아파트 기본 정보만 추가 (상세 데이터는 Function Calling으로)
        if (apartmentBasicInfo) {
            systemPrompt += `\n\n## 현재 분석 대상 아파트
사용자가 현재 "${apartmentBasicInfo.aptnm}" 아파트(${apartmentBasicInfo.jibunaddr})를 보고 있습니다. 
위치: 위도 ${apartmentBasicInfo.lat}, 경도 ${apartmentBasicInfo.lon}

## Function 호출 가이드
- 사용자가 특정 아파트 이름을 언급하지 않으면 → 현재 아파트("${apartmentBasicInfo.aptnm}")에 대한 정보 검색
- 다른 아파트 이름을 언급하면서 "비교" 등의 키워드 사용 시 → 해당 아파트들에 대한 정보 검색
- searchApartmentDeals: apartmentName 파라미터에 아파트 이름 전달
- searchApartmentBuildingInfo: apartmentName 파라미터에 아파트 이름 전달  
- searchNearbyInfo: 위 좌표 사용`;

            // 사용자의 해당 아파트 메모 추가
            if (userApartmentMemos.length > 0) {
                systemPrompt += `\n\n## 사용자의 ${apartmentBasicInfo.aptnm} 임장 메모들`;
                userApartmentMemos.forEach((memo, index) => {
                    const createdDate = memo.createdAt.toLocaleDateString('ko-KR');
                    systemPrompt += `\n\n### ${index + 1}. ${memo.title} (${createdDate})`;
                    if (memo.body) {
                        systemPrompt += `\n${memo.body}`;
                    }
                });
                systemPrompt += `\n\n위 메모들은 사용자가 직접 이 아파트를 방문하여 작성한 임장 기록입니다. 답변 시 이 정보들을 적극 활용하세요.`;
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

        console.log('📋 시스템 프롬프트 길이:', systemPrompt.length);
        console.log('📋 메시지 개수:', messages.length);
        
        // OpenAI API 호출
        console.log('🚀 OpenAI API 호출 시작...');
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "smartSearch",
                        description: "사용자 입력을 분석하여 최적의 검색을 수행합니다 (아파트명, 주소, 브랜드명 등 자동 판별)",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "사용자의 검색어 (예: '신당동 840', '래미안', '현대아파트')"
                                }
                            },
                            required: ["query"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "searchApartmentDeals",
                        description: "아파트의 실거래가 데이터를 검색합니다",
                        parameters: {
                            type: "object",
                            properties: {
                                apartmentName: {
                                    type: "string",
                                    description: "검색할 아파트 이름 (예: '현대연예인')"
                                },
                                period: {
                                    type: "string",
                                    description: "검색 기간 (1년, 3년, 전체 등)",
                                    enum: ["3개월", "6개월", "1년", "3년", "전체"]
                                }
                            },
                            required: ["apartmentName"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "searchApartmentBuildingInfo",
                        description: "아파트의 건물 정보(총괄표제부, 표제부)를 검색합니다",
                        parameters: {
                            type: "object",
                            properties: {
                                apartmentName: {
                                    type: "string",
                                    description: "검색할 아파트 이름 (예: '현대연예인')"
                                }
                            },
                            required: ["apartmentName"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "searchNearbyInfo",
                        description: "아파트 주변 편의시설, 교육시설, 교통시설 등을 검색합니다",
                        parameters: {
                            type: "object",
                            properties: {
                                lat: {
                                    type: "number",
                                    description: "위도"
                                },
                                lon: {
                                    type: "number",
                                    description: "경도"
                                },
                                radius: {
                                    type: "number",
                                    description: "검색 반경 (미터 단위)",
                                    default: 1000
                                }
                            },
                            required: ["lat", "lon"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "webSearch",
                        description: "웹에서 부동산 관련 최신 정보를 검색합니다",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "검색할 키워드"
                                }
                            },
                            required: ["query"]
                        }
                    }
                }
            ],
            tool_choice: "auto",
            max_completion_tokens: 1000,
        });

        const response = completion.choices[0]?.message;
        console.log('🤖 OpenAI API 응답:', {
            response: response?.content?.substring(0, 100) + '...',
            tool_calls: response?.tool_calls?.length || 0,
            choices_length: completion.choices?.length || 0,
            full_response_exists: !!response?.content
        });

        // Function Calling이 있는지 확인
        if (response?.tool_calls && response.tool_calls.length > 0) {
            const functionResults: any[] = [];
            
            for (const toolCall of response.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                let functionResult;
                try {
                    if (functionName === 'smartSearch') {
                        // 스마트 검색: 입력 분석 후 적절한 검색 수행
                        const analysis = await analyzeUserInput(functionArgs.query);
                        functionResult = await executeSearchByAnalysis(analysis, functionArgs.query);
                    } else if (functionName === 'searchApartmentDeals') {
                        functionResult = await handleSearchApartmentDeals(functionArgs);
                    } else if (functionName === 'searchApartmentBuildingInfo') {
                        functionResult = await handleSearchApartmentBuildingInfo(functionArgs);
                    } else if (functionName === 'searchNearbyInfo') {
                        functionResult = await handleSearchNearbyInfo(functionArgs);
                    } else if (functionName === 'webSearch') {
                        functionResult = await handleWebSearch(functionArgs);
                    }
                } catch (error) {
                    console.error(`❌ Function 실행 오류 (${functionName}):`, error);
                    functionResult = { error: `${functionName} 실행 중 오류가 씼생했습니다.` };
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
                model: "gpt-4o-mini", 
                messages: followUpMessages,
                max_completion_tokens: 1000,
            });
            
            const reply = finalCompletion.choices[0]?.message?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

            return c.json({
                success: true,
                reply,
                apartmentData: apartmentBasicInfo || null,
                timestamp: new Date().toISOString()
            });
        }

        // 일반 답변
        const reply = response?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

        return c.json({
            success: true,
            reply,
            apartmentData: apartmentBasicInfo || null,
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
            .select(["id", "aptnm", "jibun_address", "lat", "lon"])
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
            .select(["id", "aptnm", "jibun_address", "lat", "lon"])
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
                address: baseApt.jibun_address,
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
                address: result.aptInfo.jibun_address,
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
                .select(["id", "aptnm", "jibun_address as jibunaddr", "lat", "lon"])
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

// ===== 사용자 입력 분석 함수 =====

interface UserInputAnalysis {
    category: 'apartmentName' | 'address' | 'brandName' | 'generalQuery' | 'comparison' | 'unknown';
    extractedTerms: string[];
    clarificationNeeded: boolean;
    confidence: number;
    suggestedAction?: string;
}

async function analyzeUserInput(userInput: string): Promise<UserInputAnalysis> {
    try {
        const analysisPrompt = `너는 부동산 관련 사용자 입력을 분석하는 전문가야.
사용자의 입력을 분석해서 의도를 정확하게 분류해줘.

분류 카테고리:
- "apartmentName": 특정 아파트 이름을 찾는 경우 (예: "청구e편한세상", "현대아파트")
- "address": 지번이나 도로명 주소를 입력한 경우 (예: "신당동 840", "서초동 1588-1")
- "brandName": 건설사나 브랜드명만 입력한 경우 (예: "래미안", "자이", "현대")
- "comparison": 여러 아파트를 비교하려는 경우 (예: "A와 B 비교")
- "generalQuery": 일반적인 부동산 정보 질문 (예: "재개발 호재", "전세 시세")
- "unknown": 분류가 애매한 경우

반드시 다음 JSON 형식으로만 응답해줘:
{
  "category": "카테고리명",
  "extractedTerms": ["추출된 키워드 배열"],
  "clarificationNeeded": true/false,
  "confidence": 0.0~1.0,
  "suggestedAction": "권장 검색 방법"
}

예시:
입력: "신당동 840 현대아파트"
출력: {"category":"address","extractedTerms":["신당동","840","현대"],"clarificationNeeded":false,"confidence":0.9,"suggestedAction":"지번 검색 후 현대 키워드로 필터링"}

입력: "래미안 아파트 어때?"
출력: {"category":"brandName","extractedTerms":["래미안"],"clarificationNeeded":true,"confidence":0.7,"suggestedAction":"래미안 브랜드 전체 검색 또는 지역 특정 필요"}

사용자 입력: "${userInput}"`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: analysisPrompt }
            ],
            temperature: 0.0,
            max_tokens: 200
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        
        // JSON 파싱 시도
        try {
            const analysis = JSON.parse(responseText) as UserInputAnalysis;
            console.log('📊 입력 분석 결과:', analysis);
            return analysis;
        } catch (parseError) {
            console.error('❌ 분석 결과 파싱 실패:', parseError);
            // 기본값 반환
            return {
                category: 'unknown',
                extractedTerms: [userInput],
                clarificationNeeded: true,
                confidence: 0.3,
                suggestedAction: '입력을 더 구체적으로 해주세요'
            };
        }
    } catch (error) {
        console.error('❌ 사용자 입력 분석 오류:', error);
        // 오류 시 기본값 반환
        return {
            category: 'unknown',
            extractedTerms: [userInput],
            clarificationNeeded: false,
            confidence: 0.5,
            suggestedAction: '일반 검색 시도'
        };
    }
}

// 분석 결과에 따른 검색 전략 결정
async function executeSearchByAnalysis(analysis: UserInputAnalysis, originalInput: string) {
    const { category, extractedTerms, clarificationNeeded, confidence, suggestedAction } = analysis;
    
    console.log(`🎯 검색 전략: ${category} (신뢰도: ${confidence})`);
    
    // 신뢰도가 낮으면 clarification 필요
    if (confidence < 0.5 && clarificationNeeded) {
        return {
            needsClarification: true,
            analysisInfo: {
                category,
                confidence,
                suggestedAction
            },
            message: "입력하신 내용이 명확하지 않습니다. 다음 중 어떤 것을 찾으시나요?",
            suggestions: [
                "특정 아파트 이름 (예: '청구e편한세상')",
                "지번 주소 (예: '신당동 840')",
                "브랜드명 (예: '래미안 강남')",
                "일반 정보 (예: '재개발 호재')"
            ]
        };
    }
    
    switch (category) {
        case 'apartmentName':
            // 아파트명 직접 검색
            const nameResult = await handleSearchApartmentDeals({ 
                apartmentName: extractedTerms.join(' ') 
            });
            
            // 검색 실패 시 추가 시도
            if (nameResult.error && extractedTerms.length > 1) {
                // 각 단어로 개별 검색 시도
                for (const term of extractedTerms) {
                    const retryResult = await handleSearchApartmentDeals({ 
                        apartmentName: term 
                    });
                    if (!retryResult.error) {
                        return retryResult;
                    }
                }
            }
            return nameResult;
            
        case 'address':
            // 지번 주소 우선 검색
            const addressQuery = extractedTerms.join(' ');
            const addressResult = await handleSearchApartmentDeals({ 
                apartmentName: addressQuery 
            });
            
            // 주소 검색 실패 시 웹 검색 시도
            if (addressResult.error) {
                console.log('📍 주소 검색 실패, 웹 검색 시도');
                return await handleWebSearch({ 
                    query: `${addressQuery} 아파트` 
                });
            }
            return addressResult;
            
        case 'brandName':
            // 브랜드명 검색
            const brandResult = await handleSearchApartmentDeals({ 
                apartmentName: extractedTerms[0] 
            });
            
            // 결과가 너무 많으면 지역 특정 요청
            if (!brandResult.error && brandResult.foundApartments?.length > 10) {
                return {
                    ...brandResult,
                    needsRefinement: true,
                    message: `"${extractedTerms[0]}" 브랜드 아파트가 ${brandResult.foundApartments.length}개 검색되었습니다. 지역을 추가로 입력해주시면 더 정확한 결과를 제공할 수 있습니다.`,
                    suggestions: ['강남구', '서초구', '송파구', '마포구']
                };
            }
            return brandResult;
            
        case 'comparison':
            // 비교 검색 (여러 아파트 검색)
            const results = [];
            for (const term of extractedTerms.slice(0, 3)) { // 최대 3개까지
                const result = await handleSearchApartmentDeals({ 
                    apartmentName: term 
                });
                results.push({ 
                    searchTerm: term, 
                    result,
                    found: !result.error 
                });
            }
            
            const foundCount = results.filter(r => r.found).length;
            return { 
                comparisonResults: results,
                summary: `${extractedTerms.length}개 중 ${foundCount}개 아파트를 찾았습니다.`
            };
            
        case 'generalQuery':
            // 웹 검색으로 전환
            return await handleWebSearch({ 
                query: originalInput 
            });
            
        default:
            // 기본 검색 시도
            const defaultResult = await handleSearchApartmentDeals({ 
                apartmentName: originalInput 
            });
            
            // 실패시 웹 검색
            if (defaultResult.error) {
                return await handleWebSearch({ 
                    query: originalInput 
                });
            }
            return defaultResult;
    }
}

// ===== Function Calling 핸들러 함수들 =====

// 아파트 실거래가 검색 함수
async function handleSearchApartmentDeals(args: { apartmentName: string; period?: string }) {
    try {
        const { apartmentName, period = "1년" } = args;
        console.log(`🔍 통합 실거래가 검색: apartmentName=${apartmentName}, period=${period}`);
        
        let aptList: any[] = [];
        let searchStrategy = '';
        
        // 지번 주소 검색 시도 (예: "신당동 840", "신당동 840-1", "신당동 840번지")
        const addressPatterns = [
            /(.+[동로가])\s*(\d+)[-~]?(\d*)(?:번지|번|호)?/,  // 신당동 840-1번지
            /(.+[동로가])\s+(\d+)/,  // 신당동 840
        ];
        
        for (const pattern of addressPatterns) {
            const addressMatch = apartmentName.match(pattern);
            if (addressMatch) {
                const location = addressMatch[1];
                const mainNum = addressMatch[2];
                const subNum = addressMatch[3] || '';
                
                // 정규식과 유사도 검색 병합
                const jibunPattern = subNum 
                    ? `${location}.*${mainNum}[-~]?${subNum}`
                    : `${location}.*${mainNum}(?!\\d)`;
                
                aptList = await db
                    .selectFrom('oi.apt_info')
                    .select(['id', 'apt_nm', 'jibun_address'])
                    .where(sql`jibun_address ~ ${jibunPattern}`)
                    .limit(10)
                    .execute();
                
                // 정규식 매칭 실패시 유사도 검색 시도
                if (aptList.length === 0) {
                    const searchAddr = `${location} ${mainNum}${subNum ? '-' + subNum : ''}`;
                    aptList = await db
                        .selectFrom('oi.apt_info')
                        .select(['id', 'apt_nm', 'jibun_address', sql`similarity(jibun_address, ${searchAddr}) as addr_sim`])
                        .where(sql`similarity(jibun_address, ${searchAddr}) > 0.3`)
                        .orderBy(sql`similarity(jibun_address, ${searchAddr}) desc`)
                        .limit(10)
                        .execute();
                }
                    
                if (aptList.length > 0) {
                    searchStrategy = `지번검색(${location} ${mainNum}${subNum ? '-' + subNum : ''}번지)`;
                    break;
                }
            }
        }
        
        // 1차 검색: pg_trgm 유사도 기반 검색 (동적 기준)
        if (aptList.length === 0) {
            // 높은 유사도부터 시도
            const similarityLevels = [0.3, 0.25, 0.2];
            for (const threshold of similarityLevels) {
                aptList = await db
                    .selectFrom('oi.apt_info')
                    .select(['id', 'apt_nm', 'jibun_address', sql`similarity(apt_nm, ${apartmentName}) as sim_score`])
                    .where(sql`similarity(apt_nm, ${apartmentName}) > ${threshold}`)
                    .orderBy(sql`similarity(apt_nm, ${apartmentName}) desc`)
                    .limit(15)
                    .execute();
                    
                if (aptList.length > 0) {
                    searchStrategy = `유사도검색(similarity > ${threshold})`;
                    break;
                }
            }
        }
        
        // 2차 검색: 기존 ILIKE 검색과 병합
        if (aptList.length < 5) {  // 결과가 부족하면 추가 검색
            const ilikeResults = await db
                .selectFrom('oi.apt_info')
                .select(['id', 'apt_nm', 'jibun_address'])
                .where('apt_nm', 'ilike', `%${apartmentName}%`)
                .orderBy('apt_nm', 'asc')
                .limit(10)
                .execute();
            
            // 기존 결과와 병합 (중복 제거)
            const existingIds = new Set(aptList.map(apt => apt.id));
            const newResults = ilikeResults.filter(apt => !existingIds.has(apt.id));
            aptList = [...aptList, ...newResults].slice(0, 15);
                
            if (ilikeResults.length > 0) {
                searchStrategy = aptList.length > 0 ? `${searchStrategy} + ILIKE검색` : 'ILIKE검색';
            }
        }
        
        // 3차 검색: 지명+아파트명 분리
        if (aptList.length === 0) {
            const locationKeywords = ['신당', '강남', '서초', '마포', '송파', '강서', '구로', '영등포', '용산', '중구', '종로', '성북', '동대문', '성동', '광진', '노원', '도봉', '강북', '은평', '서대문', '중랑', '강동'];
            
            for (const location of locationKeywords) {
                if (apartmentName.includes(location)) {
                    const remaining = apartmentName.replace(location, '').trim();
                    if (remaining.length >= 2) {
                        aptList = await db
                            .selectFrom('oi.apt_info')
                            .select(['id', 'apt_nm', 'jibun_address'])
                            .where('apt_nm', 'ilike', `%${remaining}%`)
                            .where('jibun_address', 'ilike', `%${location}%`)
                            .orderBy('apt_nm', 'asc')
                            .limit(10)
                            .execute();
                            
                        if (aptList.length > 0) {
                            searchStrategy = `지명분리검색(${location} + ${remaining})`;
                            break;
                        }
                    }
                }
            }
        }
        
        // 4차 검색: 건설사명만으로 시도
        if (aptList.length === 0) {
            // 건설사 및 브랜드명 확대
            const constructorKeywords = [
                // 건설사
                '현대', '삼성', 'SK', 'LG', '대우', '한화', '롯데', '포스코', '코오롱', '한양', '대림', '현진', '벽산',
                'GS', '두산', '태영', '계룡', '금호', '호반', '중흥', '부영', '신세계', '이수', '동부',
                // 브랜드명
                '래미안', '자이', '아이파크', '푸르지오', '롯데캐슬', 'SK뷰', 'e편한세상', '힐스테이트', 
                '더샵', '트리플에이', '센트럴', '파크리오', '리버파크', '파크뷰', '센트레빌', '하늘채',
                '위브', '데시앙', '센트럴파크', '아크로', '디에이치', '엘크루', '리슈빌', '유보라'
            ];
            
            for (const constructor of constructorKeywords) {
                if (apartmentName.includes(constructor)) {
                    aptList = await db
                        .selectFrom('oi.apt_info')
                        .select(['id', 'apt_nm', 'jibun_address'])
                        .where('apt_nm', 'ilike', `%${constructor}%`)
                        .orderBy('apt_nm', 'asc')
                        .limit(10)
                        .execute();
                        
                    if (aptList.length > 0) {
                        searchStrategy = `건설사검색(${constructor})`;
                        break;
                    }
                }
            }
        }
        
        console.log(`🏠 검색된 아파트 ${aptList.length}개 (${searchStrategy}):`, aptList.map(apt => apt.apt_nm).join(', '));
            
        if (!aptList || aptList.length === 0) {
            return { 
                error: `"${apartmentName}" 아파트를 찾을 수 없습니다.`,
                suggestion: "다음과 같은 방법으로 다시 검색해보세요:",
                searchTips: [
                    "정확한 아파트명 입력 (예: '현대아파트', '현대 아파트')",
                    "지역명 포함 (예: '신당동 현대', '강남구 래미안')",
                    "지번 주소로 검색 (예: '신당동 840', '서초동 1588')",
                    "건설사명만 입력 (예: '현대', '삼성', 'SK')"
                ],
                searchAttempts: "유사도 검색, 지번 검색, 지명 분리, 건설사명 검색을 모두 시도했습니다."
            };
        }
        
        // 첫 번째 아파트의 실거래가 조회
        const aptInfo = aptList[0];
        
        const url = `http://localhost:8787/api/search/deals/${aptInfo.id}?period=${encodeURIComponent(period)}`;
        console.log(`📡 API 요청 URL:`, url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`📊 API 응답:`, response.ok, data?.length || 'no data');
        
        if (!response.ok) {
            return { error: "실거래가 데이터를 가져올 수 없습니다." };
        }
        
        // 여러 아파트가 검색된 경우 목록 우선 제시  
        if (aptList.length > 1) {
            return {
                searchKeyword: apartmentName,
                searchType: "multiple_results",
                totalFound: aptList.length,
                foundApartments: aptList.map((apt, index) => ({
                    순번: index + 1,
                    아파트명: apt.apt_nm,
                    주소: apt.jibun_address,
                    ID: apt.id
                })),
                message: `"${apartmentName}" 검색 결과 ${aptList.length}개의 아파트를 찾았습니다. 실거래가를 조회하고 싶은 아파트를 선택해주세요.`,
                instruction: "위 목록에서 관심 있는 아파트의 정확한 이름을 말씀해주시면 해당 아파트의 실거래가 정보를 제공해드리겠습니다."
            };
        }

        // 단일 아파트인 경우에만 상세 거래 데이터 제공
        return {
            searchKeyword: apartmentName,
            searchType: "single_result", 
            totalFound: 1,
            foundApartment: {
                아파트명: aptInfo.apt_nm,
                주소: aptInfo.jibun_address
            },
            dealData: {
                period,
                totalDeals: data.length,
                recentDeals: data.slice(0, 10).map((deal: any) => ({
                    date: `${deal.deal_year}.${deal.deal_month.toString().padStart(2, '0')}.${deal.deal_day.toString().padStart(2, '0')}`,
                    price: deal.deal_amount ? `${deal.deal_amount}만원` : `보증금 ${deal.deposit}만원${deal.monthly_rent ? `, 월세 ${deal.monthly_rent}만원` : ''}`,
                    area: `${deal.exclu_use_ar}㎡`,
                    floor: deal.floor ? `${deal.floor}층` : '정보없음'
                }))
            },
            summary: `${aptInfo.apt_nm}의 ${period} 동안 총 ${data.length}건의 거래가 있었습니다.`
        };
        
    } catch (error) {
        console.error('❌ 실거래가 검색 오류:', error);
        return { error: "실거래가 검색 중 오류가 발생했습니다." };
    }
}

// 아파트 건물정보 검색 함수
async function handleSearchApartmentBuildingInfo(args: { apartmentName: string }) {
    try {
        const { apartmentName } = args;
        console.log(`🏢 통합 건물정보 검색: apartmentName=${apartmentName}`);
        
        let aptList: any[] = [];
        let searchStrategy = '';
        
        // 지번 주소 검색 시도 (예: "신당동 840", "신당동 840-1", "신당동 840번지")
        const addressPatterns = [
            /(.+[동로가])\s*(\d+)[-~]?(\d*)(?:번지|번|호)?/,  // 신당동 840-1번지
            /(.+[동로가])\s+(\d+)/,  // 신당동 840
        ];
        
        for (const pattern of addressPatterns) {
            const addressMatch = apartmentName.match(pattern);
            if (addressMatch) {
                const location = addressMatch[1];
                const mainNum = addressMatch[2];
                const subNum = addressMatch[3] || '';
                
                // 정규식과 유사도 검색 병합
                const jibunPattern = subNum 
                    ? `${location}.*${mainNum}[-~]?${subNum}`
                    : `${location}.*${mainNum}(?!\\d)`;
                
                aptList = await db
                    .selectFrom('oi.apt_info')
                    .select(['id', 'apt_nm', 'jibun_address'])
                    .where(sql`jibun_address ~ ${jibunPattern}`)
                    .limit(10)
                    .execute();
                
                // 정규식 매칭 실패시 유사도 검색 시도
                if (aptList.length === 0) {
                    const searchAddr = `${location} ${mainNum}${subNum ? '-' + subNum : ''}`;
                    aptList = await db
                        .selectFrom('oi.apt_info')
                        .select(['id', 'apt_nm', 'jibun_address', sql`similarity(jibun_address, ${searchAddr}) as addr_sim`])
                        .where(sql`similarity(jibun_address, ${searchAddr}) > 0.3`)
                        .orderBy(sql`similarity(jibun_address, ${searchAddr}) desc`)
                        .limit(10)
                        .execute();
                }
                    
                if (aptList.length > 0) {
                    searchStrategy = `지번검색(${location} ${mainNum}${subNum ? '-' + subNum : ''}번지)`;
                    break;
                }
            }
        }
        
        // 1차 검색: pg_trgm 유사도 기반 검색 (동적 기준)
        if (aptList.length === 0) {
            // 높은 유사도부터 시도
            const similarityLevels = [0.3, 0.25, 0.2];
            for (const threshold of similarityLevels) {
                aptList = await db
                    .selectFrom('oi.apt_info')
                    .select(['id', 'apt_nm', 'jibun_address', sql`similarity(apt_nm, ${apartmentName}) as sim_score`])
                    .where(sql`similarity(apt_nm, ${apartmentName}) > ${threshold}`)
                    .orderBy(sql`similarity(apt_nm, ${apartmentName}) desc`)
                    .limit(15)
                    .execute();
                    
                if (aptList.length > 0) {
                    searchStrategy = `유사도검색(similarity > ${threshold})`;
                    break;
                }
            }
        }
        
        // 2차 검색: 기존 ILIKE 검색과 병합
        if (aptList.length < 5) {  // 결과가 부족하면 추가 검색
            const ilikeResults = await db
                .selectFrom('oi.apt_info')
                .select(['id', 'apt_nm', 'jibun_address'])
                .where('apt_nm', 'ilike', `%${apartmentName}%`)
                .orderBy('apt_nm', 'asc')
                .limit(10)
                .execute();
            
            // 기존 결과와 병합 (중복 제거)
            const existingIds = new Set(aptList.map(apt => apt.id));
            const newResults = ilikeResults.filter(apt => !existingIds.has(apt.id));
            aptList = [...aptList, ...newResults].slice(0, 15);
                
            if (ilikeResults.length > 0) {
                searchStrategy = aptList.length > 0 ? `${searchStrategy} + ILIKE검색` : 'ILIKE검색';
            }
        }
        
        // 3차 검색: 지명+아파트명 분리
        if (aptList.length === 0) {
            const locationKeywords = ['신당', '강남', '서초', '마포', '송파', '강서', '구로', '영등포', '용산', '중구', '종로', '성북', '동대문', '성동', '광진', '노원', '도봉', '강북', '은평', '서대문', '중랑', '강동'];
            
            for (const location of locationKeywords) {
                if (apartmentName.includes(location)) {
                    const remaining = apartmentName.replace(location, '').trim();
                    if (remaining.length >= 2) {
                        aptList = await db
                            .selectFrom('oi.apt_info')
                            .select(['id', 'apt_nm', 'jibun_address'])
                            .where('apt_nm', 'ilike', `%${remaining}%`)
                            .where('jibun_address', 'ilike', `%${location}%`)
                            .orderBy('apt_nm', 'asc')
                            .limit(10)
                            .execute();
                            
                        if (aptList.length > 0) {
                            searchStrategy = `지명분리검색(${location} + ${remaining})`;
                            break;
                        }
                    }
                }
            }
        }
        
        // 4차 검색: 건설사명만으로 시도
        if (aptList.length === 0) {
            // 건설사 및 브랜드명 확대
            const constructorKeywords = [
                // 건설사
                '현대', '삼성', 'SK', 'LG', '대우', '한화', '롯데', '포스코', '코오롱', '한양', '대림', '현진', '벽산',
                'GS', '두산', '태영', '계룡', '금호', '호반', '중흥', '부영', '신세계', '이수', '동부',
                // 브랜드명
                '래미안', '자이', '아이파크', '푸르지오', '롯데캐슬', 'SK뷰', 'e편한세상', '힐스테이트', 
                '더샵', '트리플에이', '센트럴', '파크리오', '리버파크', '파크뷰', '센트레빌', '하늘채',
                '위브', '데시앙', '센트럴파크', '아크로', '디에이치', '엘크루', '리슈빌', '유보라'
            ];
            
            for (const constructor of constructorKeywords) {
                if (apartmentName.includes(constructor)) {
                    aptList = await db
                        .selectFrom('oi.apt_info')
                        .select(['id', 'apt_nm', 'jibun_address'])
                        .where('apt_nm', 'ilike', `%${constructor}%`)
                        .orderBy('apt_nm', 'asc')
                        .limit(10)
                        .execute();
                        
                    if (aptList.length > 0) {
                        searchStrategy = `건설사검색(${constructor})`;
                        break;
                    }
                }
            }
        }
        
        console.log(`🏢 검색된 아파트 ${aptList.length}개 (${searchStrategy}):`, aptList.map(apt => apt.apt_nm).join(', '));
        
        if (!aptList || aptList.length === 0) {
            return { 
                error: `"${apartmentName}" 아파트를 찾을 수 없습니다.`,
                suggestion: "다음과 같은 방법으로 다시 검색해보세요:",
                searchTips: [
                    "정확한 아파트명 입력 (예: '현대아파트', '현대 아파트')",
                    "지역명 포함 (예: '신당동 현대', '강남구 래미안')",
                    "지번 주소로 검색 (예: '신당동 840', '서초동 1588')",
                    "건설사명만 입력 (예: '현대', '삼성', 'SK')"
                ],
                searchAttempts: "유사도 검색, 지번 검색, 지명 분리, 건설사명 검색을 모두 시도했습니다."
            };
        }
        
        console.log(`🏢 검색된 아파트: ${aptList.length}개 - ${aptList.map(apt => apt.apt_nm).join(', ')}`);
        
        // 첫 번째 아파트의 상세 정보만 조회
        const aptInfo = aptList[0];
        
        const response = await fetch(`http://localhost:8787/api/search/building-info/${aptInfo.id}`);
        const data = await response.json();
        
        if (!response.ok) {
            return { error: "건물정보를 가져올 수 없습니다." };
        }
        
        // 여러 아파트가 검색된 경우 목록 우선 제시
        if (aptList.length > 1) {
            return {
                searchKeyword: apartmentName,
                searchType: "multiple_results",
                searchStrategy,
                totalFound: aptList.length,
                foundApartments: aptList.map((apt, index) => ({
                    순번: index + 1,
                    아파트명: apt.apt_nm,
                    주소: apt.jibun_address,
                    ID: apt.id
                })),
                message: `"${apartmentName}" 검색 결과 ${aptList.length}개의 아파트를 찾았습니다 (${searchStrategy}). 구체적인 건물 정보를 원하시는 아파트를 선택해주세요.`,
                instruction: "위 목록에서 관심 있는 아파트의 정확한 이름을 말씀해주시면 상세한 건물 정보를 제공해드리겠습니다."
            };
        }
        
        // 단일 아파트인 경우에만 상세 정보 제공
        return {
            searchKeyword: apartmentName,
            searchType: "single_result",
            totalFound: 1,
            foundApartment: {
                아파트명: aptInfo.apt_nm,
                주소: aptInfo.jibun_address
            },
            detailedInfo: {
                recap: data.recap_info ? {
                    대지면적: `${data.recap_info.platarea}㎡`,
                    건축면적: `${data.recap_info.archarea}㎡`,
                    연면적: `${data.recap_info.totarea}㎡`,
                    지상층수: `${data.recap_info.grndflrcnt}층`,
                    지하층수: `${data.recap_info.ugrndflrcnt}층`,
                    세대수: `${data.recap_info.hhldcnt}세대`,
                    주차대수: `${data.recap_info.totpkngcnt}대`,
                    사용승인일: data.recap_info.useaprday
                } : null,
                buildings: data.title_infos?.map((info: any) => ({
                    동명: info.dongnm,
                    건물명: info.bldnm,
                    주용도: info.mainpurpscdnm,
                    구조: info.strctcdnm
                })) || []
            }
        };
        
    } catch (error) {
        console.error('❌ 건물정보 검색 오류:', error);
        return { error: "건물정보 검색 중 오류가 발생했습니다." };
    }
}

// 주변 정보 검색 함수
async function handleSearchNearbyInfo(args: { lat: number; lon: number; radius?: number }) {
    try {
        const { lat, lon, radius = 1000 } = args;
        console.log(`📍 주변정보 검색: lat=${lat}, lon=${lon}, radius=${radius}m`);
        
        const response = await fetch(`http://localhost:8787/api/search/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
        const data = await response.json();
        
        if (!response.ok) {
            return { error: "주변정보를 가져올 수 없습니다." };
        }
        
        const categorizedPOIs = {
            교육시설: data.pois?.filter((poi: any) => poi.category === '교육') || [],
            공공기관: data.pois?.filter((poi: any) => ['공공기관', '안전시설'].includes(poi.category)) || [],
            교통시설: data.pois?.filter((poi: any) => poi.category === '교통') || [],
            생활편의: data.pois?.filter((poi: any) => ['생활', '의료', '금융'].includes(poi.category)) || []
        };
        
        return {
            location: { lat, lon },
            searchRadius: radius,
            totalPOIs: data.total || 0,
            categories: Object.entries(categorizedPOIs).map(([category, pois]: [string, any]) => ({
                category,
                count: pois.length,
                items: pois.slice(0, 5).map((poi: any) => ({
                    name: poi.name,
                    distance: `${poi.distance}m`,
                    address: poi.address
                }))
            }))
        };
        
    } catch (error) {
        console.error('❌ 주변정보 검색 오류:', error);
        return { error: "주변정보 검색 중 오류가 발생했습니다." };
    }
}

// 웹 검색 함수
async function handleWebSearch(args: { query: string }) {
    try {
        const { query } = args;
        console.log(`🔍 웹 검색: "${query}"`);
        
        // Google Custom Search API 사용
        const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
        const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        if (googleApiKey && googleSearchEngineId) {
            try {
                // 부동산 관련 검색어로 확장
                const enhancedQuery = `${query} 부동산 임장 투자 site:kr OR site:com`;
                
                const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(enhancedQuery)}&num=10&gl=kr&hl=ko`;
                
                const response = await fetch(googleUrl);
                if (!response.ok) {
                    throw new Error(`Google API ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.items && data.items.length > 0) {
                    const results = data.items.map((item: any) => ({
                        title: item.title,
                        snippet: item.snippet,
                        source: new URL(item.link).hostname,
                        url: item.link,
                        displayLink: item.displayLink,
                        formattedUrl: item.formattedUrl
                    }));
                    
                    return {
                        query,
                        originalQuery: query,
                        enhancedQuery,
                        resultsCount: results.length,
                        totalResults: data.searchInformation?.totalResults || '0',
                        searchTime: data.searchInformation?.searchTime || '0',
                        results,
                        searchEngine: "Google"
                    };
                }
            } catch (googleError) {
                console.error('❌ Google Search API 오류:', googleError);
                return { 
                    error: `Google 검색 실패: ${googleError.message}`,
                    query 
                };
            }
        }
        
        // Fallback: 간단한 키워드 기반 부동산 정보 제공
        const realEstateInfo = getRealEstateInfoByKeyword(query);
        
        return {
            query,
            results: realEstateInfo,
            searchEngine: "내장 정보",
            note: "웹 검색 API가 설정되지 않아 내장 부동산 정보를 제공합니다."
        };
        
    } catch (error) {
        console.error('❌ 웹 검색 오류:', error);
        return { error: "웹 검색 중 오류가 발생했습니다." };
    }
}

// 키워드 기반 부동산 정보 제공 함수
function getRealEstateInfoByKeyword(query: string): any[] {
    const lowerQuery = query.toLowerCase();
    
    // 키워드별 맞춤 정보 매핑
    const keywordMapping: { [key: string]: any[] } = {
        '시세': [
            {
                title: "부동산 시세 분석 방법",
                snippet: "부동산 시세는 실거래가, 공시지가, 감정평가액을 종합적으로 분석해야 합니다. 최근 거래 사례와 주변 시세를 비교하여 적정 가격을 판단하세요.",
                source: "부동산 전문 분석"
            },
            {
                title: "시세 조회 사이트 활용법",
                snippet: "국토교통부 실거래가 공개시스템, KB부동산 시세, 네이버 부동산 등을 활용하여 정확한 시세 정보를 확인할 수 있습니다.",
                source: "부동산 정보 가이드"
            }
        ],
        '투자': [
            {
                title: "부동산 투자 전략",
                snippet: "성공적인 부동산 투자를 위해서는 입지, 교통, 개발 계획, 수급 상황을 종합 분석해야 합니다. 장기적 관점에서 안정적인 수익을 추구하세요.",
                source: "부동산 투자 전문가"
            },
            {
                title: "투자 시 주의사항",
                snippet: "과도한 레버리지는 위험할 수 있습니다. 본인의 재정 상황과 위험 성향에 맞는 투자 전략을 수립하고, 전문가 상담을 받는 것이 좋습니다.",
                source: "부동산 투자 가이드"
            }
        ],
        '개발': [
            {
                title: "도시개발사업 이해하기",
                snippet: "도시개발사업, 재개발, 재건축 등의 개발 사업은 지역의 부동산 가치에 큰 영향을 미칩니다. 사업 진행 단계와 일정을 확인하는 것이 중요합니다.",
                source: "개발사업 전문 정보"
            },
            {
                title: "개발호재 분석 방법",
                snippet: "교통 인프라 확충, 대형 상업시설 건설, 공공기관 이전 등의 개발 계획을 미리 파악하여 투자 기회를 찾을 수 있습니다.",
                source: "부동산 개발 분석"
            }
        ],
        '교통': [
            {
                title: "교통 접근성과 부동산 가치",
                snippet: "지하철, 버스 등 대중교통 접근성은 부동산 가치의 핵심 요소입니다. 도보 10분 이내 지하철역이 있으면 프리미엄이 붙습니다.",
                source: "교통 입지 분석"
            },
            {
                title: "신교통망 건설 영향",
                snippet: "지하철 연장, 신규 노선 개통, 광역교통망 확충은 해당 지역 부동산 가격 상승 요인이 됩니다. 계획 단계부터 관심을 가져야 합니다.",
                source: "교통 개발 정보"
            }
        ],
        '학군': [
            {
                title: "학군과 부동산 가격",
                snippet: "우수한 학군은 부동산 가격에 프리미엄을 형성합니다. 초등학교 학군이 가장 중요하며, 명문 중고등학교 진학률도 고려해야 합니다.",
                source: "학군 부동산 전문"
            },
            {
                title: "학군 변동 위험성",
                snippet: "학교 통폐합, 학구 조정 등으로 학군이 변경될 수 있습니다. 교육청 정책과 학생 수 변화 추이를 주시해야 합니다.",
                source: "교육 정책 분석"
            }
        ],
        '재건축': [
            {
                title: "재건축 투자 포인트",
                snippet: "재건축은 고수익이 가능하지만 긴 기간과 높은 리스크가 따릅니다. 조합 설립, 안전진단, 사업 승인 과정을 차례로 거쳐야 합니다.",
                source: "재건축 전문 정보"
            },
            {
                title: "재건축 추진 조건",
                snippet: "건물 노후도, 안전성, 주민 동의율 등이 재건축 추진의 핵심 조건입니다. 관련 법규와 정책 변화도 지속적으로 확인해야 합니다.",
                source: "재건축 사업 가이드"
            }
        ]
    };
    
    // 매칭되는 키워드 찾기
    for (const [keyword, info] of Object.entries(keywordMapping)) {
        if (lowerQuery.includes(keyword)) {
            return info;
        }
    }
    
    // 기본 정보 반환
    return [
        {
            title: "부동산 투자 기본 원칙",
            snippet: "Location(입지), Location(입지), Location(입지)! 부동산 투자의 기본은 좋은 입지를 선택하는 것입니다. 교통, 교육, 편의시설, 개발 계획을 종합 고려하세요.",
            source: "부동산 투자 기본 가이드"
        },
        {
            title: "임장의 중요성",
            snippet: "온라인 정보만으로는 알 수 없는 현장의 생생한 정보를 확인하는 것이 임장입니다. 주변 환경, 교통 상황, 상권 활성화 정도 등을 직접 체크해보세요.",
            source: "임장 투자 전문가"
        },
        {
            title: "리스크 관리",
            snippet: "부동산 투자에는 항상 리스크가 따릅니다. 대출 비율 조절, 충분한 자금 여유, 다양한 정보 수집을 통해 리스크를 최소화하세요.",
            source: "부동산 리스크 관리"
        }
    ];
}

export { aiRoute };