// 🧠 OpenImjang AI 3.0 - 사용자 여정 최적화 매니저
// 부동산 구매 여정의 각 단계별 최적 정보 타이밍과 프로액티브 추천을 관리

import OpenAI from 'openai';

export interface JourneyStage {
  stage: 'awareness' | 'research' | 'evaluation' | 'decision' | 'action' | 'post_decision';
  substage: string; // 세부 단계
  progress: number; // 0-1 사이 진행도
  timeInStage: number; // 해당 단계에서 보낸 시간 (분)
  keyMilestones: string[]; // 달성한 마일스톤들
  blockers: string[]; // 진행 방해 요소들
}

export interface OptimalTiming {
  informationType: string; // 정보 유형
  idealTiming: 'now' | 'soon' | 'later' | 'not_needed'; // 최적 타이밍
  urgency: 'low' | 'medium' | 'high' | 'critical'; // 긴급도
  reasoning: string; // 타이밍 결정 근거
  prerequisites: string[]; // 선행 조건들
}

export interface ProactiveRecommendation {
  type: 'information' | 'action' | 'caution' | 'opportunity';
  title: string; // 추천 제목
  description: string; // 추천 설명
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timing: string; // 언제 제시할지
  triggers: string[]; // 추천 트리거 조건들
  expectedBenefit: string; // 기대 효과
}

export interface JourneyInsight {
  currentStageAnalysis: string; // 현재 단계 분석
  nextStepGuidance: string; // 다음 단계 가이드
  potentialPitfalls: string[]; // 잠재적 함정들
  opportunityWindows: string[]; // 기회 창구들
  personalizedAdvice: string; // 개인화된 조언
  timelineEstimate: string; // 예상 일정
}

/**
 * 🧠 사용자 여정 최적화 매니저
 * 부동산 구매/투자 여정을 분석하고 각 단계별 최적 정보와 타이밍을 제공
 */
export class UserJourneyOptimizer {
  private openai: OpenAI;
  private currentJourney: JourneyStage | null = null;
  private journeyHistory: JourneyStage[] = [];
  private userGoals: string[] = [];
  private constraints: Record<string, any> = {};
  private preferences: Record<string, any> = {};

  // 여정 단계별 정보 맵
  private readonly STAGE_INFO_MAP = {
    awareness: {
      key_info: ['시장 개요', '지역 특성', '가격 범위', '트렌드'],
      timing: 'broad_exploration',
      focus: 'education'
    },
    research: {
      key_info: ['구체적 매물', '상세 시세', '투자 분석', '입지 조건'],
      timing: 'targeted_search', 
      focus: 'comparison'
    },
    evaluation: {
      key_info: ['매물 비교', '리스크 분석', '수익성 검토', '전문가 의견'],
      timing: 'detailed_analysis',
      focus: 'decision_support'
    },
    decision: {
      key_info: ['최종 체크리스트', '협상 전략', '계약 조건', '실행 계획'],
      timing: 'action_oriented',
      focus: 'execution'
    },
    action: {
      key_info: ['계약 절차', '대출 정보', '세무 조언', '관리 방법'],
      timing: 'immediate_need',
      focus: 'implementation'
    },
    post_decision: {
      key_info: ['관리 방법', '세금 정보', '재투자 기회', '포트폴리오 관리'],
      timing: 'ongoing_support',
      focus: 'optimization'
    }
  };

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
   * 사용자의 현재 여정 단계 분석 및 업데이트
   */
  async analyzeAndUpdateJourney(
    userMessage: string,
    conversationHistory: any[],
    userProfile: any,
    behaviorSignals: any
  ): Promise<JourneyStage> {
    console.log(`🗺️ 사용자 여정 분석 시작`);

    // LLM 기반 여정 단계 분석
    const journeyAnalysis = await this.llmAnalyzeJourneyStage(
      userMessage,
      conversationHistory,
      userProfile,
      behaviorSignals
    );

    // 여정 단계 업데이트
    const newStage = this.updateJourneyStage(journeyAnalysis);

    // 목표와 제약사항 업데이트
    this.updateUserGoalsAndConstraints(journeyAnalysis);

    console.log(`✅ 여정 분석 완료: ${newStage.stage} (${newStage.substage})`);
    return newStage;
  }

