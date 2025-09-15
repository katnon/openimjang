// 🧠 OpenImjang AI 3.0 - 대화 전략 엔진
// 사용자 유형별 맞춤형 대화 전략과 질문 시퀀스를 관리하는 지능형 매니저

import OpenAI from 'openai';

export interface UserProfile {
  userType: 'first_buyer' | 'investor' | 'relocator' | 'upgrader' | 'explorer';
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  primaryGoal: 'purchase' | 'investment' | 'research' | 'comparison';
  decisionStyle: 'analytical' | 'intuitive' | 'social' | 'pragmatic';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  informationNeed: 'basic' | 'detailed' | 'expert_level';
}

export interface DialogueStrategy {
  approachStyle: 'educational' | 'consultative' | 'collaborative' | 'directive';
  questionSequence: string[];
  informationPriority: string[];
  conversationPacing: 'slow' | 'moderate' | 'fast';
  supportLevel: 'high_guidance' | 'moderate_guidance' | 'minimal_guidance';
  communicationTone: 'formal' | 'friendly' | 'expert' | 'casual';
}

export interface AdaptiveResponse {
  responseStrategy: string;
  suggestedQuestions: string[];
  informationToHighlight: string[];
  cautionsToMention: string[];
  nextStepRecommendations: string[];
  personalizedTips: string[];
}

/**
 * 🧠 대화 전략 엔진
 * 사용자 유형을 자동 감지하고 맞춤형 대화 전략을 수립하는 지능형 시스템
 */
export class DialogueStrategyEngine {
  private openai: OpenAI;
  private userProfile: UserProfile | null = null;
  private currentStrategy: DialogueStrategy | null = null;
  private strategyEffectiveness: number = 0.5;
  private adaptationHistory: Array<{
    timestamp: Date;
    trigger: string;
    oldStrategy: string;
    newStrategy: string;
    reason: string;
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
  }

  /**
   * 사용자 메시지와 컨텍스트를 기반으로 사용자 프로필 자동 감지
   */
  async detectUserProfile(
    userMessage: string,
    conversationHistory: any[],
    contextualClues: any = {}
  ): Promise<UserProfile> {
    console.log(`🔍 사용자 프로필 감지 시작`);

    const analysisPrompt = this.createProfileAnalysisPrompt(
      userMessage, 
      conversationHistory, 
      contextualClues
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const detectedProfile: UserProfile = {
        userType: analysis.userType || 'explorer',
        experienceLevel: analysis.experienceLevel || 'beginner',
        primaryGoal: analysis.primaryGoal || 'research',
        decisionStyle: analysis.decisionStyle || 'analytical',
        riskTolerance: analysis.riskTolerance || 'moderate',
        informationNeed: analysis.informationNeed || 'basic'
      };

      this.userProfile = detectedProfile;
      console.log(`✅ 사용자 프로필 감지 완료:`, detectedProfile);

      return detectedProfile;
    } catch (error) {
      console.error('❌ 사용자 프로필 감지 실패:', error);
      
      // 폴백: 기본 프로필
      const defaultProfile: UserProfile = {
        userType: 'explorer',
        experienceLevel: 'beginner',
        primaryGoal: 'research',
        decisionStyle: 'analytical',
        riskTolerance: 'moderate',
        informationNeed: 'basic'
      };
      
      this.userProfile = defaultProfile;
      return defaultProfile;
    }
  }

  /**
   * 감지된 사용자 프로필에 따른 맞춤형 대화 전략 수립
   */
  async createDialogueStrategy(userProfile: UserProfile): Promise<DialogueStrategy> {
    console.log(`📋 대화 전략 수립 중: ${userProfile.userType} / ${userProfile.experienceLevel}`);

    // 사용자 유형별 기본 전략 템플릿
    const strategyTemplate = this.getStrategyTemplate(userProfile);

    // LLM을 통한 개인화된 전략 최적화
    const optimizedStrategy = await this.llmOptimizeStrategy(userProfile, strategyTemplate);

    this.currentStrategy = optimizedStrategy;
    console.log(`✅ 대화 전략 수립 완료: ${optimizedStrategy.approachStyle}`);

    return optimizedStrategy;
  }

