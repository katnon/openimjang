// apps/bff/src/routes/ai.ts
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { db } from '../lib/db';

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

        // PostgreSQL에서 실거래 데이터 조회
        const tradeData = await db
            .selectFrom('oi.trade_raw')
            .selectAll()
            .where('apt_cd', '=', aptId.toString())
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
            max_tokens: 2000,
            temperature: 0.7,
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
                max_tokens: 2000,
                temperature: 0.7,
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
        const { message, memos, aptData, aptId, chatHistory = [] } = await c.req.json();
        
        // PostgreSQL에서 실거래 데이터 조회 (aptId가 있는 경우)
        let tradeData = [];
        if (aptId) {
            tradeData = await db
                .selectFrom('oi.trade_raw')
                .selectAll()
                .where('apt_cd', '=', aptId.toString())
                .orderBy('deal_ymd', 'desc')
                .limit(10)
                .execute();
        }

        // 컨텍스트 정보 구성
        const contextInfo = `
## 현재 아파트 정보
- 이름: ${aptData?.aptName || '정보 없음'}
- 주소: ${aptData?.address || '정보 없음'}

## 사용자의 임장 메모
${memos && memos.length > 0 ? memos.map((memo: any, index: number) => `
${index + 1}. ${memo.title}: ${memo.body || '내용 없음'}
`).join('\n') : '임장 메모 없음'}

## 최근 실거래 정보
${tradeData && tradeData.length > 0 ? tradeData.slice(0, 5).map((trade: any, index: number) => `
${index + 1}. ${trade.deal_ymd} - ${trade.exclu_use_ar}㎡, ${trade.deal_amount}만원, ${trade.floor}층
`).join('\n') : '실거래 정보 없음'}
`;

        // 대화 히스토리 구성
        const messages = [
            {
                role: "system",
                content: `당신은 부동산 임장 전문 AI 어시스턴트입니다. 
위의 정보를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요.
실거래 데이터, 임장 메모, 시장 동향을 종합적으로 고려하여 답변하세요.
답변은 친근하고 이해하기 쉽게 해주세요.

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
            max_tokens: 1000,
            temperature: 0.8,
        });

        const reply = completion.choices[0]?.message?.content || "죄송합니다. 답변을 생성할 수 없습니다.";

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

export { aiRoute };