  /**
   * 현재 여정 단계에 따른 최적 정보 타이밍 결정
   */
  async determineOptimalTiming(
    availableInformation: string[],
    userContext: any
  ): Promise<OptimalTiming[]> {
    console.log(`⏰ 최적 정보 타이밍 결정 중`);

    if (!this.currentJourney) {
      throw new Error('사용자 여정 정보가 없습니다. analyzeAndUpdateJourney를 먼저 실행하세요.');
    }

    const timingPrompt = this.createTimingAnalysisPrompt(
      availableInformation,
      this.currentJourney,
      userContext
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: timingPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '[]';
      const timingAnalysis = JSON.parse(content.replace(/```json|```/g, '').trim());

      const optimalTimings: OptimalTiming[] = timingAnalysis.map((timing: any) => ({
        informationType: timing.informationType,
        idealTiming: timing.idealTiming || 'later',
        urgency: timing.urgency || 'medium',
        reasoning: timing.reasoning || '',
        prerequisites: timing.prerequisites || []
      }));

      console.log(`✅ 최적 타이밍 결정 완료: ${optimalTimings.length}개 정보`);
      return optimalTimings;
    } catch (error) {
      console.error('❌ 최적 타이밍 결정 실패:', error);
      
      // 폴백: 현재 단계 기반 기본 타이밍
      return this.getDefaultTimingForStage(availableInformation);
    }
  }

  /**
   * 프로액티브 추천 생성
   */
  async generateProactiveRecommendations(
    userContext: any,
    marketConditions: any = {}
  ): Promise<ProactiveRecommendation[]> {
    console.log(`🚀 프로액티브 추천 생성 중`);

    if (!this.currentJourney) {
      return [];
    }

    const recommendationPrompt = this.createRecommendationPrompt(
      this.currentJourney,
      userContext,
      this.userGoals,
      this.constraints,
      marketConditions
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: recommendationPrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '[]';
      const recommendations = JSON.parse(content.replace(/```json|```/g, '').trim());

      const proactiveRecommendations: ProactiveRecommendation[] = recommendations.map((rec: any) => ({
        type: rec.type || 'information',
        title: rec.title,
        description: rec.description,
        priority: rec.priority || 'medium',
        timing: rec.timing || 'soon',
        triggers: rec.triggers || [],
        expectedBenefit: rec.expectedBenefit || ''
      }));

      console.log(`✅ 프로액티브 추천 생성 완료: ${proactiveRecommendations.length}개 추천`);
      return proactiveRecommendations;
    } catch (error) {
      console.error('❌ 프로액티브 추천 생성 실패:', error);
      return [];
    }
  }

