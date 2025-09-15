// 단순하고 직관적인 제너럴 LLM 기반 부동산 질의응답 시스템

import OpenAI from 'openai';
import { ConversationSession } from './conversationSession';

// 기존 데이터 핸들러들 유지
import { searchRealEstateDeals } from '../ai/handlers/searchRealEstateDeals';
import { getBuildingInfo } from '../ai/handlers/getBuildingInfo';
import { searchNearbyPOI } from '../ai/handlers/searchNearbyPOI';

// 웹 검색 서비스 추가
import { WebSearchService, WebSearchResponse } from '../utils/webSearchService';

export interface SimpleProcessResult {
  reply: string;
  needsMoreInfo: boolean;
  suggestedQuestions?: string[];
  dataUsed?: any;
}

/**
 * 단순하고 효과적인 LLM 기반 처리기
 * 복잡한 규칙 대신 제너럴 LLM이 자연스럽게 의도를 파악하고 응답
 */
export class SimpleLLMProcessor {
  private openai: OpenAI;
  private session: ConversationSession;
  private webSearchService: WebSearchService;

  constructor(session: ConversationSession, apiKey: string) {
    this.session = session;
    this.openai = new OpenAI({ apiKey });
    this.webSearchService = new WebSearchService();
  }

  /**
   * 메인 처리 함수: 사용자 질문을 이해하고 최선의 답변 제공
   */
  async processUserQuery(userMessage: string): Promise<SimpleProcessResult> {
    console.log(`🧠 Simple LLM 처리 시작: "${userMessage.substring(0, 50)}..."`);

    try {
      // 1. LLM에게 질문 의도 파악 및 필요한 액션 결정 요청
      const intentAndAction = await this.analyzeIntentAndDecideAction(userMessage);
      console.log(`🎯 LLM 분석 결과:`, intentAndAction);

      // 2. 필요한 데이터 수집 (LLM이 요청한 액션 기반)
      const collectedData = await this.collectRelevantData(intentAndAction, userMessage);
      
      // 3. 수집된 데이터와 함께 최종 응답 생성
      const finalResponse = await this.generateFinalResponse(userMessage, collectedData, intentAndAction);
      
      return finalResponse;
      
    } catch (error) {
      console.error('Simple LLM 처리 오류:', error);
      return {
        reply: "죄송합니다. 처리 중 문제가 발생했습니다. 다시 시도해 주세요.",
        needsMoreInfo: false
      };
    }
  }

