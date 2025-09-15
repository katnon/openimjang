// 🧠 OpenImjang AI 3.0 - 자연스러운 대화 흐름 관리자
// 딱딱한 명확화를 자연스러운 대화형 안내로 전환하는 지능형 매니저

import OpenAI from 'openai';

export interface FlowTransition {
  from: string; // 현재 상태
  to: string; // 다음 상태
  trigger: string; // 전환 트리거
  naturalBridge: string; // 자연스러운 연결 문구
  confidence: number; // 전환 확신도
}

export interface ConversationalGuidance {
  guidanceType: 'clarification' | 'suggestion' | 'education' | 'validation';
  naturalPhrase: string; // 자연스러운 표현
  followUpOptions: string[]; // 후속 옵션들
  contextualHints: string[]; // 상황별 힌트
  empathyLevel: 'low' | 'medium' | 'high'; // 공감 수준
}

export interface DialogueFlow {
  currentNode: string; // 현재 대화 노드
  visitedNodes: string[]; // 방문한 노드들
  availableTransitions: FlowTransition[]; // 가능한 전환들
  conversationDepth: number; // 대화 깊이
  userSatisfactionSignals: string[]; // 사용자 만족도 신호들
}

/**
 * 🧠 자연스러운 대화 흐름 관리자
 * 기계적인 질문 대신 자연스럽고 친근한 대화 경험을 제공
 */
export class NaturalFlowManager {
  private openai: OpenAI;
  private dialogueFlow: DialogueFlow;
  private conversationStyle: 'formal' | 'friendly' | 'expert' | 'casual' = 'expert';
  private empathyMode: boolean = false;
  private proactiveGuidance: boolean = true;

  // 대화 흐름 노드 정의
  private readonly FLOW_NODES = {
    GREETING: 'greeting',
    EXPLORATION: 'exploration', 
    SPECIFICATION: 'specification',
    CLARIFICATION: 'clarification',
    INFORMATION_DELIVERY: 'information_delivery',
    COMPARISON: 'comparison',
    DECISION_SUPPORT: 'decision_support',
    WRAP_UP: 'wrap_up'
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

    this.dialogueFlow = {
      currentNode: this.FLOW_NODES.GREETING,
      visitedNodes: [this.FLOW_NODES.GREETING],
      availableTransitions: [],
      conversationDepth: 0,
      userSatisfactionSignals: []
    };
  }

  /**
   * 자연스러운 대화형 가이던스 생성
   */
  async generateNaturalGuidance(
    userMessage: string,
    missingInformation: string[] | any,
    conversationContext: any,
    userProfile: any
  ): Promise<ConversationalGuidance> {
    // missingInformation을 안전하게 배열로 변환
    const missingInfoArray = Array.isArray(missingInformation) 
      ? missingInformation 
      : (missingInformation ? [String(missingInformation)] : []);
    
    console.log(`🌊 자연스러운 가이던스 생성 중: ${missingInfoArray.join(', ')}`);

    // 사용자 메시지에서 감정과 의도 파악
    const emotionalContext = await this.analyzeEmotionalContext(userMessage);
    
    // 자연스러운 가이던스 생성
    const guidance = await this.llmGenerateNaturalGuidance(
      userMessage,
      missingInfoArray,
      conversationContext,
      userProfile,
      emotionalContext
    );

    // 대화 흐름 업데이트
    this.updateDialogueFlow(guidance);

    console.log(`✅ 자연스러운 가이던스 생성 완료: ${guidance.naturalPhrase.substring(0, 100)}...`);
    return guidance;
  }

