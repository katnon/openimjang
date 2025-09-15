// 🧠 OpenImjang AI 3.0 - 멀티턴 대화 관리자
// 여러 질문에 걸친 복합적 요청 처리와 대화 히스토리 기반 지능형 추천 시스템
// 기반 이론: Dialog State Tracking (Cambridge 2013) + Multi-turn Dialogue Systems (Google 2020)

import OpenAI from 'openai';

export interface ConversationTurn {
  turnId: string;
  timestamp: Date;
  userInput: string;
  systemResponse: string;
  intent: string;
  extractedEntities: Record<string, any>;
  contextCarryover: Record<string, any>; // 다음 턴으로 전달할 컨텍스트
  satisfaction: number; // 0-1 사이 만족도
}

export interface DialogueContext {
  conversationId: string;
  turns: ConversationTurn[];
  cumulativeContext: Record<string, any>; // 누적된 컨텍스트
  unresolvedQueries: string[]; // 아직 해결되지 않은 질문들
  implicitRequests: string[]; // 암시적으로 요청된 것들
  conversationGoal: string | null; // 대화의 궁극적 목표
}

export interface ContextualRecommendation {
  type: 'follow_up' | 'related_topic' | 'completion' | 'clarification';
  recommendation: string;
  reasoning: string;
  priority: number; // 1-10 사이
  relatedTurns: string[]; // 관련된 대화 턴들
  expectedUserValue: string; // 사용자에게 제공할 가치
}

export interface ConversationFlow {
  currentPhase: 'opening' | 'exploration' | 'deepening' | 'resolution' | 'closing';
  phaseProgress: number; // 0-1 사이
  naturalTransitions: string[]; // 자연스러운 다음 전환 옵션들
  conversationMomentum: 'building' | 'stable' | 'declining';
}

/**
 * 🧠 멀티턴 대화 관리자
 * 
 * 기반 이론:
 * - Dialog State Tracking: 대화 상태의 지속적 추적 (Cambridge University, 2013)
 * - Multi-turn Dialogue Systems: 장기 대화에서의 일관성 유지 (Google Research, 2020)
 * - Contextual Memory Networks: 대화 기억과 컨텍스트 관리 (Facebook AI, 2018)
 * - Conversational Recommender Systems: 대화형 추천 시스템 (RecSys 2019)
 */
export class MultiTurnConversationManager {
  private openai: OpenAI;
  private dialogueContext: DialogueContext;
  private conversationFlow: ConversationFlow;
  private contextMemoryDepth: number = 10; // 최대 몇 개 턴까지 기억할지
  private entityPersistence: Record<string, any> = {}; // 지속되는 엔티티들

  constructor(openaiInstanceOrApiKey?: OpenAI | string, conversationId?: string) {
    if (openaiInstanceOrApiKey instanceof OpenAI) {
      this.openai = openaiInstanceOrApiKey;
    } else {
      // API 키 명시적 전달 또는 환경변수 사용
      const apiKey = openaiInstanceOrApiKey || process.env.OPENAI_API_KEY;
      
      this.openai = new OpenAI({
        apiKey: apiKey!
      });
    }

    this.dialogueContext = {
      conversationId: conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      turns: [],
      cumulativeContext: {},
      unresolvedQueries: [],
      implicitRequests: [],
      conversationGoal: null
    };

    this.conversationFlow = {
      currentPhase: 'opening',
      phaseProgress: 0.0,
      naturalTransitions: ['지역 선택', '예산 범위', '아파트 유형'],
      conversationMomentum: 'building'
    };
  }