  /**
   * LLM이 사용자 질문을 분석하고 필요한 액션을 결정
   */
  private async analyzeIntentAndDecideAction(userMessage: string): Promise<any> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `한국 부동산 전문 AI입니다. 사용자 질문을 분석해주세요.

## 액션:
- searchDeals: 실거래가 검색
- getBuildingInfo: 아파트 정보
- searchPOI: 주변 시설
- general: 일반 상담

## 도메인 지식:
지역: 잠실=송파구, 강남=강남구, 서초=서초구, 역삼=강남구, 홍대=마포구
브랜드: 래미안→삼성래미안/래미안월곡, 힐스테이트, 아이파크→삼성아이파크, 푸르지오, 자이→GS자이
면적: 59형=59㎡, 74형=74㎡, 84형=84㎡, 100형=100㎡, 120형=120㎡, 124형=124㎡
애매브랜드(지역필수): 현대, 자이, 삼성, SK, 대림
특정브랜드(이름만으로식별): 아크로리버파크→반포동, 헬리오시티→송도, 롯데캐슬골드

## 예시:
1. "잠실 래미안 84형 매매가" → region="잠실", apartmentName="래미안", area=84, dealType="매매", actions=["searchDeals"]
2. "강남 현대아파트 100형 전세" → region="강남", apartmentName="현대", area=100, dealType="전세", actions=["searchDeals"] 
3. "헬리오시티 120형 매매" → region=null, apartmentName="헬리오시티", area=120, dealType="매매", actions=["searchDeals"]
4. "자이 84형 월세" → region=null, apartmentName="자이", area=84, dealType="월세", hasEnoughInfo=false (지역필요)

JSON 응답:
{
  "intent": "의도",
  "confidence": 0.8,
  "extractedInfo": {
    "apartmentName": "브랜드명",
    "region": "지역명",
    "dealType": "매매/전세/월세",
    "area": "면적(㎡)"
  },
  "suggestedActions": ["액션"],
  "hasEnoughInfo": true/false,
  "reasoning": "근거"
}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.3
    });

    const result = completion.choices[0].message.content;
    try {
      return JSON.parse(result || '{}');
    } catch {
      return { intent: "일반 상담", hasEnoughInfo: false, suggestedActions: ["general"] };
    }
  }

  /**
   * 필요한 데이터 수집
   */
  private async collectRelevantData(intentAnalysis: any, userMessage: string): Promise<any> {
    const data: any = { sources: [] };

    console.log(`📊 Simple AI 데이터 수집 시작:`, intentAnalysis);

    for (const action of intentAnalysis.suggestedActions || []) {
      try {
        switch (action) {
          case 'searchDeals':
            if (intentAnalysis.extractedInfo?.region || intentAnalysis.extractedInfo?.apartmentName) {
              console.log('🔍 실거래가 검색 실행:', {
                apartmentName: intentAnalysis.extractedInfo?.apartmentName,
                region: intentAnalysis.extractedInfo?.region,
                dealType: intentAnalysis.extractedInfo?.dealType,
                area: intentAnalysis.extractedInfo?.area
              });
              const deals = await searchRealEstateDeals({
                apartmentName: intentAnalysis.extractedInfo?.apartmentName,
                region: intentAnalysis.extractedInfo?.region,
                dealType: intentAnalysis.extractedInfo?.dealType,
                area: intentAnalysis.extractedInfo?.area
              });
              console.log('📈 실거래가 검색 결과:', deals ? `${deals.length || 0}건` : '결과 없음');
              data.deals = deals;
              data.sources.push('실거래가 데이터');
            } else {
              console.log('⚠️ 실거래가 검색 건너뜀 - 지역/아파트명 정보 부족');
            }
            break;

          case 'getBuildingInfo':
            if (intentAnalysis.extractedInfo?.apartmentName) {
              console.log('🏢 건물 정보 검색 중...');
              const buildingInfo = await getBuildingInfo(intentAnalysis.extractedInfo.apartmentName);
              data.buildingInfo = buildingInfo;
              data.sources.push('건물 정보');
            }
            break;

          case 'searchPOI':
            if (intentAnalysis.extractedInfo?.region || intentAnalysis.extractedInfo?.apartmentName) {
              console.log('📍 주변 시설 검색 중...');
              const poi = await searchNearbyPOI({
                apartmentName: intentAnalysis.extractedInfo?.apartmentName,
                region: intentAnalysis.extractedInfo?.region
              });
              data.poi = poi;
              data.sources.push('주변 시설 정보');
            }
            break;
        }
      } catch (error) {
        console.warn(`액션 ${action} 실행 중 오류:`, error);
      }
    }

    // 웹 검색 통합: 내부 데이터가 부족하거나 general 케이스인 경우
    const shouldPerformWebSearch = this.shouldUseWebSearch(intentAnalysis, data, userMessage);
    
    if (shouldPerformWebSearch) {
      try {
        console.log('🌐 웹 검색 수행 결정됨');
        
        // 인코딩 문제 해결을 위해 의도 분석 결과로 더 나은 검색 쿼리 생성
        const enhancedQuery = this.generateWebSearchQuery(intentAnalysis, userMessage);
        console.log(`🔍 웹 검색 쿼리 생성: "${enhancedQuery}"`);
        
        const webSearchResult = await this.webSearchService.searchRealEstate(enhancedQuery);
        
        if (webSearchResult.results.length > 0) {
          data.webSearch = webSearchResult;
          data.sources.push('웹 검색 정보');
          console.log(`✅ 웹 검색 완료: ${webSearchResult.results.length}건`);
        } else {
          console.log('⚠️ 웹 검색 결과 없음');
        }
      } catch (error) {
        console.warn('웹 검색 실행 중 오류:', error);
      }
    } else {
      console.log('ℹ️ 웹 검색 건너뜀 - 충분한 내부 데이터 확보');
    }

    return data;
  }

  /**
   * 웹 검색 수행 여부 결정 로직
   */
  private shouldUseWebSearch(intentAnalysis: any, collectedData: any, userMessage: string): boolean {
    // 1. General 액션이 포함된 경우 - 웹 검색 적극 활용
    const hasGeneralAction = intentAnalysis.suggestedActions?.includes('general');
    if (hasGeneralAction) {
      console.log('🔍 웹 검색 필요: General 액션 감지');
      return true;
    }

    // 2. 의도 분석이 충분하지 않은 경우
    if (!intentAnalysis.hasEnoughInfo) {
      console.log('🔍 웹 검색 필요: 의도 분석 정보 부족');
      return true;
    }

    // 3. 내부 데이터 소스가 부족한 경우 (1개 이하)
    const internalSources = collectedData.sources?.length || 0;
    if (internalSources <= 1) {
      console.log(`🔍 웹 검색 필요: 내부 데이터 부족 (${internalSources}개)`);
      return true;
    }

    // 4. 특정 패턴의 질문 감지 - "어떤", "추천", "좋은" 등
    const consultationPatterns = [
      /어떤.*아파트.*좋을까/,
      /추천.*아파트/,
      /좋은.*아파트/,
      /어디.*살까/,
      /투자.*어디/,
      /지역.*추천/
    ];
    
    const isConsultationQuery = consultationPatterns.some(pattern => 
      pattern.test(userMessage)
    );
    
    if (isConsultationQuery) {
      console.log('🔍 웹 검색 필요: 상담형 질문 패턴 감지');
      return true;
    }

    // 5. 의도 분석 자체가 실패한 경우 (빈 객체 등)
    if (!intentAnalysis.intent || Object.keys(intentAnalysis).length < 3) {
      console.log('🔍 웹 검색 필요: 의도 분석 실패 감지');
      return true;
    }

    return false;
  }

  /**
   * 웹 검색용 쿼리 생성 - 인코딩 문제 해결 및 의도 기반 쿼리 개선
   */
  private generateWebSearchQuery(intentAnalysis: any, originalMessage: string): string {
    const extracted = intentAnalysis.extractedInfo || {};
    
    // 의도 분석에서 추출된 정보가 충분한 경우 이를 활용
    if (extracted.region || extracted.apartmentName || extracted.area || extracted.dealType) {
      const queryParts: string[] = [];
      
      if (extracted.region) {
        queryParts.push(extracted.region);
      }
      
      if (extracted.apartmentName && extracted.apartmentName !== "브랜드명") {
        queryParts.push(extracted.apartmentName);
      }
      
      if (extracted.area) {
        queryParts.push(`${extracted.area}형`);
      }
      
      if (extracted.dealType) {
        queryParts.push(extracted.dealType);
      }
      
      // 기본 키워드 추가
      if (queryParts.length > 0) {
        queryParts.push('아파트');
        const generatedQuery = queryParts.join(' ');
        console.log(`🔧 의도 기반 쿼리 생성: "${generatedQuery}"`);
        return generatedQuery;
      }
    }
    
    // 패턴 매칭으로 일반적인 쿼리 생성 (인코딩 문제 회피)
    const intent = intentAnalysis.intent || '';
    const hasGeneral = intentAnalysis.suggestedActions?.includes('general');
    
    if (hasGeneral || intent.includes('일반')) {
      // "어떤 아파트가 좋을까" 패턴 처리
      if (originalMessage.includes('어떤') || originalMessage.includes('좋을까') || originalMessage.includes('추천')) {
        if (extracted.region) {
          return `${extracted.region} 추천 아파트 좋은 단지`;
        }
        return '서울 추천 아파트 좋은 단지 인기 브랜드';
      }
    }
    
    // 구체적 질문 패턴 처리
    if (originalMessage.includes('매매가') || originalMessage.includes('매매')) {
      const baseQuery = '아파트 매매가 시세 정보';
      if (extracted.region) {
        return `${extracted.region} ${baseQuery}`;
      }
      return baseQuery;
    }
    
    if (originalMessage.includes('전세')) {
      const baseQuery = '아파트 전세가 시세 정보';
      if (extracted.region) {
        return `${extracted.region} ${baseQuery}`;
      }
      return baseQuery;
    }
    
    // 기본 대안 쿼리
    console.log(`⚠️ 패턴 매칭 실패, 기본 쿼리 사용`);
    return '서울 아파트 부동산 시세 정보';
  }

  /**
   * 최종 응답 생성 - LLM이 자연스럽고 유용한 답변 작성
   */
  private async generateFinalResponse(
    userMessage: string, 
    collectedData: any, 
    intentAnalysis: any
  ): Promise<SimpleProcessResult> {
    
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 친근하고 전문적인 부동산 컨설턴트입니다. 

핵심 원칙:
1. 항상 도움이 되는 정보를 우선 제공하세요
2. 정보가 부족하거나 정확한 매칭이 없어도 "정보가 없다"고 하지 말고, 적극적으로 대안을 제시하세요:
   - 비현실적 면적(200형 등) → "가장 큰 타입인 124형은 어떠세요?"
   - 지역 없는 브랜드 → "여러 지역에 있는데, 인기 지역 기준으로는..."  
   - 브랜드 없는 지역 → "그 지역 인기 브랜드로는 래미안, 자이 등이..."
   - 존재하지 않는 조합 → "그 조합은 없지만 비슷한 대안으로는..."
   - 애매한 정보 → 현재 가능한 정보를 최대한 활용해서 도움이 되는 답변
3. 추가 질문은 정보 제공 후에 자연스럽게 유도하세요
4. 구체적인 데이터가 있으면 활용하고, 없어도 경험과 일반적인 지식으로 도움을 주세요

데이터 소스 활용 가이드:
- **실거래가 데이터**: dealamount는 만원 단위 (30000 = 3억원), area는 제곱미터 단위
- **웹 검색 정보**: 최신 시장 동향, 일반적인 부동산 지식, 지역별 특성 등 보완 정보로 활용
- **내부 DB + 웹 검색 결합**: 두 소스를 종합해서 더 풍부하고 정확한 답변 제공

정보 소스별 활용 방법:
- 내부 실거래가 데이터가 있으면 구체적인 수치 우선 제공
- 웹 검색 정보는 맥락과 보완 설명으로 활용
- 두 소스가 모두 있으면 실거래가는 구체적 수치로, 웹 검색은 시장 해석으로 활용

응답 스타일:
- 자연스럽고 대화하는 느낌
- 핵심 정보를 먼저, 부가 설명은 나중에  
- 정보 출처를 자연스럽게 언급 (예: "최신 거래 현황에 따르면..." / "일반적으로 이 지역은...")
- "더 궁금한 점이 있으시면..." 식으로 자연스럽게 추가 질문 유도`
        },
        {
          role: "user",
          content: `사용자 질문: "${userMessage}"

분석 결과: ${JSON.stringify(intentAnalysis)}

수집된 데이터: ${JSON.stringify(collectedData, null, 2)}

위 정보를 바탕으로 사용자에게 도움이 되는 응답을 작성해주세요. 정보가 부분적이라도 최대한 활용해서 유용한 답변을 만들어주세요.`
        }
      ],
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content || "죄송합니다. 답변을 생성할 수 없습니다.";
    
    // 간단한 후속 질문 제안
    const suggestedQuestions = this.generateSuggestedQuestions(intentAnalysis, collectedData);
    
    return {
      reply,
      needsMoreInfo: !intentAnalysis.hasEnoughInfo,
      suggestedQuestions,
      dataUsed: collectedData.sources
    };
  }

  /**
   * 상황에 맞는 후속 질문 제안
   */
  private generateSuggestedQuestions(intentAnalysis: any, collectedData: any): string[] {
    const suggestions: string[] = [];
    
    if (collectedData.deals && collectedData.deals.length > 0) {
      suggestions.push("이 지역의 시세 변화 추이가 궁금하신가요?");
      suggestions.push("주변 다른 아파트와 비교해 보시겠어요?");
    }
    
    if (intentAnalysis.extractedInfo?.region) {
      suggestions.push("이 지역의 개발 계획이나 투자 전망은 어떤가요?");
      suggestions.push("주변 편의시설이나 교통편도 확인해보시겠어요?");
    }
    
    if (!intentAnalysis.extractedInfo?.apartmentName && intentAnalysis.extractedInfo?.region) {
      suggestions.push("특정 아파트 단지가 있으시면 더 정확한 정보를 드릴 수 있어요");
    }
    
    return suggestions.slice(0, 2); // 최대 2개만
  }
}