  /**
   * 대화 전환점에서 자연스러운 브릿지 제공
   */
  async createConversationalBridge(
    fromTopic: string,
    toTopic: string,
    userContext: any
  ): Promise<string> {
    console.log(`🌉 대화 브릿지 생성: ${fromTopic} → ${toTopic}`);

    const bridgePrompt = `부동산 분석에서 화제를 논리적으로 전환하는 브릿지 문구를 생성하세요.

현재 화제: "${fromTopic}"
다음 화제: "${toTopic}"
사용자 컨텍스트: ${JSON.stringify(userContext)}

객관적이고 전문적인 전환 문구를 생성하세요.
- 논리적 연결성
- 분석적 접근
- 정보 제공 중심

예시:
"이와 관련하여 다음 요소도 분석해보겠습니다..." 
"추가로 검토가 필요한 항목은..."
"다음 데이터를 확인해보시기 바랍니다..."

한 문장으로 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: bridgePrompt }],
        temperature: 0.4
      });

      const bridge = response.choices[0]?.message?.content?.trim() || 
        `${toTopic}에 대한 분석도 필요합니다.`;

      console.log(`✅ 대화 브릿지 생성 완료: ${bridge}`);
      return bridge;
    } catch (error) {
      console.error('❌ 대화 브릿지 생성 실패:', error);
      return `${toTopic}에 대한 데이터를 검토하겠습니다.`;
    }
  }

  /**
   * 사용자의 모호한 표현을 자연스럽게 명확화
   */
  async clarifyAmbiguousRequest(
    ambiguousRequest: string,
    possibleInterpretations: string[],
    conversationHistory: any[]
  ): Promise<ConversationalGuidance> {
    console.log(`❓ 모호한 요청 명확화: ${ambiguousRequest}`);

    const clarificationPrompt = `사용자의 모호한 요청을 객관적이고 체계적으로 명확화하세요.

사용자 요청: "${ambiguousRequest}"
가능한 해석: ${possibleInterpretations.join(', ')}
최근 대화: ${conversationHistory.slice(-3).map(h => h.content).join(' / ')}

다음 조건을 만족하는 명확화 응답을 JSON으로 생성하세요:
1. 객관적이고 분석적인 접근
2. 논리적 구조의 질문
3. 구체적인 옵션 제시
4. 전문적인 정보 수집 목적

응답 형식:
{
  "guidanceType": "clarification",
  "naturalPhrase": "자연스럽고 친근한 명확화 문구",
  "followUpOptions": ["옵션1", "옵션2", "옵션3"],
  "contextualHints": ["상황별 힌트들"],
  "empathyLevel": "low"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: clarificationPrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      const guidance = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        guidanceType: 'clarification',
        naturalPhrase: guidance.naturalPhrase || '다음 중 어떤 정보가 필요한지 명시해주시기 바랍니다.',
        followUpOptions: guidance.followUpOptions || possibleInterpretations,
        contextualHints: guidance.contextualHints || [],
        empathyLevel: guidance.empathyLevel || 'low'
      };
    } catch (error) {
      console.error('❌ 모호한 요청 명확화 실패:', error);
      
      // 폴백: 기본 객관적 명확화
      return {
        guidanceType: 'clarification',
        naturalPhrase: '요청사항이 다음과 같이 해석 가능합니다. 해당하는 항목을 선택하시기 바랍니다.',
        followUpOptions: possibleInterpretations,
        contextualHints: ['구체적인 조건을 제시하면 정확한 분석이 가능합니다'],
        empathyLevel: 'low'
      };
    }
  }

  /**
   * 프로액티브 정보 제안 생성
   */
  async generateProactiveSuggestion(
    currentTopic: string,
    userProfile: any,
    conversationContext: any
  ): Promise<ConversationalGuidance | null> {
    if (!this.proactiveGuidance) return null;

    console.log(`🚀 프로액티브 제안 생성: ${currentTopic}`);

    const suggestionPrompt = `부동산 상담에서 사용자에게 도움이 될 프로액티브 제안을 생성하세요.

현재 화제: "${currentTopic}"
사용자 프로필: ${JSON.stringify(userProfile)}
대화 컨텍스트: ${JSON.stringify(conversationContext)}

사용자가 아직 묻지 않았지만 유용할 정보나 제안을 자연스럽게 제안하세요.
- 강요하지 않는 톤
- "혹시 이런 것도..." 형태
- 실제로 도움이 되는 내용

JSON 응답:
{
  "guidanceType": "suggestion",
  "naturalPhrase": "자연스러운 제안 문구",
  "followUpOptions": ["관련 옵션들"],
  "contextualHints": ["도움말"],
  "empathyLevel": "medium"
}

제안할 내용이 없으면 null을 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: suggestionPrompt }],
        temperature: 0.4
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      if (content.toLowerCase() === 'null' || !content) {
        return null;
      }

      const suggestion = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        guidanceType: 'suggestion',
        naturalPhrase: suggestion.naturalPhrase,
        followUpOptions: suggestion.followUpOptions || [],
        contextualHints: suggestion.contextualHints || [],
        empathyLevel: suggestion.empathyLevel || 'medium'
      };
    } catch (error) {
      console.error('❌ 프로액티브 제안 생성 실패:', error);
      return null;
    }
  }

  /**
   * 대화 마무리를 자연스럽게 유도
   */
  async generateWrapUpGuidance(
    conversationSummary: any,
    nextSteps: string[]
  ): Promise<ConversationalGuidance> {
    console.log(`🏁 대화 마무리 가이던스 생성`);

    const wrapUpPrompt = `부동산 상담의 마무리를 자연스럽고 도움이 되게 안내하세요.

대화 요약: ${JSON.stringify(conversationSummary)}
다음 단계: ${nextSteps.join(', ')}

다음을 포함한 마무리 가이던스를 생성하세요:
- 오늘 대화 내용 간단 요약
- 구체적인 다음 액션 가이드
- 추가 도움 제안
- 친근한 마무리 인사

JSON 응답:
{
  "guidanceType": "validation",
  "naturalPhrase": "자연스러운 마무리 문구",
  "followUpOptions": ["다음 단계 옵션들"],
  "contextualHints": ["참고 사항들"],
  "empathyLevel": "high"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: wrapUpPrompt }],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content || '{}';
      const guidance = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        guidanceType: 'validation',
        naturalPhrase: guidance.naturalPhrase || '오늘 말씀 나눈 내용이 도움이 되셨길 바래요. 추가로 궁금한 점이 있으시면 언제든 말씀해 주세요!',
        followUpOptions: guidance.followUpOptions || nextSteps,
        contextualHints: guidance.contextualHints || [],
        empathyLevel: 'high'
      };
    } catch (error) {
      console.error('❌ 마무리 가이던스 생성 실패:', error);
      
      return {
        guidanceType: 'validation',
        naturalPhrase: '오늘 상담이 도움이 되셨길 바래요. 더 궁금한 점이 있으시면 언제든 연락주세요!',
        followUpOptions: nextSteps,
        contextualHints: ['천천히 결정하시길 바랍니다'],
        empathyLevel: 'high'
      };
    }
  }

  /**
   * 사용자 감정 컨텍스트 분석
   */
  private async analyzeEmotionalContext(userMessage: string): Promise<any> {
    const emotionPrompt = `사용자 메시지에서 감정 상태와 니즈를 분석하세요.

메시지: "${userMessage}"

분석할 요소:
- 감정 상태 (불안, 흥미, 급함, 여유 등)
- 결정 확신도
- 도움 필요 수준
- 정보 처리 선호도

JSON으로 응답:
{
  "emotionalState": "감정_상태",
  "confidenceLevel": 0.0~1.0,
  "helpNeed": "low|medium|high",
  "communicationPreference": "detail|summary|interactive"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: emotionPrompt }],
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (error) {
      console.error('❌ 감정 컨텍스트 분석 실패:', error);
      return {
        emotionalState: 'neutral',
        confidenceLevel: 0.5,
        helpNeed: 'medium',
        communicationPreference: 'interactive'
      };
    }
  }

  /**
   * LLM 기반 자연스러운 가이던스 생성
   */
  private async llmGenerateNaturalGuidance(
    userMessage: string,
    missingInformation: string[],
    conversationContext: any,
    userProfile: any,
    emotionalContext: any
  ): Promise<ConversationalGuidance> {
    const guidancePrompt = `부동산 분석에서 객관적이고 체계적인 가이던스를 제공하세요.

사용자 메시지: "${userMessage}"
부족한 정보: ${missingInformation.join(', ')}
감정 컨텍스트: ${JSON.stringify(emotionalContext)}
사용자 프로필: ${JSON.stringify(userProfile)}

다음 원칙을 지켜 가이던스를 생성하세요:
1. 객관적이고 분석적인 접근
2. 전문적인 데이터 수집 중심
3. 논리적 구조의 질문
4. 구체적이고 체계적인 옵션 제시

JSON 응답:
{
  "guidanceType": "clarification|suggestion|education",
  "naturalPhrase": "객관적이고 전문적인 가이던스 문구",
  "followUpOptions": ["후속 옵션들"],
  "contextualHints": ["상황별 도움말"],
  "empathyLevel": "low"
}

JSON만 응답하세요.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: guidancePrompt }],
        temperature: 0.4
      });

      const content = response.choices[0]?.message?.content || '{}';
      const guidance = JSON.parse(content.replace(/```json|```/g, '').trim());

      return {
        guidanceType: guidance.guidanceType || 'clarification',
        naturalPhrase: guidance.naturalPhrase || '다음 정보가 필요합니다.',
        followUpOptions: guidance.followUpOptions || [],
        contextualHints: guidance.contextualHints || [],
        empathyLevel: guidance.empathyLevel || 'low'
      };
    } catch (error) {
      console.error('❌ 자연스러운 가이던스 생성 실패:', error);
      
      return {
        guidanceType: 'clarification',
        naturalPhrase: '다음 정보가 필요합니다.',
        followUpOptions: missingInformation,
        contextualHints: [],
        empathyLevel: 'low'
      };
    }
  }

  /**
   * 대화 흐름 업데이트
   */
  private updateDialogueFlow(guidance: ConversationalGuidance): void {
    // 대화 깊이 증가
    this.dialogueFlow.conversationDepth++;

    // 현재 노드 업데이트
    const newNode = this.determineCurrentNode(guidance);
    if (newNode !== this.dialogueFlow.currentNode) {
      this.dialogueFlow.visitedNodes.push(newNode);
      this.dialogueFlow.currentNode = newNode;
    }

    // 사용자 만족도 신호 감지 (향후 구현)
    this.detectSatisfactionSignals(guidance);
  }

  /**
   * 현재 대화 노드 결정
   */
  private determineCurrentNode(guidance: ConversationalGuidance): string {
    switch (guidance.guidanceType) {
      case 'clarification':
        return this.FLOW_NODES.CLARIFICATION;
      case 'suggestion':
        return this.FLOW_NODES.EXPLORATION;
      case 'education':
        return this.FLOW_NODES.INFORMATION_DELIVERY;
      case 'validation':
        return this.FLOW_NODES.WRAP_UP;
      default:
        return this.FLOW_NODES.EXPLORATION;
    }
  }

  /**
   * 사용자 만족도 신호 감지
   */
  private detectSatisfactionSignals(guidance: ConversationalGuidance): void {
    // 향후 구현: 사용자 응답 패턴을 분석하여 만족도 신호 감지
    // 예: 빠른 응답, 추가 질문, 감사 표현 등
  }

  /**
   * 대화 스타일 설정
   */
  setConversationStyle(style: 'formal' | 'friendly' | 'expert' | 'casual'): void {
    this.conversationStyle = style;
  }

  /**
   * 공감 모드 설정
   */
  setEmpathyMode(enabled: boolean): void {
    this.empathyMode = enabled;
  }

  /**
   * 프로액티브 가이던스 설정
   */
  setProactiveGuidance(enabled: boolean): void {
    this.proactiveGuidance = enabled;
  }

  /**
   * 현재 흐름 상태 반환
   */
  getFlowState() {
    return {
      dialogueFlow: this.dialogueFlow,
      conversationStyle: this.conversationStyle,
      empathyMode: this.empathyMode,
      proactiveGuidance: this.proactiveGuidance
    };
  }

  /**
   * 흐름 초기화
   */
  reset(): void {
    this.dialogueFlow = {
      currentNode: this.FLOW_NODES.GREETING,
      visitedNodes: [this.FLOW_NODES.GREETING],
      availableTransitions: [],
      conversationDepth: 0,
      userSatisfactionSignals: []
    };
  }
}