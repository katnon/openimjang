// LLM 기반 의도 분석기 - 규칙 기반 시스템 완전 대체
import OpenAI from 'openai';
import { ConversationSlots } from '../types/slots';
import { PlanContext } from './types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 4o-mini가 모든 분석을 담당하는 통합 분석기
 */
export async function analyzewithLLM(
    userMessage: string, 
    currentSlots: ConversationSlots,
    userProfile?: any,
    sessionHistory?: any[]
): Promise<{
    intent: {
        category: string;
        subcategory: string;
        confidence: number;
        actions: string[];
        reasoning: string;
    };
    slots: Partial<ConversationSlots>;
    recommendedActions: string[];
}> {
    try {
        // 현재 상황과 사용 가능한 도구들에 대한 컨텍스트
        const availableTools = [
            "searchRealEstate - 아파트 실거래 데이터 검색 (매매/전세/월세)",
            "searchNearbyPOI - 카카오 Local API를 통한 주변 편의시설 검색 (학교/병원/마트/지하철/전체)",
            "getBuildingInfo - 건물 기본 정보 및 메타데이터 조회", 
            "getPriceTrends - 시계열 가격 트렌드 분석",
            "getDealStatsSummary - 거래량/평균가격 등 통계 요약",
            "generateSelectQuery - RAG 기반 자연어→SQL 쿼리 생성",
            "executeQuery - PostgreSQL 직접 쿼리 실행"
        ];

        // 데이터베이스 스키마 정보 (RAG 지원)
        const databaseSchema = `
**핵심 테이블 구조:**

1. oi.apt_info (아파트 기본정보)
   - id: 아파트 고유 식별자
   - apt_nm: 아파트명 (검색용)
   - jibun_address: 지번 주소
   - lat, lon: 위도, 경도 (POI 검색에 필수)

2. oi.apt_deal_all (통합 거래데이터)
   - apt_nm: 아파트명
   - deal_amount: 매매가 (만원, 30000=3억원)
   - deposit: 보증금 (만원)
   - monthly_rent: 월세 (만원) 
   - exclu_use_ar: 전용면적 (㎡)
   - floor: 층수
   - deal_year, deal_month, deal_day: 거래일

3. 거래 유형 판별 규칙:
   - deal_amount 존재 = 매매
   - deal_amount 없음 + monthly_rent=0 = 전세  
   - deal_amount 없음 + monthly_rent>0 = 월세

**자연어 처리 가이드:**
- "최근 3개월" → MAKE_DATE() >= CURRENT_DATE - INTERVAL '3 months'
- "마곡엠밸리" → apt_nm ILIKE '%마곡엠밸리%'
- "@아파트명" → 해당 아파트의 정보 추출 후 컨텍스트 저장
`;

        const systemPrompt = `당신은 부동산 임장 도우미의 AI 분석 엔진입니다.

사용자의 질문을 분석하여 다음을 JSON 형태로 정확히 출력하세요:

**사용 가능한 도구들:**
${availableTools.join('\n')}

${databaseSchema}

**POI 검색 세부사항:**
- 유형: 학교, 병원, 마트, 지하철, 버스정류장, 공원, 편의점, 은행, 전체
- 반드시 lat, lng 좌표 필요 (아파트 메타데이터 활용)
- 반경: 기본 1000m (사용자 요청 시 조정 가능)

**실거래 검색 세부사항:**
- apartmentName 또는 aptId 중 하나 필수
- dealType: 매매/전세/월세/전체
- period: "3개월", "6개월", "1년" 등
- 가격 단위: 만원 (30000 = 3억원)

**현재 슬롯 정보:**
${JSON.stringify(currentSlots, null, 2)}

**사용자 프로필:**
${JSON.stringify(userProfile, null, 2)}

**분석 결과 JSON 형식:**
\`\`\`json
{
  "intent": {
    "category": "search|analysis|comparison|recommendation|general",
    "subcategory": "poi_search|price_search|apartment_search|trend_analysis|etc",
    "confidence": 0.95,
    "actions": ["searchNearbyPOI", "searchRealEstate"],
    "reasoning": "사용자가 @아파트명과 함께 주변정보를 요청했으므로 POI 검색이 필요"
  },
  "slots": {
    "apartmentName": "추출된 아파트명",
    "apartmentMetadata": { "lat": 37.123, "lng": 127.456 },
    "dealType": "매매|전세|월세",
    "region": "지역명"
  },
  "recommendedActions": ["searchNearbyPOI"]
}
\`\`\`

**중요 규칙:**
1. @mention 패턴 ("@삼성", "@마곡엠밸리" 등) → apartmentName 슬롯에 저장 + getBuildingInfo 액션
2. "주변", "편의시설", "POI", "학교", "병원", "마트" → searchNearbyPOI 액션 (좌표 필수)
3. "가격", "실거래", "매매", "전세", "월세" → searchRealEstate 액션 
4. "최근", "3개월", "6개월" → period 슬롯에 저장
5. "트렌드", "분석", "통계" → getPriceTrends 또는 getDealStatsSummary 액션
6. 기존 슬롯의 아파트 정보(이름, 좌표 등)를 최대한 재활용
7. confidence는 0.8 이상으로 설정 (확실한 의도만 처리)
8. 복합 질문의 경우 여러 액션을 추천 가능

**액션 추천 우선순위:**
- @mention → getBuildingInfo (아파트 기본정보 로드)
- 아파트 정보 + "주변" → searchNearbyPOI  
- 아파트 정보 + "가격" → searchRealEstate
- 복잡한 질문 → generateSelectQuery (RAG 활용)

오직 JSON만 출력하세요. 다른 설명은 하지 마세요.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { 
                    role: "user", 
                    content: `분석할 질문: "${userMessage}"\n\n현재 세션 기록: ${sessionHistory?.length || 0}개 메시지` 
                }
            ],
            max_tokens: 800,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const result = completion.choices[0]?.message?.content;
        if (!result) {
            throw new Error('LLM 응답이 비어있습니다');
        }

        // JSON 파싱
        let analysis;
        try {
            analysis = JSON.parse(result);
        } catch (parseError) {
            console.error('❌ LLM JSON 파싱 오류:', parseError, result);
            throw new Error('LLM 응답 형식 오류');
        }

        console.log('🧠 LLM 분석 완료:', {
            intent: analysis.intent?.category,
            confidence: analysis.intent?.confidence,
            extractedSlots: Object.keys(analysis.slots || {}),
            recommendedActions: analysis.recommendedActions
        });

        return {
            intent: {
                category: analysis.intent?.category || 'general',
                subcategory: analysis.intent?.subcategory || '',
                confidence: analysis.intent?.confidence || 0.5,
                actions: analysis.recommendedActions || [],
                reasoning: analysis.intent?.reasoning || ''
            },
            slots: analysis.slots || {},
            recommendedActions: analysis.recommendedActions || []
        };

    } catch (error: any) {
        console.error('❌ LLM 분석 오류:', error.message);
        
        // 폴백: 기본 분석 결과 반환
        return {
            intent: {
                category: 'general',
                subcategory: '',
                confidence: 0.3,
                actions: [],
                reasoning: `LLM 분석 실패: ${error.message}`
            },
            slots: {},
            recommendedActions: []
        };
    }
}

/**
 * 슬롯 병합 (LLM이 추출한 슬롯과 기존 슬롯 결합)
 */
export function mergeLLMSlots(
    currentSlots: ConversationSlots, 
    llmSlots: Partial<ConversationSlots>
): ConversationSlots {
    const merged = { ...currentSlots };
    
    // LLM이 추출한 슬롯들을 우선하여 병합
    for (const [key, value] of Object.entries(llmSlots)) {
        if (value !== null && value !== undefined && value !== '') {
            (merged as any)[key] = value;
        }
    }
    
    return merged;
}