// 🧠 OpenImjang AI 3.0 - 감정적 맥락 분석기
// 사용자의 감정 상태를 파악하여 공감적이고 상황에 맞는 응답을 제공하는 지능형 매니저
// 기반 이론: Affective Computing (MIT Rosalind Picard, 1997) + Empathetic AI Design (Stanford HAI, 2021)

import OpenAI from 'openai';

export interface EmotionalState {
  primaryEmotion: 'excitement' | 'anxiety' | 'frustration' | 'confidence' | 'uncertainty' | 'satisfaction' | 'impatience' | 'calm';
  intensity: number; // 0-1 사이 감정 강도
  confidence: number; // 0-1 사이 감정 판단 확신도
  emotionalTrend: 'improving' | 'stable' | 'declining'; // 감정 변화 추세
  triggers: string[]; // 감정을 유발한 요소들
}

export interface UserStressLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[]; // 스트레스 지표들
  timePattern: 'consistent' | 'increasing' | 'decreasing'; // 시간에 따른 패턴
  potentialCauses: string[]; // 추정되는 원인들
}

export interface DecisionReadiness {
  readiness: 'not_ready' | 'exploring' | 'nearly_ready' | 'ready' | 'urgent';
  confidence: number; // 0-1 사이 결정 확신도
  hesitationReasons: string[]; // 망설이는 이유들
  supportNeeded: string[]; // 결정을 위해 필요한 지원
  timelinePreference: 'no_rush' | 'moderate_pace' | 'urgent';
}

export interface EmpathicResponse {
  responseStrategy: 'supportive' | 'encouraging' | 'calming' | 'energizing' | 'validating';
  communicationTone: 'gentle' | 'confident' | 'enthusiastic' | 'professional' | 'reassuring';
  emotionalSupport: string; // 감정적 지원 메시지
  practicalGuidance: string; // 실용적 안내
  paceAdjustment: 'slow_down' | 'maintain' | 'speed_up'; // 대화 속도 조절
}

export interface EmotionalJourney {
  sessionStart: EmotionalState;
  currentState: EmotionalState;
  emotionalHistory: Array<{
    timestamp: Date;
    state: EmotionalState;
    trigger: string;
  }>;
  keyEmotionalMoments: Array<{
    moment: string;
    emotion: string;
    significance: string;
  }>;
}

/**
 * 🧠 감정적 맥락 분석기
 * 
 * 기반 이론:
 * - Affective Computing: 감정을 인식하고 반응하는 컴퓨팅 (MIT Rosalind Picard, 1997)
 * - Empathetic AI Design: 공감적 AI 시스템 설계 (Stanford HAI, 2021) 
 * - Emotional Intelligence in AI: AI의 감정지능 구현 (MIT Media Lab, 2019)
 * - Stress Detection in Human-Computer Interaction: HCI에서의 스트레스 감지 (CHI 2020)
 * - Decision Support under Emotional Stress: 감정적 스트레스 하의 의사결정 지원 (Cognitive Science, 2018)
 */
export class EmotionalContextAnalyzer {
  private openai: OpenAI;
  private emotionalJourney: EmotionalJourney | null = null;
  private empathyLevel: 'low' | 'medium' | 'high' = 'high';
  private culturalContext: 'korean' | 'international' = 'korean'; // 문화적 맥락 고려
  private sensitivityThreshold: number = 0.6; // 감정 감지 민감도

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
   * 사용자 메시지에서 감정 상태 분석
   */
  async analyzeEmotionalState(
    userMessage: string,
    conversationContext: any = {},
    previousEmotions: EmotionalState[] = []
  ): Promise<EmotionalState> {
    console.log(`💭 감정 상태 분석 시작: ${userMessage.substring(0, 100)}...`);

    const emotionAnalysisPrompt = this.createEmotionAnalysisPrompt(
      userMessage,
      conversationContext,
      previousEmotions
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: emotionAnalysisPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const emotionalState: EmotionalState = {
        primaryEmotion: analysis.primaryEmotion || 'calm',
        intensity: Math.max(0, Math.min(1, analysis.intensity || 0.5)),
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.6)),
        emotionalTrend: analysis.emotionalTrend || 'stable',
        triggers: analysis.triggers || []
      };

      // 감정 여정 업데이트
      this.updateEmotionalJourney(emotionalState, userMessage);

