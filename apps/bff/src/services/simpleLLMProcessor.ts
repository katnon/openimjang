// apps/bff/src/services/simpleLLMProcessor.ts
import OpenAI from 'openai';
import { db } from '../lib/db';
import { sql } from 'kysely';
import { WebSearchService } from '../utils/webSearchService';

interface UserSession {
  sessionId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  apartmentContext?: {
    apartmentName?: string;
    location?: string;
    clarificationNeeded?: boolean;
  };
  createdAt: number;
  lastActivity: number;
}

interface IntentAnalysis {
  intent: 'apartment_search' | 'price_inquiry' | 'area_inquiry' | 'general' | 'clarification';
  apartmentName?: string;
  location?: string;
  areaSize?: number;
  priceRange?: { min?: number; max?: number };
  confidence: number;
}

interface DatabaseResult {
  success: boolean;
  data?: any[];
  message?: string;
  dataSchema?: Record<string, string>;
}

export class SimpleLLMProcessor {
  private openai: OpenAI;
  private webSearchService: WebSearchService;
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30분

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.webSearchService = new WebSearchService();
    
    // 세션 정리 타이머 설정
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // 5분마다 정리
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        console.log(`🗑️ 세션 만료로 정리: ${sessionId}`);
      }
    }
  }

  private getOrCreateSession(sessionId: string): UserSession {
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      existingSession.lastActivity = Date.now();
      return existingSession;
    }

    const newSession: UserSession = {
      sessionId,
      conversationHistory: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    
    this.sessions.set(sessionId, newSession);
    console.log(`✨ 새 세션 생성: ${sessionId}`);
    return newSession;
  }

  private addToConversationHistory(sessionId: string, role: 'user' | 'assistant', content: string) {
    const session = this.getOrCreateSession(sessionId);
    session.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // 대화 기록이 너무 길어지면 오래된 것부터 제거 (최대 20개 유지)
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }
  }

  private buildConversationContext(session: UserSession): string {
    if (session.conversationHistory.length === 0) {
      return "";
    }

    const recentHistory = session.conversationHistory.slice(-10); // 최근 10개만
    const contextLines = recentHistory.map(msg => {
      const timeStr = new Date(msg.timestamp).toLocaleTimeString('ko-KR');
      return `[${timeStr}] ${msg.role === 'user' ? '사용자' : '어시스턴트'}: ${msg.content}`;
    });

    return `\n\n=== 이전 대화 내용 ===\n${contextLines.join('\n')}\n=== 대화 내용 끝 ===\n`;
  }

  async analyzeUserIntent(userQuery: string, sessionId: string): Promise<IntentAnalysis> {
    const session = this.getOrCreateSession(sessionId);
    const conversationContext = this.buildConversationContext(session);

    const prompt = `
한국 부동산 상담 AI로서 사용자의 의도를 분석해주세요.

${conversationContext}

현재 사용자 질문: "${userQuery}"

다음 중 하나의 의도로 분류하고 정보를 추출해주세요:

1. apartment_search: 특정 아파트 정보 검색
2. price_inquiry: 가격/시세 문의  
3. area_inquiry: 면적별 분석 문의
4. general: 일반적인 부동산 상담
5. clarification: 이전 질문에 대한 명확화 응답

추출할 정보:
- apartmentName: 아파트명 (예: "래미안", "잠실래미안")
- location: 지역명 (예: "잠실", "강남구", "목동")  
- areaSize: 면적 (제곱미터, 예: 84)
- priceRange: 가격대 {min?, max?} (만원 단위)

JSON 형태로 응답:
{
  "intent": "분류된_의도",
  "apartmentName": "아파트명_또는_null",
  "location": "지역명_또는_null", 
  "areaSize": 면적_숫자_또는_null,
  "priceRange": {"min": 최소가격, "max": 최대가격} 또는 null,
  "confidence": 0.0에서_1.0_사이의_신뢰도
}

예시:
- "잠실 래미안 가격 알려줘" → {"intent": "price_inquiry", "apartmentName": "래미안", "location": "잠실", "confidence": 0.9}
- "목동에서 어떤 아파트가 좋아?" → {"intent": "general", "location": "목동", "confidence": 0.8}  
- "84형 시세 어때?" → {"intent": "area_inquiry", "areaSize": 84, "confidence": 0.9}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = response.choices[0].message.content;
      console.log('🧠 Intent Analysis Raw Response:', result);
      
      if (!result) {
        throw new Error('OpenAI 응답이 비어있습니다');
      }

      // JSON 파싱 시도
      let parsedResult: IntentAnalysis;
      try {
        parsedResult = JSON.parse(result);
      } catch (parseError) {
        console.warn('⚠️ Intent Analysis JSON 파싱 실패:', parseError);
        // 기본값으로 fallback
        parsedResult = {
          intent: 'general',
          confidence: 0.5
        };
      }

      console.log('🎯 Intent Analysis Result:', parsedResult);
      return parsedResult;
      
    } catch (error) {
      console.error('❌ Intent Analysis 오류:', error);
      return {
        intent: 'general',
        confidence: 0.3
      };
    }
  }

  async collectDatabaseData(intentAnalysis: IntentAnalysis): Promise<DatabaseResult> {
    const { intent, apartmentName, location, areaSize } = intentAnalysis;

    try {
      if (intent === 'apartment_search' || intent === 'price_inquiry') {
        if (apartmentName || location) {
          return await this.searchApartmentData(apartmentName, location);
        }
      }

      if (intent === 'area_inquiry' && areaSize) {
        return await this.searchByArea(areaSize, location);
      }

      if (intent === 'general' && location) {
        return await this.searchLocationData(location);
      }

      return {
        success: false,
        message: `${intent} 의도에 대한 충분한 검색 조건이 없습니다.`
      };

    } catch (error) {
      console.error('❌ Database Query 오류:', error);
      return {
        success: false,
        message: '데이터베이스 조회 중 오류가 발생했습니다.'
      };
    }
  }

  private async searchApartmentData(apartmentName?: string, location?: string): Promise<DatabaseResult> {
    let query = sql`
      SELECT 
        ai.apt_nm,
        ai.jibun_address,
        ada.deal_amount,
        ada.exclu_use_ar,
        ada.deal_year,
        ada.deal_month,
        ada.floor,
        ada.deposit,
        ada.monthly_rent
      FROM oi.apt_info ai
      JOIN oi.apt_deal_all ada ON ai.jibun_address = ada.jibun_address
      WHERE ai.jibun_address ILIKE '%서울%'
    `;

    if (apartmentName) {
      query = query.where('ai.apt_nm', 'ilike', `%${apartmentName}%`);
    }

    if (location) {
      query = query.where('ai.jibun_address', 'ilike', `%${location}%`);
    }

    query = query
      .orderBy(['ada.deal_year', 'ada.deal_month'], 'desc')
      .limit(20);

    const result = await query.execute(db);

    return {
      success: result.length > 0,
      data: result,
      dataSchema: {
        apt_nm: "아파트명",
        jibun_address: "지번주소", 
        deal_amount: "매매가 (만원 단위, 예: 30000 = 3억원)",
        exclu_use_ar: "전용면적 (제곱미터)",
        deal_year: "거래년도",
        deal_month: "거래월",
        floor: "층수",
        deposit: "보증금 (만원 단위)",
        monthly_rent: "월세 (만원 단위)"
      },
      message: result.length > 0 ? 
        `${apartmentName || ''}${location || ''} 관련 ${result.length}건의 거래 정보를 찾았습니다.` :
        `${apartmentName || ''}${location || ''} 관련 거래 정보를 찾을 수 없습니다.`
    };
  }

  private async searchByArea(areaSize: number, location?: string): Promise<DatabaseResult> {
    // ±1㎡ 허용 오차 적용
    const minArea = areaSize - 1;
    const maxArea = areaSize + 1;

    let query = sql`
      SELECT 
        apt_nm,
        jibun_address,
        deal_amount,
        exclu_use_ar,
        deal_year,
        deal_month,
        COUNT(*) OVER () as total_count
      FROM oi.apt_deal_all
      WHERE jibun_address ILIKE '%서울%'
        AND exclu_use_ar BETWEEN ${minArea} AND ${maxArea}
    `;

    if (location) {
      query = query.where('jibun_address', 'ilike', `%${location}%`);
    }

    query = query
      .orderBy(['deal_year', 'deal_month'], 'desc')
      .limit(20);

    const result = await query.execute(db);

    return {
      success: result.length > 0,
      data: result,
      dataSchema: {
        apt_nm: "아파트명",
        jibun_address: "지번주소",
        deal_amount: "매매가 (만원 단위, 예: 30000 = 3억원)", 
        exclu_use_ar: "전용면적 (제곱미터)",
        deal_year: "거래년도",
        deal_month: "거래월"
      },
      message: result.length > 0 ? 
        `${areaSize}㎡ (±1㎡ 범위) 관련 ${result.length}건의 거래 정보를 찾았습니다.` :
        `${areaSize}㎡ 관련 거래 정보를 찾을 수 없습니다.`
    };
  }

  private async searchLocationData(location: string): Promise<DatabaseResult> {
    const query = sql`
      SELECT 
        apt_nm,
        jibun_address,
        AVG(deal_amount) as avg_price,
        COUNT(*) as trade_count,
        MIN(exclu_use_ar) as min_area,
        MAX(exclu_use_ar) as max_area
      FROM oi.apt_deal_all
      WHERE jibun_address ILIKE '%서울%'
        AND jibun_address ILIKE ${`%${location}%`}
        AND deal_year >= 2023
      GROUP BY apt_nm, jibun_address
      ORDER BY trade_count DESC
      LIMIT 15
    `;

    const result = await query.execute(db);

    return {
      success: result.length > 0,
      data: result,
      dataSchema: {
        apt_nm: "아파트명",
        jibun_address: "지번주소",
        avg_price: "평균 매매가 (만원 단위, 예: 30000 = 3억원)",
        trade_count: "거래 건수",
        min_area: "최소 면적 (제곱미터)",
        max_area: "최대 면적 (제곱미터)"
      },
      message: result.length > 0 ? 
        `${location} 지역의 ${result.length}개 아파트 정보를 찾았습니다.` :
        `${location} 지역의 아파트 정보를 찾을 수 없습니다.`
    };
  }

  shouldUseWebSearch(intentAnalysis: IntentAnalysis, databaseResult: DatabaseResult): boolean {
    // 데이터베이스에서 충분한 결과를 얻었다면 웹 검색 불필요
    if (databaseResult.success && databaseResult.data && databaseResult.data.length >= 5) {
      return false;
    }

    // general 의도이거나 위치 정보가 있다면 웹 검색 활용
    if (intentAnalysis.intent === 'general' || intentAnalysis.location) {
      return true;
    }

    // 데이터가 부족하고 아파트명이나 위치가 있다면 웹 검색
    if (!databaseResult.success && (intentAnalysis.apartmentName || intentAnalysis.location)) {
      return true;
    }

    return false;
  }

  async generateResponse(
    userQuery: string,
    sessionId: string,
    intentAnalysis: IntentAnalysis,
    databaseResult: DatabaseResult,
    webSearchResult?: any
  ): Promise<string> {
    const session = this.getOrCreateSession(sessionId);
    const conversationContext = this.buildConversationContext(session);

    // Few-shot 학습 예시들
    const fewShotExamples = `
=== Few-shot 학습 예시 ===

예시 1 - 아파트 검색:
사용자: "잠실 래미안 가격 알려줘"
어시스턴트: "잠실 래미안의 최근 거래 정보를 확인해드릴게요. 2024년 기준으로 84㎡는 약 13억~15억원대에 거래되고 있습니다."

예시 2 - 면적별 분석: 
사용자: "84형 시세 어때?"
어시스턴트: "84㎡ 아파트의 서울 평균 시세를 알려드릴게요. 지역별로 차이가 있지만 강남권은 15억~20억, 강북권은 8억~12억원대입니다."

예시 3 - 유연한 대안 제시:
사용자: "200형 있어?"
어시스턴트: "200㎡ 이상의 대형 평형은 흔하지 않습니다. 혹시 가장 큰 평형대를 찾으시는 걸까요? 해당 단지에서 가장 큰 타입은 114㎡로 최근 거래가는 12억원입니다."

예시 4 - 지역별 추천:
사용자: "목동에서 어떤 아파트가 좋아?"
어시스턴트: "목동은 교육환경이 좋은 지역이죠. 주요 아파트로는 목동아파트(리모델링), 월드컵파크, 롯데캐슬이 인기가 높습니다."

=== Few-shot 예시 끝 ===
`;

    const prompt = `
당신은 친근한 한국 부동산 상담 전문가입니다. 사용자의 질문에 자연스럽고 도움이 되는 답변을 해주세요.

${fewShotExamples}

${conversationContext}

현재 사용자 질문: "${userQuery}"

의도 분석 결과: ${JSON.stringify(intentAnalysis)}

데이터베이스 조회 결과:
${databaseResult.success ? 
  `성공 - ${databaseResult.data?.length || 0}건의 데이터\n데이터 스키마: ${JSON.stringify(databaseResult.dataSchema)}\n실제 데이터: ${JSON.stringify(databaseResult.data?.slice(0, 3))}` :
  `실패 - ${databaseResult.message}`
}

${webSearchResult ? `\n웹 검색 결과:\n${JSON.stringify(webSearchResult)}` : ''}

답변 가이드라인:
1. 항상 친근하고 전문적인 톤 유지
2. 구체적인 숫자와 데이터 활용 (예: "84㎡ 13억원")
3. 데이터가 부족할 때는 유연한 대안 제시
4. "정보가 없습니다" 같은 딱딱한 표현 금지
5. 사용자의 숨겨진 의도 파악하여 도움되는 정보 제공
6. 필요시 명확화 질문으로 대화 이어가기

답변을 250자 이내로 자연스럽게 작성해주세요.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const result = response.choices[0].message.content || "죄송합니다. 응답을 생성할 수 없습니다.";
      
      // 대화 기록에 추가
      this.addToConversationHistory(sessionId, 'user', userQuery);
      this.addToConversationHistory(sessionId, 'assistant', result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Response Generation 오류:', error);
      return "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
  }

  async processUserQuery(userQuery: string, sessionId: string): Promise<string> {
    console.log(`\n🚀 === SimpleLLMProcessor 시작 ===`);
    console.log(`👤 사용자 질문: "${userQuery}"`);
    console.log(`🔑 세션 ID: ${sessionId}`);

    try {
      // 1단계: 의도 분석
      console.log('\n📊 1단계: 사용자 의도 분석 중...');
      const intentAnalysis = await this.analyzeUserIntent(userQuery, sessionId);
      console.log('🎯 의도 분석 완료:', intentAnalysis);

      // 2단계: 데이터베이스 조회
      console.log('\n💾 2단계: 데이터베이스 조회 중...');
      const databaseResult = await this.collectDatabaseData(intentAnalysis);
      console.log('📈 DB 조회 완료:', {
        success: databaseResult.success,
        dataCount: databaseResult.data?.length || 0,
        message: databaseResult.message
      });

      // 3단계: 웹 검색 필요성 판단
      let webSearchResult;
      if (this.shouldUseWebSearch(intentAnalysis, databaseResult)) {
        console.log('\n🌐 3단계: 웹 검색 실행 중...');
        try {
          const searchQuery = `${intentAnalysis.apartmentName || ''} ${intentAnalysis.location || ''} 아파트 시세`.trim();
          webSearchResult = await this.webSearchService.search(searchQuery);
          console.log('🔍 웹 검색 완료:', webSearchResult ? '성공' : '실패');
        } catch (searchError) {
          console.warn('⚠️ 웹 검색 실패:', searchError);
        }
      } else {
        console.log('\n🔍 3단계: 웹 검색 불필요 (충분한 DB 데이터 확보)');
      }

      // 4단계: 응답 생성
      console.log('\n🤖 4단계: AI 응답 생성 중...');
      const response = await this.generateResponse(
        userQuery,
        sessionId,
        intentAnalysis,
        databaseResult,
        webSearchResult
      );

      console.log('✅ 응답 생성 완료');
      console.log('📝 최종 응답:', response);
      console.log(`\n🏁 === SimpleLLMProcessor 완료 ===\n`);

      return response;

    } catch (error) {
      console.error('❌ SimpleLLMProcessor 전체 오류:', error);
      return "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
  }

  // 세션 정보 조회 (디버깅용)
  getSessionInfo(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      conversationCount: session.conversationHistory.length,
      apartmentContext: session.apartmentContext,
      createdAt: new Date(session.createdAt).toLocaleString('ko-KR'),
      lastActivity: new Date(session.lastActivity).toLocaleString('ko-KR'),
    };
  }

  // 전체 세션 개수 조회
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}