  /**
   * 현재 상황에 맞는 적응형 응답 전략 생성
   */
  async generateAdaptiveResponse(
    userMessage: string,
    conversationContext: any,
    currentMomentum: any
  ): Promise<AdaptiveResponse> {
    console.log(`🎯 적응형 응답 전략 생성 중`);

    if (!this.currentStrategy || !this.userProfile) {
      throw new Error('사용자 프로필 또는 대화 전략이 설정되지 않았습니다.');
    }

    const responsePrompt = this.createAdaptiveResponsePrompt(
      userMessage,
      conversationContext,
      currentMomentum,
      this.userProfile,
      this.currentStrategy
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: responsePrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      const adaptiveResponse = JSON.parse(content.replace(/```json|```/g, '').trim());

      const finalResponse: AdaptiveResponse = {
        responseStrategy: adaptiveResponse.responseStrategy || 'balanced_approach',
        suggestedQuestions: adaptiveResponse.suggestedQuestions || [],
        informationToHighlight: adaptiveResponse.informationToHighlight || [],
        cautionsToMention: adaptiveResponse.cautionsToMention || [],
        nextStepRecommendations: adaptiveResponse.nextStepRecommendations || [],
        personalizedTips: adaptiveResponse.personalizedTips || []
      };

      console.log(`✅ 적응형 응답 전략 생성 완료: ${finalResponse.responseStrategy}`);
      return finalResponse;

    } catch (error) {
      console.error('❌ 적응형 응답 생성 실패:', error);
      
      // 폴백: 기본 응답 전략
      return {
        responseStrategy: 'fallback_friendly',
        suggestedQuestions: ['추가 데이터 요구사항을 명시하시기 바랍니다.'],
        informationToHighlight: ['기본 부동산 데이터'],
        cautionsToMention: [],
        nextStepRecommendations: ['분석에 필요한 구체적 조건을 제시하시기 바랍니다.'],
        personalizedTips: []
      };
    }
  }

  /**
   * 대화 진행에 따른 전략 효과성 평가 및 적응
   */
  async evaluateAndAdaptStrategy(
    interactionFeedback: {
      userEngagement: number;
      questionClarity: number;
      informationRelevance: number;
      progressTowardsGoal: number;
    }
  ): Promise<boolean> {
    const overallEffectiveness = (
      interactionFeedback.userEngagement +
      interactionFeedback.questionClarity +
      interactionFeedback.informationRelevance +
      interactionFeedback.progressTowardsGoal
    ) / 4;

    console.log(`📊 전략 효과성 평가: ${overallEffectiveness}`);

    // 효과성이 낮은 경우 전략 적응
    if (overallEffectiveness < 0.6 && this.userProfile) {
      console.log(`🔄 전략 적응 필요 감지`);
      
      const adaptedStrategy = await this.adaptStrategyBasedOnFeedback(
        interactionFeedback,
        this.currentStrategy!
      );

      if (adaptedStrategy) {
        this.recordStrategyAdaptation(
          'low_effectiveness',
          this.currentStrategy!.approachStyle,
          adaptedStrategy.approachStyle,
          `효과성 점수: ${overallEffectiveness}`
        );

        this.currentStrategy = adaptedStrategy;
        this.strategyEffectiveness = overallEffectiveness;
        return true;
      }
    }

    this.strategyEffectiveness = Math.max(this.strategyEffectiveness, overallEffectiveness);
    return false;
  }