  /**
   * 여정 기반 개인화된 인사이트 제공
   */
  async generateJourneyInsights(
    recentActions: string[],
    marketContext: any = {}
  ): Promise<JourneyInsight> {
    console.log(`💡 여정 인사이트 생성 중`);

    if (!this.currentJourney) {
      throw new Error('사용자 여정 정보가 없습니다.');
    }

    const insightPrompt = this.createInsightPrompt(
      this.currentJourney,
      this.journeyHistory,
      recentActions,
      this.userGoals,
      marketContext
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: insightPrompt }],
        temperature: 0.4
      });

      const content = response.choices[0]?.message?.content || '{}';
      const insight = JSON.parse(content.replace(/```json|```/g, '').trim());

      const journeyInsight: JourneyInsight = {
        currentStageAnalysis: insight.currentStageAnalysis || '현재 단계 분석 중입니다.',
        nextStepGuidance: insight.nextStepGuidance || '다음 단계를 준비 중입니다.',
        potentialPitfalls: insight.potentialPitfalls || [],
        opportunityWindows: insight.opportunityWindows || [],
        personalizedAdvice: insight.personalizedAdvice || '개인화된 조언을 준비 중입니다.',
        timelineEstimate: insight.timelineEstimate || '일정을 분석 중입니다.'
      };

      console.log(`✅ 여정 인사이트 생성 완료`);
      return journeyInsight;
    } catch (error) {
      console.error('❌ 여정 인사이트 생성 실패:', error);
      
      return {
        currentStageAnalysis: `현재 ${this.currentJourney.stage} 단계에 있습니다.`,
        nextStepGuidance: '다음 단계 실행을 위한 데이터 분석이 필요합니다.',
        potentialPitfalls: ['데이터 검증 없는 성급한 의사결정'],
        opportunityWindows: ['현재 시장 조건 분석 결과 검토 필요'],
        personalizedAdvice: '개별 데이터 기반 분석 접근 권장.',
        timelineEstimate: '데이터 분석 기준 통상 2-12주 소요.'
      };
    }
  }

  /**
   * LLM 기반 여정 단계 분석
   */
  private async llmAnalyzeJourneyStage(
    userMessage: string,
    conversationHistory: any[],
    userProfile: any,
    behaviorSignals: any
  ): Promise<any> {
    const analysisPrompt = `부동산 구매/투자 여정에서 사용자의 현재 단계를 분석하세요.

사용자 메시지: "${userMessage}"
사용자 프로필: ${JSON.stringify(userProfile)}
행동 신호: ${JSON.stringify(behaviorSignals)}
대화 히스토리: ${conversationHistory.slice(-5).map(h => h.content).join(' / ')}

여정 단계:
1. awareness: 막연한 관심, 시장 탐색 초기
2. research: 구체적 조사, 옵션 비교 
3. evaluation: 세부 분석, 리스크 검토
4. decision: 최종 결정 단계
5. action: 실행 단계 (계약, 대출 등)
6. post_decision: 구매 후 관리

각 단계의 세부 단계와 진행도, 목표, 제약사항을 분석하여 JSON으로 응답하세요:

{
  "stage": "분석된_여정_단계",
  "substage": "세부_단계_설명",
  "progress": 0.0~1.0,
  "timeInStage": 예상_소요시간_분,
  "keyMilestones": ["달성한_마일스톤들"],
  "blockers": ["진행_방해_요소들"],
  "userGoals": ["추출된_사용자_목표들"],
  "constraints": {
    "budget": "예산_제약",
    "timeline": "시간_제약",
    "location": "지역_제약",
    "other": "기타_제약사항"
  },
  "confidence": 0.0~1.0,
  "reasoning": "분석_근거"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 여정 단계 분석 실패:', error);
      return {
        stage: 'awareness',
        substage: 'initial_exploration',
        progress: 0.1,
        timeInStage: 0,
        keyMilestones: [],
        blockers: [],
        userGoals: ['부동산 정보 탐색'],
        constraints: {},
        confidence: 0.3,
        reasoning: '분석 실패로 기본값 적용'
      };
    }
  }

  /**
   * 여정 단계 업데이트
   */
  private updateJourneyStage(analysis: any): JourneyStage {
    const newStage: JourneyStage = {
      stage: analysis.stage || 'awareness',
      substage: analysis.substage || 'initial',
      progress: analysis.progress || 0.1,
      timeInStage: analysis.timeInStage || 0,
      keyMilestones: analysis.keyMilestones || [],
      blockers: analysis.blockers || []
    };

    // 이전 단계를 히스토리에 저장
    if (this.currentJourney && this.currentJourney.stage !== newStage.stage) {
      this.journeyHistory.push({...this.currentJourney});
      console.log(`🔄 여정 단계 전환: ${this.currentJourney.stage} → ${newStage.stage}`);
    }

    this.currentJourney = newStage;
    return newStage;
  }

  /**
   * 사용자 목표와 제약사항 업데이트
   */
  private updateUserGoalsAndConstraints(analysis: any): void {
    if (analysis.userGoals) {
      this.userGoals = [...new Set([...this.userGoals, ...analysis.userGoals])];
    }

    if (analysis.constraints) {
      this.constraints = { ...this.constraints, ...analysis.constraints };
    }
  }

  /**
   * 타이밍 분석 프롬프트 생성
   */
  private createTimingAnalysisPrompt(
    availableInformation: string[],
    currentJourney: JourneyStage,
    userContext: any
  ): string {
    return `부동산 구매 여정에서 정보 제공의 최적 타이밍을 결정하세요.

현재 여정: ${JSON.stringify(currentJourney)}
사용 가능한 정보: ${availableInformation.join(', ')}
사용자 컨텍스트: ${JSON.stringify(userContext)}

각 정보별로 최적 제공 타이밍을 분석하여 JSON 배열로 응답하세요:

[
  {
    "informationType": "정보_유형",
    "idealTiming": "now|soon|later|not_needed",
    "urgency": "low|medium|high|critical", 
    "reasoning": "타이밍_결정_근거",
    "prerequisites": ["선행_조건들"]
  }
]

타이밍 기준:
- now: 즉시 필요한 정보
- soon: 곧 필요할 정보 
- later: 나중에 필요한 정보
- not_needed: 현재 여정에 불필요한 정보

JSON 배열만 응답하세요.`;
  }

  /**
   * 추천 생성 프롬프트 생성
   */
  private createRecommendationPrompt(
    currentJourney: JourneyStage,
    userContext: any,
    userGoals: string[],
    constraints: any,
    marketConditions: any
  ): string {
    return `부동산 분석에서 데이터 기반 프로액티브 추천을 생성하세요.

현재 여정: ${JSON.stringify(currentJourney)}
사용자 목표: ${userGoals.join(', ')}
제약사항: ${JSON.stringify(constraints)}
시장 상황: ${JSON.stringify(marketConditions)}
사용자 컨텍스트: ${JSON.stringify(userContext)}

다음과 같은 추천을 JSON 배열로 생성하세요:

[
  {
    "type": "information|action|caution|opportunity",
    "title": "추천_제목", 
    "description": "추천_설명",
    "priority": "low|medium|high|urgent",
    "timing": "언제_제시할지",
    "triggers": ["추천_트리거_조건들"],
    "expectedBenefit": "기대_효과"
  }
]

추천 유형:
- information: 유용한 정보 제공
- action: 취해야 할 행동
- caution: 주의할 점
- opportunity: 놓치면 안 될 기회

JSON 배열만 응답하세요.`;
  }

  /**
   * 인사이트 생성 프롬프트 생성
   */
  private createInsightPrompt(
    currentJourney: JourneyStage,
    journeyHistory: JourneyStage[],
    recentActions: string[],
    userGoals: string[],
    marketContext: any
  ): string {
    return `부동산 분석에서 데이터 기반 인사이트를 제공하세요.

현재 여정: ${JSON.stringify(currentJourney)}
여정 히스토리: ${JSON.stringify(journeyHistory.slice(-3))}
최근 행동: ${recentActions.join(', ')}
사용자 목표: ${userGoals.join(', ')}
시장 컨텍스트: ${JSON.stringify(marketContext)}

다음 인사이트를 JSON으로 제공하세요:

{
  "currentStageAnalysis": "현재_단계_분석",
  "nextStepGuidance": "다음_단계_가이드",
  "potentialPitfalls": ["잠재적_함정들"],
  "opportunityWindows": ["기회_창구들"], 
  "personalizedAdvice": "개인화된_조언",
  "timelineEstimate": "예상_일정"
}

분석 기준:
- 데이터 기반 여정 진행도와 목표 달성도
- 시장 데이터와 개인 조건의 적합성 분석
- 다음 단계로의 논리적 전환
- 객관적이고 구체적인 데이터 분석

JSON만 응답하세요.`;
  }

  /**
   * 단계별 기본 타이밍 반환
   */
  private getDefaultTimingForStage(availableInformation: string[]): OptimalTiming[] {
    if (!this.currentJourney) return [];

    const stageInfo = this.STAGE_INFO_MAP[this.currentJourney.stage];
    if (!stageInfo) return [];

    return availableInformation.map(info => ({
      informationType: info,
      idealTiming: stageInfo.key_info.includes(info) ? 'now' : 'later',
      urgency: stageInfo.key_info.includes(info) ? 'medium' : 'low',
      reasoning: `${this.currentJourney.stage} 단계에서 기본 우선순위 적용`,
      prerequisites: []
    }));
  }

  /**
   * 사용자 목표 설정
   */
  setUserGoals(goals: string[]): void {
    this.userGoals = goals;
  }

  /**
   * 제약사항 설정
   */
  setConstraints(constraints: Record<string, any>): void {
    this.constraints = constraints;
  }

  /**
   * 선호도 설정
   */
  setPreferences(preferences: Record<string, any>): void {
    this.preferences = preferences;
  }

  /**
   * 현재 여정 상태 반환
   */
  getJourneyState() {
    return {
      currentJourney: this.currentJourney,
      journeyHistory: this.journeyHistory,
      userGoals: this.userGoals,
      constraints: this.constraints,
      preferences: this.preferences
    };
  }

  /**
   * 여정 초기화
   */
  reset(): void {
    this.currentJourney = null;
    this.journeyHistory = [];
    this.userGoals = [];
    this.constraints = {};
    this.preferences = {};
  }
}