  /**
   * 새로운 대화 턴 처리 - 멀티턴 컨텍스트를 고려한 지능형 응답
   */
  async processConversationTurn(
    userInput: string,
    systemResponse: string,
    additionalContext?: any
  ): Promise<{
    contextualRecommendations: ContextualRecommendation[];
    updatedContext: Record<string, any>;
    conversationInsights: any;
    nextBestActions: string[];
  }> {
    console.log(`🔄 멀티턴 대화 처리 시작: 턴 ${this.dialogueContext.turns.length + 1}`);

    // 1. 현재 턴 분석 및 기록
    const currentTurn = await this.analyzeAndRecordTurn(
      userInput, 
      systemResponse, 
      additionalContext
    );

    // 2. 누적 컨텍스트 업데이트
    this.updateCumulativeContext(currentTurn);

    // 3. 미해결 질의 및 암시적 요청 분석
    await this.analyzeUnresolvedAndImplicitRequests(userInput);

    // 4. 대화 흐름 분석 및 업데이트
    this.updateConversationFlow(currentTurn);

    // 5. 컨텍스트 기반 추천 생성
    const recommendations = await this.generateContextualRecommendations();

    // 6. 대화 인사이트 생성
    const insights = await this.generateConversationInsights();

    // 7. 다음 최적 행동 제안
    const nextBestActions = await this.suggestNextBestActions();

    console.log(`✅ 멀티턴 대화 처리 완료: ${recommendations.length}개 추천 생성`);

    return {
      contextualRecommendations: recommendations,
      updatedContext: this.dialogueContext.cumulativeContext,
      conversationInsights: insights,
      nextBestActions
    };
  }

