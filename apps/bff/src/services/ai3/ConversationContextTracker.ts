// 🧠 OpenImjang AI 3.0 - 대화 컨텍스트 지능형 추적 시스템
// 사용자의 질문 패턴, 관심사, 선호도를 학습하고 대화 맥락을 유지하는 핵심 매니저

import OpenAI from 'openai';

export interface UserPattern {
  frequentKeywords: string[]; // 자주 사용하는 키워드
  preferredRegions: string[]; // 관심 지역 패턴
  budgetRange: [number, number] | null; // 추론된 예산 범위
  dealTypePreference: ('매매' | '전세' | '월세')[] | null; // 선호 거래 유형
  questioningStyle: 'direct' | 'exploratory' | 'detailed' | 'casual'; // 질문 스타일
  urgencyLevel: 'high' | 'medium' | 'low'; // 긴급도
}

export interface ConversationStage {
  stage: 'exploration' | 'specification' | 'comparison' | 'decision'; // 대화 단계
  confidence: number; // 단계 판단 확신도
  nextExpectedActions: string[]; // 다음 예상 행동
  stageStartTime: Date; // 단계 시작 시간
}

export interface ConversationMomentum {
  momentum: 'building' | 'maintaining' | 'declining'; // 대화 모멘텀
  engagementScore: number; // 참여도 점수 (0-1)
  lastActiveTime: Date; // 마지막 활성 시간
  responseLatency: number[]; // 응답 지연시간 패턴
}

export interface ContextualInsight {
  userIntent: string; // 현재 사용자 의도
  hiddenNeeds: string[]; // 암시적 니즈
  potentialConcerns: string[]; // 잠재적 우려사항
  suggestedTopics: string[]; // 제안할 토픽
  personalizedApproach: string; // 개인화된 접근법
}

/**
 * 🧠 대화 컨텍스트 지능형 추적 시스템
 * 사용자의 대화 패턴을 학습하고 맥락을 유지하여 개인화된 경험 제공
 */