      console.log(`✅ 감정 분석 완료: ${emotionalState.primaryEmotion} (강도: ${emotionalState.intensity})`);
      return emotionalState;

    } catch (error) {
      console.error('❌ 감정 분석 실패:', error);
      
      // 폴백: 중립적 감정 상태
      const fallbackState: EmotionalState = {
        primaryEmotion: 'calm',
        intensity: 0.5,
        confidence: 0.3,
        emotionalTrend: 'stable',
        triggers: ['분석 실패']
      };

      this.updateEmotionalJourney(fallbackState, userMessage);
      return fallbackState;
    }
  }

  /**
   * 사용자 스트레스 수준 평가
   */
  async assessStressLevel(
    userMessage: string,
    behaviorSignals: any = {},
    timeContext: any = {}
  ): Promise<UserStressLevel> {
    console.log(`😰 스트레스 수준 평가 중`);

    const stressPrompt = `부동산 상담에서 사용자의 스트레스 수준을 평가하세요.

사용자 메시지: "${userMessage}"
행동 신호: ${JSON.stringify(behaviorSignals)}
시간 컨텍스트: ${JSON.stringify(timeContext)}

다음 지표들을 고려하여 스트레스를 평가하세요:

언어적 지표:
- 급박함을 나타내는 표현 ("빨리", "급해", "당장")
- 불안함을 나타내는 표현 ("걱정", "불안해", "모르겠어")
- 좌절감을 나타내는 표현 ("답답해", "힘들어", "어떻게")
- 결정 압박감 ("결정해야", "선택해야", "해야만")

행동적 지표:
- 응답 속도, 메시지 길이, 반복적 질문 등

JSON으로 응답하세요:
{
  "level": "low|medium|high|critical",
  "indicators": ["스트레스_지표들"],
  "timePattern": "consistent|increasing|decreasing",
  "potentialCauses": ["추정_원인들"],
  "confidence": 0.0~1.0,
  "reasoning": "평가_근거"
}

한국 문화적 맥락을 고려하여 평가하세요.
JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: stressPrompt }],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const stressLevel: UserStressLevel = {
        level: analysis.level || 'medium',
        indicators: analysis.indicators || [],
        timePattern: analysis.timePattern || 'consistent',
        potentialCauses: analysis.potentialCauses || []
      };

      console.log(`✅ 스트레스 평가 완료: ${stressLevel.level} (지표: ${stressLevel.indicators.length}개)`);
      return stressLevel;

    } catch (error) {
      console.error('❌ 스트레스 평가 실패:', error);
      
      return {
        level: 'medium',
        indicators: ['평가 불가'],
        timePattern: 'consistent',
        potentialCauses: ['정보 부족']
      };
    }
  }

  /**
   * 결정 준비도 평가
   */
  async evaluateDecisionReadiness(
    userMessage: string,
    conversationHistory: any[] = [],
    providedInformation: string[] = []
  ): Promise<DecisionReadiness> {
    console.log(`🤔 결정 준비도 평가 중`);

    const readinessPrompt = `부동산 구매/투자 결정에 대한 사용자의 준비도를 평가하세요.

사용자 메시지: "${userMessage}"
대화 히스토리: ${JSON.stringify(conversationHistory.slice(-5))}
제공된 정보: ${providedInformation.join(', ')}

결정 준비도 평가 지표:

정보 수집 완성도:
- 필수 정보 획득 여부
- 추가 정보 요청 패턴
- 비교 분석 수준

감정적 준비도:
- 확신의 표현
- 망설임의 신호
- 외부 승인 요구

실행 의지:
- 구체적 행동 언급
- 일정에 대한 언급
- 제약 조건 수용도

JSON으로 응답하세요:
{
  "readiness": "not_ready|exploring|nearly_ready|ready|urgent",
  "confidence": 0.0~1.0,
  "hesitationReasons": ["망설이는_이유들"],
  "supportNeeded": ["필요한_지원들"],
  "timelinePreference": "no_rush|moderate_pace|urgent",
  "reasoning": "평가_근거"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: readinessPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const decisionReadiness: DecisionReadiness = {
        readiness: analysis.readiness || 'exploring',
        confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
        hesitationReasons: analysis.hesitationReasons || [],
        supportNeeded: analysis.supportNeeded || [],
        timelinePreference: analysis.timelinePreference || 'moderate_pace'
      };

      console.log(`✅ 결정 준비도 평가 완료: ${decisionReadiness.readiness} (확신도: ${decisionReadiness.confidence})`);
      return decisionReadiness;

    } catch (error) {
      console.error('❌ 결정 준비도 평가 실패:', error);
      
      return {
        readiness: 'exploring',
        confidence: 0.5,
        hesitationReasons: ['평가 불가'],
        supportNeeded: ['더 많은 정보'],
        timelinePreference: 'moderate_pace'
      };
    }
  }

  /**
   * 공감적 응답 전략 생성
   */
  async generateEmpathicResponse(
    emotionalState: EmotionalState,
    stressLevel: UserStressLevel,
    decisionReadiness: DecisionReadiness,
    userMessage: string
  ): Promise<EmpathicResponse> {
    console.log(`💝 공감적 응답 전략 생성 중: ${emotionalState.primaryEmotion} / ${stressLevel.level}`);

    const empathyPrompt = `부동산 분석 전문가로서 사용자의 감정 상태를 고려한 객관적 응답 전략을 생성하세요.

사용자 메시지: "${userMessage}"
감정 상태: ${JSON.stringify(emotionalState)}
스트레스 수준: ${JSON.stringify(stressLevel)}
결정 준비도: ${JSON.stringify(decisionReadiness)}

**중요**: 감정적 공감 표현("이해해요", "걱정되시는 마음")을 배제하고 객관적 분석가 관점으로 응답하세요.

응답 전략 유형:
- analytical: 데이터 기반 분석적 접근
- informative: 정보 제공 중심 접근
- systematic: 체계적 단계별 접근
- strategic: 전략적 의사결정 지원
- objective: 객관적 사실 중심 접근

커뮤니케이션 톤:
- professional: 전문적이고 객관적인
- analytical: 분석적이고 논리적인
- direct: 명확하고 직접적인
- factual: 사실 기반의
- systematic: 체계적이고 구조적인
- reassuring: 안심시키고 위로하는

JSON으로 응답하세요:
{
  "responseStrategy": "선택된_전략",
  "communicationTone": "선택된_톤",
  "emotionalSupport": "감정적_지원_메시지",
  "practicalGuidance": "실용적_안내",
  "paceAdjustment": "slow_down|maintain|speed_up",
  "reasoning": "전략_선택_근거"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: empathyPrompt }],
        temperature: 0.4
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const empathicResponse: EmpathicResponse = {
        responseStrategy: analysis.responseStrategy || 'analytical',
        communicationTone: analysis.communicationTone || 'professional',
        emotionalSupport: analysis.emotionalSupport || '다음 정보가 필요합니다.',
        practicalGuidance: analysis.practicalGuidance || '단계별로 진행하겠습니다.',
        paceAdjustment: analysis.paceAdjustment || 'maintain'
      };

      console.log(`✅ 공감적 응답 전략 완료: ${empathicResponse.responseStrategy} / ${empathicResponse.communicationTone}`);
      return empathicResponse;

    } catch (error) {
      console.error('❌ 공감적 응답 생성 실패:', error);
      
      return {
        responseStrategy: 'supportive',
        communicationTone: 'reassuring',
        emotionalSupport: '함께 차근차근 알아보겠습니다.',
        practicalGuidance: '궁금한 점이 있으시면 언제든 말씀해 주세요.',
        paceAdjustment: 'maintain'
      };
    }
  }

  /**
   * 감정적 적응형 페이싱 제안
   */
  async suggestAdaptivePacing(
    emotionalState: EmotionalState,
    conversationVelocity: any,
    userPreferences: any = {}
  ): Promise<{
    recommendedPace: 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
    reasoning: string;
    adjustmentSuggestions: string[];
    emotionalSupport: string[];
  }> {
    console.log(`⏱️ 적응형 페이싱 제안 중`);

    // 감정과 스트레스 수준에 따른 페이싱 결정 로직
    let recommendedPace: 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast' = 'normal';
    let reasoning = '';
    const adjustmentSuggestions: string[] = [];
    const emotionalSupport: string[] = [];

    if (emotionalState.primaryEmotion === 'anxiety' && emotionalState.intensity > 0.7) {
      recommendedPace = 'slow';
      reasoning = '높은 불안 수준으로 인해 천천히 진행하는 것이 좋습니다';
      adjustmentSuggestions.push('복잡한 정보는 단계별로 나누어 제공');
      adjustmentSuggestions.push('각 단계마다 충분한 설명 시간 확보');
      emotionalSupport.push('서두르지 마시고 천천히 알아보겠습니다');
    } else if (emotionalState.primaryEmotion === 'impatience' && emotionalState.intensity > 0.6) {
      recommendedPace = 'fast';
      reasoning = '높은 조급함으로 인해 빠른 정보 제공이 필요합니다';
      adjustmentSuggestions.push('핵심 정보 우선 제공');
      adjustmentSuggestions.push('세부 사항은 요청 시에만 제공');
      emotionalSupport.push('빠르게 핵심 정보부터 확인해 드리겠습니다');
    } else if (emotionalState.primaryEmotion === 'uncertainty') {
      recommendedPace = 'slow';
      reasoning = '불확실한 상태에서는 신중한 접근이 필요합니다';
      adjustmentSuggestions.push('각 정보에 대한 충분한 설명 제공');
      adjustmentSuggestions.push('결정을 재촉하지 않기');
      emotionalSupport.push('확신이 설 때까지 함께 검토해보겠습니다');
    }

    return {
      recommendedPace,
      reasoning,
      adjustmentSuggestions,
      emotionalSupport
    };
  }

  /**
   * 감정 분석 프롬프트 생성
   */
  private createEmotionAnalysisPrompt(
    userMessage: string,
    conversationContext: any,
    previousEmotions: EmotionalState[]
  ): string {
    return `부동산 상담 맥락에서 사용자의 감정 상태를 분석하세요.

사용자 메시지: "${userMessage}"
대화 컨텍스트: ${JSON.stringify(conversationContext)}
이전 감정 상태: ${JSON.stringify(previousEmotions.slice(-3))}

다음 감정 중에서 가장 적절한 것을 선택하세요:
- excitement: 흥미롭고 기대감이 높은 상태
- anxiety: 불안하고 걱정되는 상태  
- frustration: 좌절하고 답답한 상태
- confidence: 확신하고 자신감 있는 상태
- uncertainty: 확실하지 않고 망설이는 상태
- satisfaction: 만족하고 긍정적인 상태
- impatience: 조급하고 빨리 진행하고 싶은 상태
- calm: 평온하고 차분한 상태

분석 기준:
1. 언어적 단서: 사용된 단어, 문장 구조, 표현의 강도
2. 맥락적 단서: 부동산 상황, 진행 단계, 이전 대화
3. 문화적 맥락: 한국어 표현의 뉘앙스와 문화적 의미

JSON으로 응답하세요:
{
  "primaryEmotion": "선택된_감정",
  "intensity": 0.0~1.0,
  "confidence": 0.0~1.0,
  "emotionalTrend": "improving|stable|declining",
  "triggers": ["감정을_유발한_요소들"],
  "reasoning": "분석_근거"
}

JSON만 응답하세요.`;
  }

  /**
   * 감정 여정 업데이트
   */
  private updateEmotionalJourney(emotionalState: EmotionalState, trigger: string): void {
    if (!this.emotionalJourney) {
      this.emotionalJourney = {
        sessionStart: { ...emotionalState },
        currentState: { ...emotionalState },
        emotionalHistory: [],
        keyEmotionalMoments: []
      };
    }

    // 현재 상태 업데이트
    this.emotionalJourney.currentState = { ...emotionalState };

    // 감정 히스토리에 추가
    this.emotionalJourney.emotionalHistory.push({
      timestamp: new Date(),
      state: { ...emotionalState },
      trigger
    });

    // 중요한 감정 변화 감지
    if (this.emotionalJourney.emotionalHistory.length > 1) {
      const previousState = this.emotionalJourney.emotionalHistory[
        this.emotionalJourney.emotionalHistory.length - 2
      ].state;

      const emotionChanged = previousState.primaryEmotion !== emotionalState.primaryEmotion;
      const significantIntensityChange = Math.abs(previousState.intensity - emotionalState.intensity) > 0.3;

      if (emotionChanged || significantIntensityChange) {
        this.emotionalJourney.keyEmotionalMoments.push({
          moment: new Date().toISOString(),
          emotion: emotionalState.primaryEmotion,
          significance: emotionChanged 
            ? `감정 변화: ${previousState.primaryEmotion} → ${emotionalState.primaryEmotion}`
            : `강도 변화: ${previousState.intensity} → ${emotionalState.intensity}`
        });
      }
    }

    // 히스토리 크기 관리 (최근 20개만 유지)
    if (this.emotionalJourney.emotionalHistory.length > 20) {
      this.emotionalJourney.emotionalHistory = this.emotionalJourney.emotionalHistory.slice(-20);
    }

    if (this.emotionalJourney.keyEmotionalMoments.length > 10) {
      this.emotionalJourney.keyEmotionalMoments = this.emotionalJourney.keyEmotionalMoments.slice(-10);
    }
  }

  /**
   * 공감 수준 설정
   */
  setEmpathyLevel(level: 'low' | 'medium' | 'high'): void {
    this.empathyLevel = level;
  }

  /**
   * 문화적 컨텍스트 설정
   */
  setCulturalContext(context: 'korean' | 'international'): void {
    this.culturalContext = context;
  }

  /**
   * 감정 감지 민감도 설정
   */
  setSensitivityThreshold(threshold: number): void {
    this.sensitivityThreshold = Math.max(0.1, Math.min(1.0, threshold));
  }

  /**
   * 현재 감정 분석 상태 반환
   */
  getEmotionalAnalysisState() {
    return {
      emotionalJourney: this.emotionalJourney,
      empathyLevel: this.empathyLevel,
      culturalContext: this.culturalContext,
      sensitivityThreshold: this.sensitivityThreshold
    };
  }

  /**
   * 감정 분석 초기화
   */
  reset(): void {
    this.emotionalJourney = null;
  }
}