  /**
   * 사용자 프로필 분석을 위한 프롬프트 생성
   */
  private createProfileAnalysisPrompt(
    userMessage: string,
    conversationHistory: any[],
    contextualClues: any
  ): string {
    return `당신은 부동산 상담 전문가입니다. 사용자의 메시지와 대화 히스토리를 분석하여 사용자 프로필을 파악하세요.

사용자 메시지: "${userMessage}"

대화 히스토리:
${conversationHistory.map(h => `${h.role}: ${h.content}`).slice(-5).join('\n')}

추가 컨텍스트:
${JSON.stringify(contextualClues, null, 2)}

다음 기준으로 사용자를 분류하고 JSON으로 응답하세요:

사용자 유형 (userType):
- first_buyer: 첫 구매자 (생애 첫 주택 구매)
- investor: 투자자 (수익 목적)
- relocator: 이주민 (이사, 직장 이동 등)
- upgrader: 업그레이드족 (기존 주택에서 더 나은 곳으로)
- explorer: 탐색자 (아직 명확한 목적 없이 둘러보기)

경험 수준 (experienceLevel):
- beginner: 초보자
- intermediate: 중급자  
- expert: 전문가

주요 목표 (primaryGoal):
- purchase: 실제 구매
- investment: 투자 분석
- research: 정보 수집
- comparison: 비교 검토

의사결정 스타일 (decisionStyle):
- analytical: 분석적 (데이터, 수치 중시)
- intuitive: 직관적 (감정, 느낌 중시)
- social: 사회적 (다른 사람 의견 중시)
- pragmatic: 실용적 (현실적 조건 중시)

위험 감수성 (riskTolerance):
- conservative: 보수적
- moderate: 중도적
- aggressive: 공격적

정보 필요도 (informationNeed):
- basic: 기본 정보
- detailed: 상세 정보
- expert_level: 전문가 수준

응답 형식:
{
  "userType": "분류된_유형",
  "experienceLevel": "경험_수준",
  "primaryGoal": "주요_목표",
  "decisionStyle": "의사결정_스타일",
  "riskTolerance": "위험_감수성",
  "informationNeed": "정보_필요도",
  "confidence": 0.0~1.0,
  "reasoning": "분류 근거"
}`;
  }

  /**
   * 사용자 유형별 전략 템플릿 반환
   */
  private getStrategyTemplate(userProfile: UserProfile): DialogueStrategy {
    const templates: Record<string, DialogueStrategy> = {
      first_buyer: {
        approachStyle: 'educational',
        questionSequence: [
          '구매 예산 범위를 명시하시기 바랍니다.',
          '주요 활동 지역을 알려주시기 바랍니다.',
          '대출 조건 검토 현황을 제시하시기 바랍니다.',
          '교육시설 및 교통 접근성 우선순위를 명시하시기 바랍니다.'
        ],
        informationPriority: ['가격', '입지', '대출', '생활편의시설', '교통'],
        conversationPacing: 'slow',
        supportLevel: 'high_guidance',
        communicationTone: 'expert'
      },
      investor: {
        approachStyle: 'consultative',
        questionSequence: [
          '투자 목적을 임대수익 또는 시세차익으로 명시하시기 바랍니다.',
          '투자 예산 규모를 제시하시기 바랍니다.',
          '선호 지역 또는 부동산 유형을 명시하시기 바랍니다.',
          '투자 기간을 구체적으로 제시하시기 바랍니다.'
        ],
        informationPriority: ['수익률', '시세동향', '임대시장', '개발계획', '교통발달'],
        conversationPacing: 'fast',
        supportLevel: 'moderate_guidance',
        communicationTone: 'expert'
      },
      relocator: {
        approachStyle: 'collaborative',
        questionSequence: [
          '이사 목적을 명시하시기 바랍니다.',
          '직장 또는 교육기관 위치 정보를 제시하시기 바랍니다.',
          '현재 거주지 대비 우선 조건을 명시하시기 바랍니다.',
          '이사 일정을 구체적으로 제시하시기 바랍니다.'
        ],
        informationPriority: ['입지', '교통', '생활편의', '교육환경', '가격'],
        conversationPacing: 'moderate',
        supportLevel: 'moderate_guidance',
        communicationTone: 'expert'
      },
      upgrader: {
        approachStyle: 'consultative',
        questionSequence: [
          '현재 거주지의 개선 필요 요소를 명시하시기 바랍니다.',
          '업그레이드 희망 조건을 구체적으로 제시하시기 바랍니다.',
          '추가 예산 범위를 명시하시기 바랍니다.',
          '이주 계획 일정을 제시하시기 바랍니다.'
        ],
        informationPriority: ['면적확장', '시설개선', '입지개선', '가격차이', '매매타이밍'],
        conversationPacing: 'moderate',
        supportLevel: 'moderate_guidance',
        communicationTone: 'expert'
      },
      explorer: {
        approachStyle: 'collaborative',
        questionSequence: [
          '필요한 부동산 정보 유형을 명시하시기 바랍니다.',
          '분석 대상 지역을 제시하시기 바랍니다.',
          '매매, 전세, 월세 중 분석 대상을 선택하시기 바랍니다.',
          '구체적 계획 여부를 명시하시기 바랍니다.'
        ],
        informationPriority: ['시세정보', '지역정보', '시장동향', '생활정보'],
        conversationPacing: 'moderate',
        supportLevel: 'high_guidance',
        communicationTone: 'expert'
      }
    };

    return templates[userProfile.userType] || templates.explorer;
  }