export class ConversationContextTracker {
  private openai: OpenAI;
  private userPattern: UserPattern;
  private conversationStage: ConversationStage;
  private momentum: ConversationMomentum;
  private messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: any;
  }> = [];

  constructor(openaiInstanceOrApiKey?: OpenAI | string) {
    if (openaiInstanceOrApiKey instanceof OpenAI) {
      this.openai = openaiInstanceOrApiKey;
    } else {
      // API 키 명시적 전달 또는 환경변수 사용
      const apiKey = openaiInstanceOrApiKey || process.env.OPENAI_API_KEY;
      this.openai = new OpenAI({
        apiKey: apiKey!
      });
    }

    // 초기 상태 설정
    this.userPattern = {
      frequentKeywords: [],
      preferredRegions: [],
      budgetRange: null,
      dealTypePreference: null,
      questioningStyle: 'casual',
      urgencyLevel: 'medium'
    };

    this.conversationStage = {
      stage: 'exploration',
      confidence: 0.5,
      nextExpectedActions: ['지역 선택', '아파트명 언급', '가격대 문의'],
      stageStartTime: new Date()
    };

    this.momentum = {
      momentum: 'building',
      engagementScore: 0.5,
      lastActiveTime: new Date(),
      responseLatency: []
    };
  }

  /**
   * 사용자 메시지를 분석하여 컨텍스트를 업데이트
   */
  async analyzeAndUpdateContext(
    userMessage: string, 
    responseTime?: number
  ): Promise<ContextualInsight> {
    console.log(`🧠 대화 컨텍스트 분석 시작: "${userMessage.substring(0, 100)}..."`);

    // 1. 메시지 히스토리에 추가
    this.messageHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // 2. LLM 기반 패턴 분석
    const patternAnalysis = await this.llmAnalyzeUserPattern(userMessage);
    this.updateUserPattern(patternAnalysis);

    // 3. 대화 단계 분석
    const stageAnalysis = await this.llmAnalyzeConversationStage(userMessage);
    this.updateConversationStage(stageAnalysis);

    // 4. 모멘텀 업데이트
    this.updateMomentum(responseTime);

    // 5. 컨텍스트 기반 인사이트 생성
    const insight = await this.generateContextualInsight();

    console.log(`✅ 컨텍스트 분석 완료:`, {
      stage: this.conversationStage.stage,
      momentum: this.momentum.momentum,
      urgency: this.userPattern.urgencyLevel
    });

    return insight;
  }

  /**
   * LLM을 사용한 사용자 패턴 분석
   */
  private async llmAnalyzeUserPattern(userMessage: string): Promise<any> {
    const prompt = `당신은 부동산 상담 전문가입니다. 사용자의 메시지를 분석하여 패턴을 파악하세요.

현재 사용자 패턴:
- 자주 사용하는 키워드: ${this.userPattern.frequentKeywords.join(', ')}
- 관심 지역: ${this.userPattern.preferredRegions.join(', ')}
- 질문 스타일: ${this.userPattern.questioningStyle}
- 긴급도: ${this.userPattern.urgencyLevel}

새로운 메시지: "${userMessage}"

다음 정보를 JSON으로 추출하세요:
{
  "extractedKeywords": ["키워드1", "키워드2"],
  "mentionedRegions": ["지역1", "지역2"],
  "impliedBudgetRange": [최소값, 최대값] or null,
  "dealTypePreference": ["매매", "전세", "월세"] or null,
  "questioningStyle": "direct|exploratory|detailed|casual",
  "urgencyIndicators": ["긴급", "빨리", "급함"] or [],
  "emotionalTone": "excited|worried|casual|serious"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 사용자 패턴 분석 실패:', error);
      return {};
    }
  }

  /**
   * LLM을 사용한 대화 단계 분석
   */
  private async llmAnalyzeConversationStage(userMessage: string): Promise<any> {
    const recentMessages = this.messageHistory.slice(-5).map(m => 
      `${m.role}: ${m.content}`
    ).join('\n');

    const prompt = `부동산 상담 대화의 진행 단계를 분석하세요.

현재 단계: ${this.conversationStage.stage}

최근 대화:
${recentMessages}

새 메시지: "${userMessage}"

대화 단계:
- exploration: 초기 탐색 (지역, 아파트 종류 등 알아보기)
- specification: 구체화 (특정 아파트, 가격대, 조건 명시)  
- comparison: 비교 검토 (여러 옵션 비교, 장단점 분석)
- decision: 결정 지원 (최종 선택, 실행 계획)

JSON으로 응답:
{
  "detectedStage": "exploration|specification|comparison|decision",
  "confidence": 0.0~1.0,
  "reasoning": "단계 판단 근거",
  "nextExpectedActions": ["예상 행동1", "예상 행동2"],
  "stageTransition": true/false
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 대화 단계 분석 실패:', error);
      return { detectedStage: this.conversationStage.stage };
    }
  }

  /**
   * 사용자 패턴 업데이트
   */
  private updateUserPattern(analysis: any): void {
    if (analysis.extractedKeywords) {
      analysis.extractedKeywords.forEach((keyword: string) => {
        if (!this.userPattern.frequentKeywords.includes(keyword)) {
          this.userPattern.frequentKeywords.push(keyword);
        }
      });
      // 최대 20개까지 유지
      this.userPattern.frequentKeywords = this.userPattern.frequentKeywords.slice(-20);
    }

    if (analysis.mentionedRegions) {
      analysis.mentionedRegions.forEach((region: string) => {
        if (!this.userPattern.preferredRegions.includes(region)) {
          this.userPattern.preferredRegions.push(region);
        }
      });
    }

    if (analysis.impliedBudgetRange) {
      this.userPattern.budgetRange = analysis.impliedBudgetRange;
    }

    if (analysis.dealTypePreference) {
      this.userPattern.dealTypePreference = analysis.dealTypePreference;
    }

    if (analysis.questioningStyle) {
      this.userPattern.questioningStyle = analysis.questioningStyle;
    }

    // 긴급도 업데이트
    if (analysis.urgencyIndicators && analysis.urgencyIndicators.length > 0) {
      this.userPattern.urgencyLevel = 'high';
    } else if (analysis.emotionalTone === 'casual') {
      this.userPattern.urgencyLevel = 'low';
    }
  }

  /**
   * 대화 단계 업데이트
   */
  private updateConversationStage(analysis: any): void {
    if (analysis.detectedStage && analysis.detectedStage !== this.conversationStage.stage) {
      this.conversationStage = {
        stage: analysis.detectedStage,
        confidence: analysis.confidence || 0.5,
        nextExpectedActions: analysis.nextExpectedActions || [],
        stageStartTime: new Date()
      };
      console.log(`🔄 대화 단계 전환: ${analysis.detectedStage}`);
    } else if (analysis.confidence) {
      this.conversationStage.confidence = Math.max(
        this.conversationStage.confidence,
        analysis.confidence
      );
    }
  }

  /**
   * 대화 모멘텀 업데이트
   */
  private updateMomentum(responseTime?: number): void {
    const now = new Date();
    const timeSinceLastMessage = now.getTime() - this.momentum.lastActiveTime.getTime();

    // 응답 지연시간 기록
    if (responseTime) {
      this.momentum.responseLatency.push(responseTime);
      this.momentum.responseLatency = this.momentum.responseLatency.slice(-10); // 최근 10개만 유지
    }

    // 참여도 점수 업데이트
    const avgResponseTime = this.momentum.responseLatency.length > 0 
      ? this.momentum.responseLatency.reduce((a, b) => a + b, 0) / this.momentum.responseLatency.length
      : 5000; // 5초 기본값

    if (avgResponseTime < 3000) { // 3초 미만 빠른 응답
      this.momentum.engagementScore = Math.min(1.0, this.momentum.engagementScore + 0.1);
    } else if (avgResponseTime > 15000) { // 15초 초과 느린 응답
      this.momentum.engagementScore = Math.max(0.0, this.momentum.engagementScore - 0.1);
    }

    // 모멘텀 상태 업데이트
    if (timeSinceLastMessage < 30000 && this.momentum.engagementScore > 0.7) {
      this.momentum.momentum = 'building';
    } else if (timeSinceLastMessage < 60000 && this.momentum.engagementScore > 0.4) {
      this.momentum.momentum = 'maintaining';
    } else {
      this.momentum.momentum = 'declining';
    }

    this.momentum.lastActiveTime = now;
  }

  /**
   * 컨텍스트 기반 인사이트 생성
   */
  private async generateContextualInsight(): Promise<ContextualInsight> {
    const contextSummary = {
      userPattern: this.userPattern,
      conversationStage: this.conversationStage,
      momentum: this.momentum,
      recentMessages: this.messageHistory.slice(-3)
    };

    const prompt = `부동산 상담 AI로서 사용자 컨텍스트를 분석하여 인사이트를 제공하세요.

컨텍스트 정보:
${JSON.stringify(contextSummary, null, 2)}

다음 정보를 JSON으로 제공하세요:
{
  "userIntent": "현재 사용자의 주요 의도",
  "hiddenNeeds": ["암시적 니즈1", "암시적 니즈2"],
  "potentialConcerns": ["잠재적 우려1", "잠재적 우려2"],
  "suggestedTopics": ["제안할 토픽1", "제안할 토픽2"],
  "personalizedApproach": "이 사용자에게 최적화된 상담 접근법"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      const insight = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        userIntent: insight.userIntent || '일반적인 부동산 정보 탐색',
        hiddenNeeds: insight.hiddenNeeds || [],
        potentialConcerns: insight.potentialConcerns || [],
        suggestedTopics: insight.suggestedTopics || [],
        personalizedApproach: insight.personalizedApproach || '친근하고 도움이 되는 상담'
      };
    } catch (error) {
      console.error('❌ 컨텍스트 인사이트 생성 실패:', error);
      return {
        userIntent: '일반적인 부동산 정보 탐색',
        hiddenNeeds: [],
        potentialConcerns: [],
        suggestedTopics: [],
        personalizedApproach: '친근하고 도움이 되는 상담'
      };
    }
  }

  /**
   * 어시스턴트 응답 기록
   */
  addAssistantResponse(response: string, metadata?: any): void {
    this.messageHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata
    });
  }

  /**
   * 현재 컨텍스트 상태 반환
   */
  getContextState() {
    return {
      userPattern: this.userPattern,
      conversationStage: this.conversationStage,
      momentum: this.momentum,
      messageCount: this.messageHistory.length
    };
  }

  /**
   * 컨텍스트 초기화
   */
  reset(): void {
    this.userPattern = {
      frequentKeywords: [],
      preferredRegions: [],
      budgetRange: null,
      dealTypePreference: null,
      questioningStyle: 'casual',
      urgencyLevel: 'medium'
    };

    this.conversationStage = {
      stage: 'exploration',
      confidence: 0.5,
      nextExpectedActions: ['지역 선택', '아파트명 언급', '가격대 문의'],
      stageStartTime: new Date()
    };

    this.momentum = {
      momentum: 'building',
      engagementScore: 0.5,
      lastActiveTime: new Date(),
      responseLatency: []
    };

    this.messageHistory = [];
  }
}