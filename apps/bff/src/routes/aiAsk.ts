// apps/bff/src/routes/aiAsk.ts - RAG 기반 질의응답 전용 라우트
import { Hono } from 'hono';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth';
import { vectorService } from '../services/vectorService';

const aiAskRoute = new Hono();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// POST /ask - RAG 기반 질의응답
aiAskRoute.post('/ask', /* authMiddleware, */ async (c) => {
    try {
        const { message, context } = await c.req.json();

        console.log('🔍 RAG 질의응답 요청:', {
            message: message?.slice(0, 100) + '...',
            hasContext: !!context
        });

        // 1) 벡터 검색으로 관련 컨텍스트 수집
        const retrievedContext = await retrieveRelevantContext(message, context);

        // 2) 시스템 메시지에 RAG 컨텍스트 통합
        const systemMessage = createSystemMessageWithRAG(retrievedContext);

        // 3) 대화 메시지 구성 - 검색된 문서가 있으면 사용자 메시지에도 강조
        const userMessage = retrievedContext.documents.length > 0 
            ? `${message}\n\n📋 참고: 위에 제공된 참고 문서의 정확한 정보를 바탕으로 답변해주세요.` 
            : message;

        const messages: any[] = [
            { role: 'system', content: systemMessage },
            ...(context?.messages ?? []),
            { role: 'user', content: userMessage }
        ];

        // 4) OpenAI 모델 호출 (RAG 전용이므로 Function Calling 없음)
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 1500
        });

        const reply = response.choices?.[0]?.message?.content ?? '죄송합니다. 답변을 생성하지 못했습니다.';

        return c.json({
            success: true,
            reply,
            sources: retrievedContext.sources,
            retrievalMetadata: {
                documentsFound: retrievedContext.documents.length,
                searchQuery: message.slice(0, 50),
                relevanceScore: retrievedContext.averageScore
            }
        });

    } catch (error: any) {
        console.error('❌ RAG 질의응답 처리 오류:', error);
        return c.json({
            success: false,
            error: error.message || 'RAG 질의응답 처리 중 오류가 발생했습니다.'
        }, 500);
    }
});

/**
 * 벡터 검색을 통해 관련 컨텍스트를 검색합니다
 */
async function retrieveRelevantContext(query: string, context?: any): Promise<{
    documents: any[];
    sources: string[];
    averageScore: number;
}> {
    try {
        console.log('🔍 벡터 검색 수행:', { query: query.slice(0, 50) });

        // 벡터 서비스를 통한 검색
        const results = await vectorService.search(query, {
            topK: 5,
            userId: context?.userId,
            filter: {
                // 컨텍스트에 따른 필터링
                ...(context?.apartmentId && { apartmentId: context.apartmentId.toString() })
            }
        });

        // 컨텍스트에 메모 데이터가 있는 경우 추가
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

        console.log('✅ 벡터 검색 완료:', {
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
        console.error('❌ 벡터 검색 오류:', error);
        return {
            documents: [],
            sources: [],
            averageScore: 0
        };
    }
}

/**
 * RAG 컨텍스트가 포함된 시스템 메시지를 생성합니다
 */
function createSystemMessageWithRAG(retrievedContext: any): string {
    const baseSystem = `당신은 OpenImjang 부동산 임장 분석 전문 AI 어시스턴트입니다.

**역할과 목표:**
- 사용자의 부동산 투자 및 임장 분석을 도와주는 전문 상담사
- 제공된 컨텍스트 정보를 활용하여 정확하고 개인화된 답변 제공
- 복잡한 부동산 정보를 이해하기 쉽게 설명

**응답 가이드라인:**
- 정확성: 항상 제공된 컨텍스트에 기반하여 응답
- 한국어 사용: 모든 응답은 자연스러운 한국어로 작성
- 구조화된 정보: 복잡한 데이터는 표, 목록, 단계별로 정리
- 실용적 조언: 단순 정보 나열이 아닌 실용적 인사이트 제공

**데이터 해석 가이드:**
- 거래가격은 만원 단위 (30000 = 3억원)
- 임장 메모의 개인적 관찰을 최대한 활용
- 출처를 명확히 표시하여 신뢰성 확보`;

    // 검색된 컨텍스트가 있는 경우 추가
    if (retrievedContext.documents.length > 0) {
        const contextSection = `

**⚠️ 중요: 반드시 아래 참고 문서 내용을 기반으로만 답변하세요. 추측하지 마세요.**

=== 참고 문서 ===
${retrievedContext.documents.map((doc: any, index: number) =>
            `출처${index + 1} (${doc.metadata.schema_name}.${doc.metadata.table_name}):
${doc.content}

---`
        ).join('\n')}

**답변 규칙:**
1. 위 참고 문서에 명시된 정보만 사용하세요
2. 문서에 없는 내용은 "제공된 문서에서 해당 정보를 찾을 수 없습니다"라고 명시하세요
3. 각 정보마다 출처를 명확히 표시하세요 (예: "출처1에 따르면...")`;

        return baseSystem + contextSection;
    }

    return baseSystem;
}

export default aiAskRoute;