  /**
   * LLM을 통한 전략 최적화
   */
  private async llmOptimizeStrategy(
    userProfile: UserProfile,
    baseStrategy: DialogueStrategy
  ): Promise<DialogueStrategy> {
    const optimizationPrompt = `부동산 상담 전문가로서 사용자 프로필에 맞는 최적의 대화 전략을 수립하세요.

사용자 프로필:
${JSON.stringify(userProfile, null, 2)}

기본 전략:
${JSON.stringify(baseStrategy, null, 2)}

이 사용자에게 최적화된 전략을 JSON으로 제공하세요:
{
  "approachStyle": "educational|consultative|collaborative|directive",
  "questionSequence": ["개인화된 질문들"],
  "informationPriority": ["우선순위별 정보"],
  "conversationPacing": "slow|moderate|fast",
  "supportLevel": "high_guidance|moderate_guidance|minimal_guidance",
  "communicationTone": "formal|friendly|expert|casual"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: optimizationPrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 전략 최적화 실패:', error);
      return baseStrategy;
    }
  }

  /**
   * 적응형 응답을 위한 프롬프트 생성
   */
  private createAdaptiveResponsePrompt(
    userMessage: string,
    conversationContext: any,
    currentMomentum: any,
    userProfile: UserProfile,
    strategy: DialogueStrategy
  ): string {
    return `부동산 상담 전문가로서 현재 상황에 최적화된 응답 전략을 수립하세요.

사용자 메시지: "${userMessage}"

사용자 프로필:
${JSON.stringify(userProfile, null, 2)}

현재 대화 전략:
${JSON.stringify(strategy, null, 2)}

대화 컨텍스트:
${JSON.stringify(conversationContext, null, 2)}

대화 모멘텀:
${JSON.stringify(currentMomentum, null, 2)}

이 상황에 최적화된 응답 전략을 JSON으로 제공하세요:
{
  "responseStrategy": "현재 상황에 맞는 응답 전략",
  "suggestedQuestions": ["사용자에게 물어볼 질문들"],
  "informationToHighlight": ["강조할 정보들"],
  "cautionsToMention": ["주의사항들"],
  "nextStepRecommendations": ["다음 단계 추천"],
  "personalizedTips": ["개인화된 조언들"]
}

JSON만 응답하세요.`;
  }

  /**
   * 피드백 기반 전략 적응
   */
  private async adaptStrategyBasedOnFeedback(
    feedback: any,
    currentStrategy: DialogueStrategy
  ): Promise<DialogueStrategy | null> {
    // 구체적인 적응 로직 구현
    if (feedback.userEngagement < 0.5) {
      // 참여도가 낮으면 더 인터랙티브한 접근
      return {
        ...currentStrategy,
        approachStyle: 'collaborative',
        conversationPacing: 'moderate',
        communicationTone: 'expert'
      };
    }

    if (feedback.informationRelevance < 0.6) {
      // 정보 관련성이 낮으면 더 구체적인 질문
      return {
        ...currentStrategy,
        supportLevel: 'high_guidance',
        questionSequence: [
          '필요한 정보의 우선순위를 명시하시기 바랍니다.',
          '현재 상황을 구체적으로 제시하시기 바랍니다.',
          ...currentStrategy.questionSequence.slice(2)
        ]
      };
    }

    return null; // 적응 불필요
  }

  /**
   * 전략 적응 이력 기록
   */
  private recordStrategyAdaptation(
    trigger: string,
    oldStrategy: string,
    newStrategy: string,
    reason: string
  ): void {
    this.adaptationHistory.push({
      timestamp: new Date(),
      trigger,
      oldStrategy,
      newStrategy,
      reason
    });

    // 최근 10개만 유지
    this.adaptationHistory = this.adaptationHistory.slice(-10);
  }

  /**
   * 현재 전략 상태 반환
   */
  getStrategyState() {
    return {
      userProfile: this.userProfile,
      currentStrategy: this.currentStrategy,
      effectiveness: this.strategyEffectiveness,
      adaptationHistory: this.adaptationHistory
    };
  }

  /**
   * 전략 초기화
   */
  reset(): void {
    this.userProfile = null;
    this.currentStrategy = null;
    this.strategyEffectiveness = 0.5;
    this.adaptationHistory = [];
  }
}