  /**
   * 복합적 요청 처리 - 여러 질문이 섞인 복잡한 요청을 분해하고 체계적으로 처리
   */
  async processComplexRequest(
    complexRequest: string,
    conversationHistory: any[]
  ): Promise<{
    decomposedQuestions: string[];
    prioritizedOrder: number[];
    processingStrategy: string;
    expectedTurns: number;
  }> {
    console.log(`🧩 복합적 요청 분해 처리: ${complexRequest.substring(0, 100)}...`);

    const decompositionPrompt = `복합적인 부동산 질문을 분해하고 처리 순서를 결정하세요.

사용자의 복합 요청: "${complexRequest}"
대화 히스토리: ${JSON.stringify(conversationHistory.slice(-5))}
현재 컨텍스트: ${JSON.stringify(this.dialogueContext.cumulativeContext)}

이 요청을 다음과 같이 분석하세요:

1. 개별 질문들로 분해
2. 논리적 처리 순서 결정
3. 각 질문의 복잡도 평가
4. 전체 처리 전략 수립

JSON 응답:
{
  "decomposedQuestions": ["질문1", "질문2", "질문3"],
  "prioritizedOrder": [0, 2, 1], 
  "processingStrategy": "sequential|parallel|conditional",
  "expectedTurns": 예상_대화_턴_수,
  "complexity": "low|medium|high",
  "reasoning": "분해_및_우선순위_근거"
}

처리 전략:
- sequential: 순차적으로 하나씩
- parallel: 여러 질문을 동시에  
- conditional: 조건에 따라 분기

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: decompositionPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const result = {
        decomposedQuestions: analysis.decomposedQuestions || [complexRequest],
        prioritizedOrder: analysis.prioritizedOrder || [0],
        processingStrategy: analysis.processingStrategy || 'sequential',
        expectedTurns: analysis.expectedTurns || 1
      };

      console.log(`✅ 복합적 요청 분해 완료: ${result.decomposedQuestions.length}개 질문`);
      return result;

    } catch (error) {
      console.error('❌ 복합적 요청 분해 실패:', error);
      
      // 폴백: 기본 분해
      return {
        decomposedQuestions: [complexRequest],
        prioritizedOrder: [0], 
        processingStrategy: 'sequential',
        expectedTurns: 1
      };
    }
  }

  /**
   * 대화 히스토리 기반 지능형 추천
   */
  async generateHistoryBasedRecommendations(
    currentContext: any
  ): Promise<ContextualRecommendation[]> {
    console.log(`📊 히스토리 기반 추천 생성 중`);

    if (this.dialogueContext.turns.length === 0) {
      return [];
    }

    const recommendationPrompt = `대화 히스토리를 분석하여 사용자에게 도움이 될 추천을 생성하세요.

대화 히스토리: ${JSON.stringify(this.dialogueContext.turns.slice(-5))}
누적 컨텍스트: ${JSON.stringify(this.dialogueContext.cumulativeContext)}
현재 상황: ${JSON.stringify(currentContext)}
미해결 질의: ${this.dialogueContext.unresolvedQueries.join(', ')}

다음과 같은 추천을 JSON 배열로 생성하세요:

[
  {
    "type": "follow_up|related_topic|completion|clarification",
    "recommendation": "구체적인_추천_내용",
    "reasoning": "추천_근거",
    "priority": 1~10,
    "relatedTurns": ["관련된_턴_ID들"],
    "expectedUserValue": "사용자가_얻을_가치"
  }
]

추천 유형:
- follow_up: 이전 질문의 후속 정보
- related_topic: 관련된 새로운 주제
- completion: 미완성된 작업 완료
- clarification: 모호했던 부분 명확화

우선순위는 즉시 필요한 것일수록 높게 설정하세요.

JSON 배열만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: recommendationPrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '[]';
      const recommendations = JSON.parse(content.replace(/```json|```/g, '').trim());

      const contextualRecommendations: ContextualRecommendation[] = recommendations.map((rec: any) => ({
        type: rec.type || 'follow_up',
        recommendation: rec.recommendation,
        reasoning: rec.reasoning || '',
        priority: rec.priority || 5,
        relatedTurns: rec.relatedTurns || [],
        expectedUserValue: rec.expectedUserValue || ''
      }));

      console.log(`✅ 히스토리 기반 추천 생성 완료: ${contextualRecommendations.length}개`);
      return contextualRecommendations;

    } catch (error) {
      console.error('❌ 히스토리 기반 추천 생성 실패:', error);
      return [];
    }
  }

  /**
   * 대화 연속성 검증 및 복구
   */
  async validateAndRestoreContinuity(): Promise<{
    continuityScore: number;
    brokenLinks: string[];
    restorationSuggestions: string[];
  }> {
    console.log(`🔗 대화 연속성 검증 중`);

    const continuityPrompt = `대화의 연속성을 검증하고 끊어진 부분을 찾아보세요.

대화 턴들: ${JSON.stringify(this.dialogueContext.turns)}
누적 컨텍스트: ${JSON.stringify(this.dialogueContext.cumulativeContext)}

다음을 분석하여 JSON으로 응답하세요:

{
  "continuityScore": 0.0~1.0,
  "brokenLinks": ["끊어진_연결_부분들"],
  "restorationSuggestions": ["복구_제안들"],
  "contextGaps": ["놓친_컨텍스트들"],
  "reasoning": "분석_근거"
}

연속성 평가 기준:
- 이전 대화와의 논리적 연결
- 컨텍스트의 일관성
- 미해결 질문들의 추적
- 사용자 목표와의 일치도

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: continuityPrompt }],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const result = {
        continuityScore: analysis.continuityScore || 0.5,
        brokenLinks: analysis.brokenLinks || [],
        restorationSuggestions: analysis.restorationSuggestions || []
      };

      console.log(`✅ 연속성 검증 완료: 점수 ${result.continuityScore}`);
      return result;

    } catch (error) {
      console.error('❌ 연속성 검증 실패:', error);
      return {
        continuityScore: 0.5,
        brokenLinks: [],
        restorationSuggestions: ['대화 컨텍스트를 다시 확인해보겠습니다']
      };
    }
  }

  /**
   * 현재 턴 분석 및 기록
   */
  private async analyzeAndRecordTurn(
    userInput: string,
    systemResponse: string,
    additionalContext?: any
  ): Promise<ConversationTurn> {
    const turnId = `turn_${Date.now()}_${this.dialogueContext.turns.length}`;

    // LLM을 통한 턴 분석
    const turnAnalysis = await this.analyzeTurnWithLLM(userInput, systemResponse);

    const turn: ConversationTurn = {
      turnId,
      timestamp: new Date(),
      userInput,
      systemResponse,
      intent: turnAnalysis.intent || 'general_inquiry',
      extractedEntities: turnAnalysis.extractedEntities || {},
      contextCarryover: turnAnalysis.contextCarryover || {},
      satisfaction: turnAnalysis.satisfaction || 0.7
    };

    this.dialogueContext.turns.push(turn);

    // 메모리 관리: 설정된 깊이를 초과하면 오래된 턴 제거
    if (this.dialogueContext.turns.length > this.contextMemoryDepth) {
      this.dialogueContext.turns = this.dialogueContext.turns.slice(-this.contextMemoryDepth);
    }

    return turn;
  }

  /**
   * LLM을 통한 턴 분석
   */
  private async analyzeTurnWithLLM(userInput: string, systemResponse: string): Promise<any> {
    const analysisPrompt = `대화 턴을 분석하여 의도와 엔티티를 추출하세요.

사용자 입력: "${userInput}"
시스템 응답: "${systemResponse}"
기존 컨텍스트: ${JSON.stringify(this.dialogueContext.cumulativeContext)}

다음을 JSON으로 분석하세요:

{
  "intent": "사용자_의도",
  "extractedEntities": {
    "apartmentName": "아파트명",
    "location": "지역",
    "priceRange": "가격범위",
    "dealType": "거래유형"
  },
  "contextCarryover": {
    "key": "다음_턴으로_전달할_정보"
  },
  "satisfaction": 0.0~1.0,
  "reasoning": "분석_근거"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 턴 분석 실패:', error);
      return {
        intent: 'general_inquiry',
        extractedEntities: {},
        contextCarryover: {},
        satisfaction: 0.5
      };
    }
  }

  /**
   * 누적 컨텍스트 업데이트
   */
  private updateCumulativeContext(turn: ConversationTurn): void {
    // 엔티티 병합
    Object.keys(turn.extractedEntities).forEach(key => {
      if (turn.extractedEntities[key]) {
        this.dialogueContext.cumulativeContext[key] = turn.extractedEntities[key];
      }
    });

    // 컨텍스트 전달 정보 병합
    Object.keys(turn.contextCarryover).forEach(key => {
      this.dialogueContext.cumulativeContext[key] = turn.contextCarryover[key];
    });

    // 지속되는 엔티티 관리
    Object.keys(turn.extractedEntities).forEach(key => {
      if (this.shouldPersistEntity(key, turn.extractedEntities[key])) {
        this.entityPersistence[key] = {
          value: turn.extractedEntities[key],
          lastSeen: turn.timestamp,
          frequency: (this.entityPersistence[key]?.frequency || 0) + 1
        };
      }
    });
  }

  /**
   * 엔티티 지속성 판단
   */
  private shouldPersistEntity(key: string, value: any): boolean {
    const persistentKeys = ['apartmentName', 'location', 'priceRange', 'dealType', 'userGoal'];
    return persistentKeys.includes(key) && value != null;
  }

  /**
   * 미해결 질의 및 암시적 요청 분석
   */
  private async analyzeUnresolvedAndImplicitRequests(userInput: string): Promise<void> {
    // 간단한 구현 - 실제로는 더 복잡한 NLP 분석 필요
    if (userInput.includes('?') && !userInput.includes('감사합니다')) {
      const questionId = `q_${Date.now()}`;
      if (!this.dialogueContext.unresolvedQueries.includes(questionId)) {
        this.dialogueContext.unresolvedQueries.push(userInput.substring(0, 100));
      }
    }

    // 암시적 요청 감지 (예: "비싸네요" → 더 저렴한 옵션 요청)
    const implicitTriggers = ['비싸', '저렴한', '다른', '또 다른', '더', '추가'];
    const hasImplicitRequest = implicitTriggers.some(trigger => userInput.includes(trigger));
    
    if (hasImplicitRequest) {
      this.dialogueContext.implicitRequests.push(`암시적 요청: ${userInput.substring(0, 50)}`);
    }

    // 목록 크기 관리
    this.dialogueContext.unresolvedQueries = this.dialogueContext.unresolvedQueries.slice(-5);
    this.dialogueContext.implicitRequests = this.dialogueContext.implicitRequests.slice(-5);
  }

  /**
   * 대화 흐름 업데이트
   */
  private updateConversationFlow(turn: ConversationTurn): void {
    const turnCount = this.dialogueContext.turns.length;
    
    // 대화 단계 업데이트
    if (turnCount <= 2) {
      this.conversationFlow.currentPhase = 'opening';
    } else if (turnCount <= 5) {
      this.conversationFlow.currentPhase = 'exploration';
    } else if (turnCount <= 10) {
      this.conversationFlow.currentPhase = 'deepening';
    } else {
      this.conversationFlow.currentPhase = 'resolution';
    }

    // 만족도 기반 모멘텀 업데이트
    const recentSatisfaction = this.dialogueContext.turns
      .slice(-3)
      .reduce((avg, t) => avg + t.satisfaction, 0) / Math.min(3, this.dialogueContext.turns.length);

    if (recentSatisfaction > 0.7) {
      this.conversationFlow.conversationMomentum = 'building';
    } else if (recentSatisfaction > 0.4) {
      this.conversationFlow.conversationMomentum = 'stable';
    } else {
      this.conversationFlow.conversationMomentum = 'declining';
    }
  }

  /**
   * 컨텍스트 기반 추천 생성
   */
  private async generateContextualRecommendations(): Promise<ContextualRecommendation[]> {
    return await this.generateHistoryBasedRecommendations(this.dialogueContext.cumulativeContext);
  }

  /**
   * 대화 인사이트 생성
   */
  private async generateConversationInsights(): Promise<any> {
    return {
      turnCount: this.dialogueContext.turns.length,
      averageSatisfaction: this.dialogueContext.turns.reduce((avg, t) => avg + t.satisfaction, 0) / this.dialogueContext.turns.length,
      dominantIntent: this.getMostFrequentIntent(),
      conversationGoal: this.dialogueContext.conversationGoal,
      completionRate: this.calculateCompletionRate()
    };
  }

  /**
   * 다음 최적 행동 제안
   */
  private async suggestNextBestActions(): Promise<string[]> {
    const suggestions = [];

    if (this.dialogueContext.unresolvedQueries.length > 0) {
      suggestions.push('미해결 질문에 대한 답변 제공');
    }

    if (this.conversationFlow.conversationMomentum === 'declining') {
      suggestions.push('대화 활성화를 위한 흥미로운 정보 제공');
    }

    if (this.conversationFlow.currentPhase === 'deepening') {
      suggestions.push('구체적인 추천 또는 다음 단계 안내');
    }

    return suggestions.length > 0 ? suggestions : ['자연스러운 대화 지속'];
  }

  /**
   * 가장 빈번한 의도 반환
   */
  private getMostFrequentIntent(): string {
    const intentCounts: Record<string, number> = {};
    
    this.dialogueContext.turns.forEach(turn => {
      intentCounts[turn.intent] = (intentCounts[turn.intent] || 0) + 1;
    });

    return Object.keys(intentCounts).reduce((a, b) => intentCounts[a] > intentCounts[b] ? a : b, 'general_inquiry');
  }

  /**
   * 대화 완성도 계산
   */
  private calculateCompletionRate(): number {
    const totalQuestions = this.dialogueContext.turns.filter(t => t.userInput.includes('?')).length;
    const resolvedQuestions = totalQuestions - this.dialogueContext.unresolvedQueries.length;
    return totalQuestions > 0 ? resolvedQuestions / totalQuestions : 1.0;
  }

  /**
   * 대화 상태 반환
   */
  getConversationState() {
    return {
      dialogueContext: this.dialogueContext,
      conversationFlow: this.conversationFlow,
      entityPersistence: this.entityPersistence,
      memoryDepth: this.contextMemoryDepth
    };
  }

  /**
   * 메모리 깊이 설정
   */
  setMemoryDepth(depth: number): void {
    this.contextMemoryDepth = Math.max(1, Math.min(50, depth)); // 1-50 사이로 제한
  }

  /**
   * 대화 초기화
   */
  reset(keepConversationId: boolean = false): void {
    const newConversationId = keepConversationId 
      ? this.dialogueContext.conversationId 
      : `conv_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    this.dialogueContext = {
      conversationId: newConversationId,
      turns: [],
      cumulativeContext: {},
      unresolvedQueries: [],
      implicitRequests: [],
      conversationGoal: null
    };

    this.conversationFlow = {
      currentPhase: 'opening',
      phaseProgress: 0.0,
      naturalTransitions: ['지역 선택', '예산 범위', '아파트 유형'],
      conversationMomentum: 'building'
    };

    this.entityPersistence = {};
  }
}