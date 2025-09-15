// LLM 라이프사이클 관리를 위한 마스터 오케스트레이터

import OpenAI from 'openai';
import { ConversationSession } from './conversationSession';
import { ApartmentInfo } from './apartmentContextManager';

// 서브시스템 imports
import { searchRealEstateDeals } from '../ai/handlers/searchRealEstateDeals';
import { getBuildingInfo } from '../ai/handlers/getBuildingInfo';
import { getLatestTrade } from '../ai/handlers/getLatestTrade';
import { searchNearbyPOI } from '../ai/handlers/searchNearbyPOI';
import { smartApartmentResolver } from './smartApartmentResolver';

// AI 3.0 대화 인텔리전스 매니저 imports
import { ConversationContextTracker } from './ai3/ConversationContextTracker';
import { DialogueStrategyEngine } from './ai3/DialogueStrategyEngine';
import { NaturalFlowManager } from './ai3/NaturalFlowManager';
import { UserJourneyOptimizer } from './ai3/UserJourneyOptimizer';
import { MultiTurnConversationManager } from './ai3/MultiTurnConversationManager';
import { EmotionalContextAnalyzer } from './ai3/EmotionalContextAnalyzer';

// 인코딩 처리 시스템
import { EncodingHandler } from './encodingHandler';

export interface UserIntent {
  category: 'apartment_search' | 'deal_search' | 'building_info' | 'poi_search' | 'general' | 'clarification';
  confidence: number; // 0-1 사이
  entities: {
    apartmentName?: string;
    region?: string;
    dealType?: '매매' | '전세' | '월세';
    area?: number;
    period?: string;
  };
  actions: string[]; // 수행해야 할 작업들
  clarificationNeeded?: {
    field: string;
    reason: string;
    suggestions?: string[];
  };
}

export interface TaskPlan {
  id: string;
  steps: TaskStep[];
  estimatedTime: number;
  priority: 'high' | 'medium' | 'low';
}

export interface TaskStep {
  id: string;
  type: 'slot_check' | 'apartment_resolve' | 'data_fetch' | 'clarify' | 'critique' | 'synthesize';
  action: string;
  dependencies?: string[];
  params?: Record<string, any>;
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  quality?: number; // 0-1 사이, 결과 품질 점수
}

/**
 * LLM 라이프사이클 전반을 관리하는 마스터 오케스트레이터
 * 사용자 의도 분석, 작업 계획, 서브시스템 조정, 응답 생성을 담당
 */
export class LLMMaster {
  private openai: OpenAI;
  private session: ConversationSession;
  
  // AI 3.0 대화 인텔리전스 매니저 인스턴스
  private conversationTracker: ConversationContextTracker;
  private dialogueEngine: DialogueStrategyEngine;
  private flowManager: NaturalFlowManager;
  private journeyOptimizer: UserJourneyOptimizer;
  private multiTurnManager: MultiTurnConversationManager;
  private emotionalAnalyzer: EmotionalContextAnalyzer;

  constructor(session: ConversationSession, openaiApiKey?: string) {
    this.session = session;
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    console.log(`🔑 LLMMaster API Key verification: ${apiKey.length}자, starts with: ${apiKey.substring(0, 10)}...`);
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    
    // AI 3.0 대화 인텔리전스 매니저 초기화 (명시적 API 키 전달)
    this.conversationTracker = new ConversationContextTracker(apiKey);
    this.dialogueEngine = new DialogueStrategyEngine(apiKey);
    this.flowManager = new NaturalFlowManager(apiKey);
    this.journeyOptimizer = new UserJourneyOptimizer(apiKey);
    this.multiTurnManager = new MultiTurnConversationManager(apiKey);
    this.emotionalAnalyzer = new EmotionalContextAnalyzer(apiKey);
  }

  /**
   * 사용자 입력 처리의 메인 엔트리 포인트 (AI 3.0 인텔리전스 전면 적용)
   */
  async processUserInput(userInput: string, attachedImages?: any[], context?: any): Promise<{
    success: boolean;
    reply: string;
    needsClarification?: boolean;
    clarificationField?: string;
    suggestions?: string[];
    metadata?: Record<string, any>;
  }> {
    try {
      // 🔧 Phase 0: 인코딩 복구 처리 (2.0 시스템 방식) - 테스트용 우회
      const processedInput = userInput; // 직접 사용하여 인코딩 처리 우회
      console.log(`🔧 인코딩 처리 우회, 직접 사용: "${processedInput.substring(0, 100)}..."`);

      console.log(`🧠 LLM Master (AI 3.0) 처리 시작: ${processedInput.substring(0, 100)}...`);

      // 🧠 AI 3.0 Phase 1: 대화 컨텍스트 & 감정 분석
      const conversationContext = await this.conversationTracker.analyzeAndUpdateContext(
        processedInput, 
        this.session.getConversationHistory().map(h => ({ content: h.message, role: h.type === 'user' ? 'user' : 'assistant' })),
        {
          currentSlots: this.session.getAllSlots(),
          recentInteractions: this.session.getRecentInteractions(5)
        }
      );
      
      const emotionalContext = await this.emotionalAnalyzer.analyzeEmotionalState(
        processedInput,
        this.session.getConversationHistory().slice(-3).map(h => h.message)
      );
      
      console.log(`🧧 대화 컨텍스트 분석:`, { momentum: conversationContext.conversationMomentum, stage: conversationContext.conversationStage });
      console.log(`😊 감정 분석:`, { emotion: emotionalContext.dominantEmotion, stress: emotionalContext.stressLevel });

      // 1. 사용자 메시지를 세션에 기록 (복구된 텍스트 사용)
      this.session.addUserMessage(processedInput);

      // 2. AI 3.0 강화 의도 분석 (경험 기반)
      const intent = await this.analyzeIntentWithAI3Intelligence(
        processedInput, 
        attachedImages, 
        context, 
        conversationContext, 
        emotionalContext
      );
      console.log(`🎯 AI 3.0 의도 분석 결과:`, intent);

      // 3. 🧠 AI 3.0 자연스러운 플로우 및 전략 결정
      // AI 3.0 대화 전략 결정
      const userProfile = await this.dialogueEngine.detectUserProfile(
        processedInput,
        this.session.getConversationHistory(),
        {
          previousQueries: this.session.getConversationHistory().filter(h => h.type === 'user').slice(-5).map(h => h.message),
          searchPatterns: this.session.getAllSlots()
        }
      );
      
      console.log(`👤 사용자 프로파일 감지:`, userProfile);
      
      if (intent.clarificationNeeded) {
        console.log(`🧠 AI 3.0 자연스러운 가이드 시도...`);
        
        // AI 3.0 자연스러운 플로우를 이용한 자동 해결 시도
        const naturalGuidance = await this.flowManager.generateNaturalGuidance(
          processedInput,
          intent,
          {
            conversationHistory: this.session.getConversationHistory(),
            userProfile,
            currentContext: conversationContext
          }
        );
        
        if (naturalGuidance.canProceedWithoutClarification) {
          console.log(`✅ AI 3.0 자연 가이드로 명확화 없이 진행`);
          intent.clarificationNeeded = undefined;
          // 자연 해석된 엔티티 업데이트
          if (naturalGuidance.inferredEntities) {
            Object.assign(intent.entities, naturalGuidance.inferredEntities);
          }
        } else {
          console.log(`🔄 AI 3.0 여전히 명확화 필요, 공감적 안내 제공`);
          return await this.handleAI3SmartClarification(intent, naturalGuidance, emotionalContext, userProfile);
        }
      }

      // 4. 🧠 AI 3.0 다중 턴 처리 및 여정 최적화
      // 다중 턴 대화 처리
      const conversationTurn = await this.multiTurnManager.processConversationTurn(
        processedInput,
        this.session.getConversationHistory(),
        {
          currentIntent: intent,
          sessionContext: this.session.getAllSlots(),
          userProfile
        }
      );
      
      // 사용자 여정 최적화
      const userJourney = await this.journeyOptimizer.analyzeAndUpdateJourney(
        processedInput,
        intent,
        {
          conversationHistory: this.session.getConversationHistory(),
          completedTasks: this.session.getTaskHistory(),
          userProfile
        }
      );
      
      console.log(`🛍️ 사용자 여정:`, { stage: userJourney.currentStage, progress: userJourney.stageProgress });
      
      const plan = await this.createAI3EnhancedTaskPlan(intent, conversationTurn, userJourney, userProfile);
      console.log(`📋 AI 3.0 작업 계획 수립:`, plan);

      // 5. 작업 실행
      const results = await this.executePlan(plan);
      console.log(`⚙️ 작업 실행 완료: ${results.length}개 단계`);

      // 6. 품질 검증
      const qualityCheck = await this.validateQuality(results, intent);
      console.log(`🔍 품질 검증:`, qualityCheck);

      // 7. 응답 생성
      const response = await this.synthesizeResponse(results, intent, qualityCheck);
      console.log(`📝 응답 생성 완료`);

      // 8. 시스템 응답을 세션에 기록
      this.session.addSystemResponse(response.reply, response.sources, response.confidence);

      // 9. LLM 권한 강화 메타데이터 생성
      const apartmentResolutionResult = results.find(r => r.stepId === 'resolve_apartment');
      const hasLLMGuidance = apartmentResolutionResult?.data?.source === 'llm_guided' || apartmentResolutionResult?.data?.llmFallback === false;
      
      // 🧠 자동 해석 시도 메타데이터 추가 (명확화 전 실행된 경우)
      const autoResolutionAttempted = this.session.getSlot('auto_resolution_attempted')?.value === true;
      
      console.log(`🔍 LLM 메타데이터 생성:`, {
        apartmentResolutionFound: !!apartmentResolutionResult,
        hasLLMGuidance,
        autoResolutionAttempted,
        resultSource: apartmentResolutionResult?.data?.source,
        resultsCount: results.length
      });
      
      return {
        success: true,
        reply: response.reply,
        metadata: {
          ...response.metadata,
          // 🧠 LLM 권한 강화 지표
          llmGuidance: hasLLMGuidance || autoResolutionAttempted,
          multiSourceSearch: apartmentResolutionResult?.data?.alternativesConsidered > 1 || autoResolutionAttempted,
          searchStrategy: apartmentResolutionResult?.data?.searchStrategy || 'attempted_auto_resolution',
          apartmentResolution: apartmentResolutionResult?.data ? {
            normalizedName: apartmentResolutionResult.data.normalizedName,
            searchStrategy: apartmentResolutionResult.data.searchStrategy,
            llmConfidence: apartmentResolutionResult.data.llmConfidence,
            alternativesConsidered: apartmentResolutionResult.data.alternativesConsidered
          } : null,
          processingSteps: results.length > 0 ? results.map(r => ({
            step: r.stepId,
            success: r.success,
            duration: r.executionTime,
            result: r.success ? 'completed' : 'failed'
          })) : [
            {
              step: 'auto_resolution_attempt',
              success: autoResolutionAttempted,
              duration: 0,
              result: autoResolutionAttempted ? 'attempted' : 'skipped'
            }
          ]
        }
      };

    } catch (error: any) {
      console.error('❌ LLM Master 처리 오류:', error);
      
      const errorResponse = "죄송합니다. 요청을 처리하는 중에 문제가 발생했습니다. 다시 시도해 주세요.";
      this.session.addSystemResponse(errorResponse, [], 0.1);
      
      return {
        success: false,
        reply: errorResponse
      };
    }
  }

  /**
   * 사용자 의도 분석
   */
  private async analyzeIntent(userInput: string, attachedImages?: any[], context?: any): Promise<UserIntent> {
    try {
      // 컨텍스트 정보 수집
      const sessionContext = this.session.getContextSummary();
      
      // GPT를 사용한 의도 분석
      const intentAnalysisPrompt = this.createIntentAnalysisPrompt(userInput, sessionContext, attachedImages);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: intentAnalysisPrompt },
          { role: 'user', content: userInput }
        ],
        temperature: 0.1
      });

      const intentText = response.choices[0]?.message?.content || '';
      console.log('🔍 GPT 의도 분석 원본 응답:', intentText.substring(0, 200) + '...');
      
      // 응답에서 구조화된 의도 정보 추출
      const intent = this.parseIntentFromGPT(intentText, userInput, sessionContext);
      console.log('🎯 파싱된 의도 객체:', JSON.stringify(intent, null, 2));
      
      // 현재 의도를 세션에 저장
      this.session.setCurrentIntent(intent.category);
      
      return intent;
      
    } catch (error) {
      console.error('❌ 의도 분석 오류:', error);
      
      // 폴백: 키워드 기반 기본 의도 분석
      return this.fallbackIntentAnalysis(userInput);
    }
  }

  /**
   * 의도 분석용 프롬프트 생성
   */
  private createIntentAnalysisPrompt(userInput: string, sessionContext: any, attachedImages?: any[]): string {
    return `당신은 부동산 상담 AI의 의도 분석 전문가입니다.

사용자 입력을 분석하여 다음 정보를 파악하세요:

**분석 대상:**
- 사용자 입력: "${userInput}"
- 대화 히스토리: ${sessionContext.recentMessages.length}개 메시지
- 현재 아파트 컨텍스트: ${sessionContext.apartments.map(a => a.name).join(', ') || '없음'}
- 첨부 이미지: ${attachedImages?.length || 0}개

**분석 카테고리:**
1. apartment_search: 아파트 찾기, 위치 확인
2. deal_search: 실거래가, 매매/전세/월세 정보 검색
3. building_info: 건물 정보, 세대수, 층수 등
4. poi_search: 주변 편의시설, 교통 정보
5. general: 일반 상담, 추천 요청
6. clarification: 불명확한 질문으로 추가 정보 필요

**응답 형식 (JSON):**
{
  "category": "분석된_카테고리",
  "confidence": 0.0~1.0,
  "entities": {
    "apartmentName": "추출된_아파트명",
    "region": "지역명",
    "dealType": "매매|전세|월세",
    "area": 면적(숫자),
    "period": "기간"
  },
  "actions": ["수행할_작업_목록"],
  "clarificationNeeded": {
    "field": "명확화_필요_필드",
    "reason": "명확화_이유",
    "suggestions": ["제안_목록"]
  }
}

**명확화 필요 조건 (매우 제한적으로 적용):**
- 지역과 아파트명이 모두 없는 경우만
- 모호한 지시어("그 아파트", "거기" 등)인데 컨텍스트 없음
- 브랜드명(래미안, 힐스테이트 등) + 지역이 있으면 충분한 정보임

**예시:**
- "잠실 래미안 아파트 84평 매매가" → deal_search (충분한 정보)
- "강남 아파트 시세" → deal_search (충분한 정보)
- "아파트 가격 알려주세요" → clarification (정보 부족)

JSON 형식으로만 응답하세요.`;
  }

  /**
   * GPT 응답에서 의도 정보 파싱
   */
  private parseIntentFromGPT(intentText: string, userInput: string, sessionContext: any): UserIntent {
    try {
      // JSON 파싱 시도
      const cleanJson = intentText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      return {
        category: parsed.category || 'general',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        actions: parsed.actions || [],
        clarificationNeeded: parsed.clarificationNeeded
      };
    } catch (error) {
      console.error('❌ GPT 응답 파싱 실패, 폴백 사용:', error);
      return this.fallbackIntentAnalysis(userInput);
    }
  }

  /**
   * 폴백 의도 분석 (키워드 기반)
   */
  private fallbackIntentAnalysis(userInput: string): UserIntent {
    const input = userInput.toLowerCase();
    
    // 키워드 매칭
    if (input.includes('시세') || input.includes('거래가') || input.includes('매매') || input.includes('전세') || input.includes('월세')) {
      return {
        category: 'deal_search',
        confidence: 0.7,
        entities: {},
        actions: ['search_deals']
      };
    }
    
    if (input.includes('건물정보') || input.includes('세대수') || input.includes('층수') || input.includes('건물')) {
      return {
        category: 'building_info',
        confidence: 0.7,
        entities: {},
        actions: ['get_building_info']
      };
    }
    
    if (input.includes('주변') || input.includes('편의시설') || input.includes('교통')) {
      return {
        category: 'poi_search',
        confidence: 0.7,
        entities: {},
        actions: ['search_poi']
      };
    }
    
    return {
      category: 'general',
      confidence: 0.5,
      entities: {},
      actions: ['general_response']
    };
  }

  /**
   * 명확화 처리
   */
  private async handleClarification(intent: UserIntent): Promise<{
    success: boolean;
    reply: string;
    needsClarification: boolean;
    clarificationField: string;
    suggestions?: string[];
  }> {
    const clarification = intent.clarificationNeeded!;
    
    let clarificationMessage = "";
    
    switch (clarification.field) {
      case 'apartment_location':
        clarificationMessage = `어느 지역의 ${intent.entities.apartmentName || '아파트'}를 말씀하시는 걸까요?`;
        break;
      case 'deal_type':
        clarificationMessage = "매매, 전세, 월세 중 어떤 거래 정보가 궁금하신가요?";
        break;
      case 'apartment_name':
        clarificationMessage = "구체적으로 어떤 아파트에 대해 알고 싶으신가요?";
        break;
      default:
        clarificationMessage = `${clarification.reason}에 대해 더 구체적으로 말씀해 주시겠어요?`;
    }
    
    // 명확화 상태를 세션에 저장
    this.session.setSlot('clarification_pending', {
      field: clarification.field,
      originalIntent: intent,
      timestamp: new Date()
    }, 1.0, 'system_inferred');
    
    return {
      success: true,
      reply: clarificationMessage,
      needsClarification: true,
      clarificationField: clarification.field,
      suggestions: clarification.suggestions
    };
  }

  /**
   * 작업 계획 수립
   */
  private async createTaskPlan(intent: UserIntent): Promise<TaskPlan> {
    const steps: TaskStep[] = [];
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // 의도에 따른 작업 단계 생성
    switch (intent.category) {
      case 'apartment_search':
        steps.push({
          id: 'resolve_apartment',
          type: 'apartment_resolve',
          action: 'resolve_apartment_info',
          params: { apartmentName: intent.entities.apartmentName }
        });
        break;
        
      case 'deal_search':
        steps.push(
          {
            id: 'resolve_apartment',
            type: 'apartment_resolve',
            action: 'resolve_apartment_info',
            params: { apartmentName: intent.entities.apartmentName }
          },
          {
            id: 'search_deals',
            type: 'data_fetch',
            action: 'search_real_estate_deals',
            dependencies: ['resolve_apartment'],
            params: {
              dealType: intent.entities.dealType,
              area: intent.entities.area,
              period: intent.entities.period
            }
          }
        );
        break;
        
      case 'building_info':
        steps.push(
          {
            id: 'resolve_apartment',
            type: 'apartment_resolve',
            action: 'resolve_apartment_info',
            params: { apartmentName: intent.entities.apartmentName }
          },
          {
            id: 'get_building_info',
            type: 'data_fetch',
            action: 'get_building_info',
            dependencies: ['resolve_apartment']
          }
        );
        break;
        
      case 'poi_search':
        steps.push(
          {
            id: 'resolve_apartment',
            type: 'apartment_resolve',
            action: 'resolve_apartment_info',
            params: { apartmentName: intent.entities.apartmentName }
          },
          {
            id: 'search_poi',
            type: 'data_fetch',
            action: 'search_nearby_poi',
            dependencies: ['resolve_apartment']
          }
        );
        break;
        
      default:
        steps.push({
          id: 'general_response',
          type: 'synthesize',
          action: 'generate_general_response'
        });
    }
    
    // 품질 검증 단계 추가 (마지막에)
    if (steps.length > 1) {
      steps.push({
        id: 'quality_check',
        type: 'critique',
        action: 'validate_results',
        dependencies: steps.slice(-2, -1).map(s => s.id)
      });
    }
    
    return {
      id: planId,
      steps,
      estimatedTime: steps.length * 2000, // 단계당 2초 추정
      priority: this.calculatePriority(intent)
    };
  }

  /**
   * 작업 계획 실행
   */
  private async executePlan(plan: TaskPlan): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const stepResults = new Map<string, any>();
    
    for (const step of plan.steps) {
      // 의존성 체크
      if (step.dependencies) {
        const depsSatisfied = step.dependencies.every(dep => 
          results.find(r => r.stepId === dep && r.success)
        );
        
        if (!depsSatisfied) {
          results.push({
            stepId: step.id,
            success: false,
            error: '의존성 충족되지 않음',
            executionTime: 0
          });
          continue;
        }
      }
      
      const startTime = Date.now();
      
      try {
        let result: any;
        
        switch (step.action) {
          case 'resolve_apartment_info':
            result = await this.executeApartmentResolve(step.params, stepResults);
            break;
          case 'search_real_estate_deals':
            result = await this.executeDealsSearch(step.params, stepResults);
            break;
          case 'get_building_info':
            result = await this.executeBuildingInfo(step.params, stepResults);
            break;
          case 'search_nearby_poi':
            result = await this.executePOISearch(step.params, stepResults);
            break;
          case 'generate_general_response':
            result = await this.executeGeneralResponse(step.params, stepResults);
            break;
          case 'validate_results':
            result = await this.executeQualityValidation(stepResults);
            break;
          default:
            throw new Error(`알 수 없는 작업: ${step.action}`);
        }
        
        const executionTime = Date.now() - startTime;
        
        const executionResult: ExecutionResult = {
          stepId: step.id,
          success: true,
          data: result,
          executionTime,
          quality: this.assessResultQuality(result)
        };
        
        results.push(executionResult);
        stepResults.set(step.id, result);
        
        // 작업 실행을 세션에 기록
        this.session.recordTaskExecution({
          taskId: step.id,
          taskType: step.type as any,
          input: step.params,
          output: result,
          success: true,
          executionTime
        });
        
      } catch (error: any) {
        const executionTime = Date.now() - startTime;
        
        const executionResult: ExecutionResult = {
          stepId: step.id,
          success: false,
          error: error.message,
          executionTime
        };
        
        results.push(executionResult);
        
        // 실패한 작업도 세션에 기록
        this.session.recordTaskExecution({
          taskId: step.id,
          taskType: step.type as any,
          input: step.params,
          output: null,
          success: false,
          executionTime
        });
      }
    }
    
    return results;
  }

  /**
   * 🧠 LLM 주도 아파트 해석 실행 (권한 확대)
   */
  private async executeApartmentResolve(params: any, stepResults: Map<string, any>): Promise<any> {
    try {
      // 세션에서 기존 아파트 정보 확인
      const sessionApartments = this.session.findApartments(params.apartmentName || '');
      
      if (sessionApartments.length > 0) {
        return {
          apartment: sessionApartments[0],
          source: 'session_cache',
          llmConfidence: 0.9
        };
      }
      
      console.log(`🧠 LLM 자동 아파트 해석 시작: "${params.apartmentName}"`);
      
      // 1단계: LLM이 아파트명 정규화 및 해석
      const normalizedInfo = await this.llmNormalizeApartmentName(params.apartmentName, params.region);
      console.log(`📝 LLM 정규화 결과:`, normalizedInfo);
      
      // 2단계: LLM이 최적의 검색 전략 결정
      const searchStrategy = await this.llmDetermineSearchStrategy(normalizedInfo);
      console.log(`🎯 LLM 검색 전략:`, searchStrategy);
      
      // 3단계: LLM 지시에 따라 다중 검색 실행
      const resolutionResults = await this.llmGuidedMultiSearch(normalizedInfo, searchStrategy);
      console.log(`🔍 LLM 가이드 검색 완료:`, resolutionResults.length, '개 결과');
      
      // 4단계: LLM이 최종 결과 평가 및 선택
      const finalResult = await this.llmEvaluateAndSelectBest(resolutionResults, params.apartmentName);
      console.log(`✅ LLM 최종 선택:`, finalResult?.selectedApartment?.name || 'None');
      
      if (finalResult?.selectedApartment) {
        // 세션에 아파트 정보 저장
        this.session.addApartment({
          id: finalResult.selectedApartment.id || `apt_${Date.now()}`,
          name: finalResult.selectedApartment.name,
          address: finalResult.selectedApartment.address || finalResult.selectedApartment.jibun_address,
          source: 'llm_guided' as any
        });
        
        return {
          apartment: finalResult.selectedApartment,
          source: 'llm_guided',
          llmConfidence: finalResult.confidence,
          searchStrategy: searchStrategy.strategy,
          alternativesConsidered: resolutionResults.length
        };
      }
      
      // 폴백: 기존 SmartApartmentResolver 사용 (LLM 실패시)
      console.log(`⚠️ LLM 가이드 검색 실패, SmartApartmentResolver 폴백`);
      const fallbackResolution = await smartApartmentResolver.resolveApartment(
        params.apartmentName || '',
        params.region
      );
      
      if (fallbackResolution.apartment) {
        this.session.addApartment({
          id: fallbackResolution.apartment.id,
          name: fallbackResolution.apartment.name,
          address: fallbackResolution.apartment.address,
          source: 'fallback_resolver' as any
        });
      }
      
      return {
        ...fallbackResolution,
        llmFallback: true
      };
      
    } catch (error: any) {
      console.error('❌ LLM 아파트 해석 오류:', error.message);
      
      // 최종 폴백
      return {
        apartment: null,
        source: 'error',
        error: error.message,
        llmConfidence: 0.1
      };
    }
  }

  /**
   * 실거래 검색 실행
   */
  private async executeDealsSearch(params: any, stepResults: Map<string, any>): Promise<any> {
    const apartmentData = stepResults.get('resolve_apartment');
    
    if (!apartmentData?.apartment) {
      throw new Error('아파트 정보가 필요합니다');
    }
    
    const result = await searchRealEstateDeals({
      apartmentName: apartmentData.apartment.name,
      aptId: apartmentData.apartment.id,
      dealType: params.dealType || '매매',
      area: params.area,
      period: params.period,
      limit: 10
    });
    
    return result;
  }

  /**
   * 건물 정보 조회 실행
   */
  private async executeBuildingInfo(params: any, stepResults: Map<string, any>): Promise<any> {
    const apartmentData = stepResults.get('resolve_apartment');
    
    if (!apartmentData?.apartment) {
      throw new Error('아파트 정보가 필요합니다');
    }
    
    const result = await getBuildingInfo({
      query: `${apartmentData.apartment.name} 건물정보`,
      attachedApartments: [apartmentData.apartment]
    });
    
    return result;
  }

  /**
   * POI 검색 실행
   */
  private async executePOISearch(params: any, stepResults: Map<string, any>): Promise<any> {
    const apartmentData = stepResults.get('resolve_apartment');
    
    if (!apartmentData?.apartment) {
      throw new Error('아파트 정보가 필요합니다');
    }
    
    const result = await searchNearbyPOI({
      contextAptData: {
        name: apartmentData.apartment.name,
        address: apartmentData.apartment.address,
        lat: apartmentData.apartment.lat,
        lng: apartmentData.apartment.lng
      }
    });
    
    return result;
  }

  /**
   * 일반 응답 생성
   */
  private async executeGeneralResponse(params: any, stepResults: Map<string, any>): Promise<any> {
    return {
      message: "안녕하세요! 부동산 관련하여 궁금한 것이 있으시면 언제든 말씀해 주세요.",
      type: 'general'
    };
  }

  /**
   * 품질 검증 실행
   */
  private async executeQualityValidation(stepResults: Map<string, any>): Promise<any> {
    const allResults = Array.from(stepResults.values());
    
    // 간단한 품질 점수 계산
    const dataQuality = allResults.filter(r => r && typeof r === 'object' && Object.keys(r).length > 0).length;
    const totalResults = allResults.length;
    
    return {
      qualityScore: totalResults > 0 ? dataQuality / totalResults : 0,
      hasData: dataQuality > 0,
      recommendation: dataQuality > totalResults * 0.7 ? 'good' : 'needs_improvement'
    };
  }

  /**
   * 품질 검증
   */
  private async validateQuality(results: ExecutionResult[], intent: UserIntent): Promise<{
    overallQuality: number;
    issues: string[];
    recommendations: string[];
  }> {
    const successRate = results.filter(r => r.success).length / results.length;
    const avgQuality = results
      .filter(r => r.quality !== undefined)
      .reduce((acc, r) => acc + r.quality!, 0) / results.length || 0;
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 품질 이슈 감지
    if (successRate < 0.7) {
      issues.push('작업 성공률이 낮습니다');
      recommendations.push('다른 접근 방법을 시도해보세요');
    }
    
    if (avgQuality < 0.5) {
      issues.push('데이터 품질이 낮습니다');
      recommendations.push('더 구체적인 조건을 제공해주세요');
    }
    
    return {
      overallQuality: (successRate + avgQuality) / 2,
      issues,
      recommendations
    };
  }

  /**
   * 최종 응답 생성
   */
  private async synthesizeResponse(
    results: ExecutionResult[], 
    intent: UserIntent, 
    qualityCheck: any
  ): Promise<{
    reply: string;
    confidence: number;
    sources: string[];
    metadata: Record<string, any>;
  }> {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        reply: "죄송합니다. 요청하신 정보를 처리할 수 없었습니다. 다시 시도해 주세요.",
        confidence: 0.1,
        sources: [],
        metadata: { quality: qualityCheck }
      };
    }
    
    // GPT를 사용한 자연어 응답 생성
    const responsePrompt = this.createResponsePrompt(successfulResults, intent, qualityCheck);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: responsePrompt },
          { role: 'user', content: '위 정보를 바탕으로 사용자에게 친근하고 도움이 되는 응답을 생성해주세요.' }
        ],
        temperature: 0.3
      });
      
      const reply = response.choices[0]?.message?.content || '응답 생성에 실패했습니다.';
      
      return {
        reply,
        confidence: qualityCheck.overallQuality || 0.5,
        sources: successfulResults.map(r => r.stepId),
        metadata: {
          executedSteps: results.length,
          successfulSteps: successfulResults.length,
          quality: qualityCheck,
          intent: intent.category
        }
      };
      
    } catch (error) {
      console.error('❌ 응답 생성 오류:', error);
      
      // 폴백: 구조화된 응답 생성
      return this.generateStructuredResponse(successfulResults, intent);
    }
  }

  /**
   * 응답 생성용 프롬프트 작성
   */
  private createResponsePrompt(results: ExecutionResult[], intent: UserIntent, qualityCheck: any): string {
    const dataContext = results.map(r => ({
      step: r.stepId,
      data: r.data
    }));
    
    return `당신은 친근하고 전문적인 부동산 상담사입니다.

**사용자 의도:** ${intent.category}
**실행 결과:** ${JSON.stringify(dataContext, null, 2)}
**품질 점수:** ${qualityCheck.overallQuality}

**응답 작성 지침:**
1. 전문적이지만 이해하기 쉬운 한국어로 작성
2. 구체적인 데이터가 있으면 표나 목록으로 정리
3. 사용자에게 도움이 되는 추가 조언 포함
4. 데이터 품질이 낮으면 한계 명시
5. 후속 질문을 유도하는 마무리

**금지사항:**
- 데이터에 없는 내용 추측하지 말기
- 투자 조언이나 추천은 신중하게
- 과도한 기술 용어 사용 금지`;
  }

  /**
   * 구조화된 응답 생성 (폴백)
   */
  private generateStructuredResponse(results: ExecutionResult[], intent: UserIntent): {
    reply: string;
    confidence: number;
    sources: string[];
    metadata: Record<string, any>;
  } {
    let reply = "";
    
    // 의도에 따른 기본 응답 구성
    switch (intent.category) {
      case 'deal_search':
        const dealData = results.find(r => r.stepId === 'search_deals')?.data;
        if (dealData?.deals?.length > 0) {
          reply = `실거래 정보 ${dealData.deals.length}건을 찾았습니다.\n\n`;
          dealData.deals.slice(0, 3).forEach((deal: any, idx: number) => {
            reply += `${idx + 1}. ${deal.dealDate || deal.deal_year} - ${deal.dealAmount || deal.deal_amount}만원\n`;
          });
        } else {
          reply = "실거래 정보를 찾을 수 없습니다.";
        }
        break;
        
      case 'building_info':
        const buildingData = results.find(r => r.stepId === 'get_building_info')?.data;
        if (buildingData?.success) {
          reply = `건물 정보를 찾았습니다.\n\n총 ${buildingData.totalCount || 0}개의 건물 정보가 있습니다.`;
        } else {
          reply = "건물 정보를 찾을 수 없습니다.";
        }
        break;
        
      default:
        reply = "요청하신 정보를 처리했습니다.";
    }
    
    return {
      reply,
      confidence: 0.6,
      sources: results.map(r => r.stepId),
      metadata: { fallback: true }
    };
  }

  /**
   * 우선순위 계산
   */
  private calculatePriority(intent: UserIntent): 'high' | 'medium' | 'low' {
    if (intent.confidence > 0.8) return 'high';
    if (intent.confidence > 0.5) return 'medium';
    return 'low';
  }

  /**
   * 🧠 LLM 아파트명 정규화 및 해석
   */
  private async llmNormalizeApartmentName(apartmentName: string, region?: string): Promise<{
    originalName: string;
    normalizedName: string;
    possibleVariations: string[];
    regionInfo: {
      explicit: string | null;
      inferred: string[];
    };
    ambiguityLevel: 'low' | 'medium' | 'high';
    suggestedQuestions: string[];
  }> {
    const prompt = `당신은 한국 부동산 아파트명 정규화 전문가입니다.

사용자 입력을 분석하여 다음을 수행하세요:

**입력:**
- 아파트명: "${apartmentName}"
- 지역 힌트: "${region || '없음'}"

**분석 항목:**
1. 아파트명 정규화 (띄어쓰기, 표기법 통일)
2. 가능한 변형 버전들 (예: 은마 → 은마아파트, 은마APT)
3. 지역 정보 추출 (명시적/추론적)
4. 모호성 수준 평가
5. 명확화 질문 제안

**응답 형식 (JSON):**
{
  "originalName": "입력된_원본명",
  "normalizedName": "정규화된_아파트명",
  "possibleVariations": ["변형1", "변형2", "변형3"],
  "regionInfo": {
    "explicit": "명시적_지역명_또는_null",
    "inferred": ["추론_가능한_지역들"]
  },
  "ambiguityLevel": "low|medium|high",
  "suggestedQuestions": ["명확화_질문들"]
}

**한국 아파트명 특성:**
- 공통명: 현대, 삼성, 대우, 한양 등
- 지역명 포함: 강남현대, 분당삼성 등
- 접미사: 아파트, APT, 타워 등

JSON만 응답하세요.`;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      return {
        originalName: parsed.originalName || apartmentName,
        normalizedName: parsed.normalizedName || apartmentName,
        possibleVariations: parsed.possibleVariations || [apartmentName],
        regionInfo: parsed.regionInfo || { explicit: null, inferred: [] },
        ambiguityLevel: parsed.ambiguityLevel || 'medium',
        suggestedQuestions: parsed.suggestedQuestions || []
      };
      
    } catch (error: any) {
      console.error('❌ LLM 정규화 실패:', error.message);
      
      // 폴백: 기본 정규화
      return {
        originalName: apartmentName,
        normalizedName: apartmentName.trim().replace(/\s+/g, ' '),
        possibleVariations: [
          apartmentName,
          apartmentName.replace(/아파트$|APT$/i, ''),
          apartmentName + '아파트'
        ],
        regionInfo: { explicit: region || null, inferred: [] },
        ambiguityLevel: 'high',
        suggestedQuestions: ['어느 지역의 아파트를 말씀하시는 건가요?']
      };
    }
  }
  
  /**
   * 🧠 LLM 검색 전략 결정
   */
  private async llmDetermineSearchStrategy(normalizedInfo: any): Promise<{
    strategy: 'direct' | 'variations' | 'fuzzy' | 'regional' | 'comprehensive';
    priority: ('db' | 'vector' | 'web')[];
    searchTerms: string[];
    confidence: number;
    reasoning: string;
  }> {
    const prompt = `당신은 한국 부동산 검색 전략 전문가입니다.

주어진 정보를 바탕으로 최적의 아파트 검색 전략을 결정하세요:

**입력 정보:**
${JSON.stringify(normalizedInfo, null, 2)}

**검색 전략 옵션:**
1. **direct**: 정확한 매칭 우선
2. **variations**: 다양한 표기법 시도
3. **fuzzy**: 유사도 기반 검색
4. **regional**: 지역 기반 필터링
5. **comprehensive**: 모든 방법 조합

**검색 소스 우선순위:**
- db: 데이터베이스 직접 검색
- vector: 벡터 유사도 검색
- web: 웹 검색 API

**응답 형식 (JSON):**
{
  "strategy": "선택된_전략",
  "priority": ["검색_소스_우선순위"],
  "searchTerms": ["실제_사용할_검색어들"],
  "confidence": 0.0~1.0,
  "reasoning": "전략_선택_이유"
}

**결정 기준:**
- 모호성 높음 → comprehensive
- 지역 정보 명확 → regional
- 일반적인 아파트명 → variations
- 구체적인 이름 → direct

JSON만 응답하세요.`;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      return {
        strategy: parsed.strategy || 'comprehensive',
        priority: parsed.priority || ['db', 'vector', 'web'],
        searchTerms: parsed.searchTerms || normalizedInfo.possibleVariations,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'Default comprehensive search'
      };
      
    } catch (error: any) {
      console.error('❌ LLM 전략 결정 실패:', error.message);
      
      // 폴백: 안전한 기본 전략
      return {
        strategy: 'comprehensive',
        priority: ['db', 'vector'],
        searchTerms: normalizedInfo.possibleVariations.slice(0, 3),
        confidence: 0.3,
        reasoning: 'Fallback strategy due to LLM error'
      };
    }
  }
  
  /**
   * 🧠 LLM 가이드 다중 검색 실행
   */
  private async llmGuidedMultiSearch(normalizedInfo: any, strategy: any): Promise<any[]> {
    const results: any[] = [];
    
    for (const source of strategy.priority) {
      console.log(`🔍 ${source} 검색 실행 중...`);
      
      try {
        let sourceResults: any[] = [];
        
        switch (source) {
          case 'db':
            for (const term of strategy.searchTerms.slice(0, 2)) {
              const dbResult = await smartApartmentResolver.searchApartmentByDirectDB(term);
              if (dbResult.apartments?.length > 0) {
                sourceResults.push(...dbResult.apartments.map((apt: any) => ({
                  ...apt,
                  source: 'db',
                  searchTerm: term,
                  confidence: this.calculateMatchConfidence(term, apt.name)
                })));
              }
            }
            break;
            
          case 'vector':
            const vectorResult = await smartApartmentResolver.searchApartmentByVector(
              strategy.searchTerms[0] || normalizedInfo.normalizedName
            );
            if (vectorResult.apartments?.length > 0) {
              sourceResults.push(...vectorResult.apartments.map((apt: any) => ({
                ...apt,
                source: 'vector',
                searchTerm: strategy.searchTerms[0],
                confidence: apt.similarity || 0.5
              })));
            }
            break;
            
          case 'web':
            const webResult = await smartApartmentResolver.searchApartmentByWeb(
              `${strategy.searchTerms[0]} 아파트`,
              normalizedInfo.regionInfo.explicit
            );
            if (webResult.apartments?.length > 0) {
              sourceResults.push(...webResult.apartments.map((apt: any) => ({
                ...apt,
                source: 'web',
                searchTerm: strategy.searchTerms[0] + ' 아파트',
                confidence: 0.7
              })));
            }
            break;
        }
        
        results.push(...sourceResults);
        
        // 충분한 결과가 있으면 조기 종료
        if (results.length >= 5 && strategy.confidence > 0.7) {
          console.log(`✅ 충분한 결과 확보 (${results.length}개), 조기 종료`);
          break;
        }
        
      } catch (error: any) {
        console.error(`❌ ${source} 검색 실패:`, error.message);
        continue;
      }
    }
    
    return results;
  }
  
  /**
   * 🧠 LLM 최종 결과 평가 및 선택
   */
  private async llmEvaluateAndSelectBest(results: any[], originalQuery: string): Promise<{
    selectedApartment: any;
    confidence: number;
    reasoning: string;
    alternativesCount: number;
  } | null> {
    if (results.length === 0) {
      return null;
    }
    
    // 중복 제거 (이름과 주소 기준)
    const uniqueResults = this.deduplicateApartments(results);
    console.log(`📊 중복 제거: ${results.length} → ${uniqueResults.length}`);
    
    if (uniqueResults.length === 1) {
      return {
        selectedApartment: uniqueResults[0],
        confidence: uniqueResults[0].confidence || 0.8,
        reasoning: 'Single unique result found',
        alternativesCount: 0
      };
    }
    
    const prompt = `당신은 한국 부동산 아파트 매칭 전문가입니다.

사용자가 검색한 "${originalQuery}"에 대해 가장 적합한 아파트를 선택하세요:

**후보 아파트들:**
${uniqueResults.map((apt, idx) => `${idx + 1}. ${apt.name} (${apt.jibun_address || apt.address || '주소불명'}) - 출처: ${apt.source}, 신뢰도: ${apt.confidence}`).join('\n')}

**선택 기준:**
1. 이름 유사도 (가장 중요)
2. 주소/지역 일치도
3. 데이터 출처 신뢰도 (db > vector > web)
4. 메타데이터 완성도

**응답 형식 (JSON):**
{
  "selectedIndex": 선택된_인덱스(0부터_시작),
  "confidence": 0.0~1.0,
  "reasoning": "선택_이유_상세_설명"
}

**주의사항:**
- 정확한 이름 매칭을 최우선
- 공통 아파트명(현대, 삼성)은 지역 정보 필수
- 데이터 품질도 중요한 요소

JSON만 응답하세요.`;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      const cleanJson = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const selectedIndex = parsed.selectedIndex;
      if (selectedIndex >= 0 && selectedIndex < uniqueResults.length) {
        return {
          selectedApartment: uniqueResults[selectedIndex],
          confidence: parsed.confidence || 0.6,
          reasoning: parsed.reasoning || 'LLM selection',
          alternativesCount: uniqueResults.length - 1
        };
      }
      
      // 잘못된 인덱스인 경우 첫 번째 결과 반환
      return {
        selectedApartment: uniqueResults[0],
        confidence: 0.5,
        reasoning: 'Invalid LLM selection, fallback to first result',
        alternativesCount: uniqueResults.length - 1
      };
      
    } catch (error: any) {
      console.error('❌ LLM 결과 평가 실패:', error.message);
      
      // 폴백: 가장 높은 신뢰도의 결과 선택
      const bestResult = uniqueResults.reduce((best, current) => 
        (current.confidence || 0) > (best.confidence || 0) ? current : best
      );
      
      return {
        selectedApartment: bestResult,
        confidence: bestResult.confidence || 0.4,
        reasoning: 'Fallback: highest confidence result',
        alternativesCount: uniqueResults.length - 1
      };
    }
  }
  
  /**
   * 매칭 신뢰도 계산
   */
  private calculateMatchConfidence(searchTerm: string, apartmentName: string): number {
    const search = searchTerm.toLowerCase().trim();
    const name = apartmentName.toLowerCase().trim();
    
    // 정확한 매칭
    if (search === name) return 1.0;
    
    // 포함 관계
    if (name.includes(search) || search.includes(name)) return 0.8;
    
    // 단어 레벨 유사도
    const searchWords = search.split(/\s+/);
    const nameWords = name.split(/\s+/);
    const commonWords = searchWords.filter(word => nameWords.some(nw => nw.includes(word)));
    
    if (commonWords.length > 0) {
      return 0.4 + (commonWords.length / Math.max(searchWords.length, nameWords.length)) * 0.4;
    }
    
    return 0.2;
  }
  
  /**
   * 아파트 중복 제거
   */
  private deduplicateApartments(apartments: any[]): any[] {
    const seen = new Set();
    const unique: any[] = [];
    
    for (const apt of apartments) {
      const key = `${apt.name}_${apt.jibun_address || apt.address || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(apt);
      }
    }
    
    // 신뢰도 순으로 정렬
    return unique.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }

  /**
   * 결과 품질 평가
   */
  private assessResultQuality(result: any): number {
    if (!result) return 0;
    
    // 기본 품질 점수
    let quality = 0.5;
    
    // 성공 여부
    if (result.success) quality += 0.3;
    
    // 데이터 존재 여부
    if (result.data || result.deals || result.pois) quality += 0.2;
    
    // 데이터 개수 (타입 안전성을 위한 명시적 체크)
    let dataCount = 0;
    if (result.deals && Array.isArray(result.deals)) {
      dataCount = result.deals.length;
    } else if (result.pois && Array.isArray(result.pois)) {
      dataCount = result.pois.length;
    } else if (typeof result.totalCount === 'number') {
      dataCount = result.totalCount;
    }
    
    if (dataCount > 0) quality = Math.min(quality + 0.1, 1.0);
    
    return quality;
  }
  
  /**
   * AI 3.0 강화된 의도 분석 (경험 기반 컨텍스트 고려)
   */
  private async analyzeIntentWithAI3Intelligence(
    userInput: string, 
    attachedImages: any[] = [], 
    context: any = {},
    conversationContext: any,
    emotionalContext: any
  ): Promise<UserIntent> {
    try {
      // 기본 의도 분석 실행
      const baseIntent = await this.analyzeIntent(userInput, attachedImages, context);
      
      // AI 3.0 강화: 컨텍스트 및 감정 고려
      if (conversationContext.conversationMomentum === 'increasing' || emotionalContext.decisionReadiness > 0.6) {
        // 대화 모멘텀이 좋고 결정 준비도가 높으면 신룰도 상향
        baseIntent.confidence = Math.min(baseIntent.confidence + 0.2, 1.0);
        
        // 명확화 필요성 재검토
        if (baseIntent.clarificationNeeded && baseIntent.confidence > 0.7) {
          console.log(`🧠 AI 3.0: 높은 컨텍스트 신룰도로 명확화 무시`);
          baseIntent.clarificationNeeded = undefined;
        }
      }
      
      return baseIntent;
      
    } catch (error) {
      console.error('❌ AI 3.0 의도 분석 오류:', error);
      return await this.analyzeIntent(userInput, attachedImages, context);
    }
  }
  
  /**
   * AI 3.0 스마트 명확화 처리 (공감적 & 개인화)
   */
  private async handleAI3SmartClarification(
    intent: UserIntent,
    naturalGuidance: any,
    emotionalContext: any,
    userProfile: any
  ): Promise<{
    success: boolean;
    reply: string;
    needsClarification: boolean;
    clarificationField: string;
    suggestions?: string[];
  }> {
    const clarification = intent.clarificationNeeded!;
    
    // AI 3.0 공감적 메시지 생성
    const empathicMessage = await this.emotionalAnalyzer.generateEmpathicResponse(
      `명확화 필요: ${clarification.field}`,
      emotionalContext,
      {
        isFirstTimeBuyer: userProfile.detectedType === 'first_buyer',
        previousInteractions: this.session.getConversationHistory().length
      }
    );
    
    // 자연스러운 가이드 메시지 결합
    const naturalClarification = naturalGuidance.suggestedResponse || this.generateTraditionalClarification(clarification, intent);
    
    const combinedMessage = empathicMessage.response + "\n\n" + naturalClarification;
    
    // 명확화 상태를 세션에 저장
    this.session.setSlot('ai3_clarification_pending', {
      field: clarification.field,
      originalIntent: intent,
      emotionalContext: emotionalContext.dominantEmotion,
      userProfile: userProfile.detectedType,
      timestamp: new Date()
    }, 1.0, 'ai3_system');
    
    return {
      success: true,
      reply: combinedMessage,
      needsClarification: true,
      clarificationField: clarification.field,
      suggestions: [...(clarification.suggestions || []), ...(naturalGuidance.proactiveSuggestions || [])]
    };
  }
  
  /**
   * 전통적 명확화 메시지 생성
   */
  private generateTraditionalClarification(clarification: any, intent: UserIntent): string {
    switch (clarification.field) {
      case 'apartment_location':
        return `어느 지역의 ${intent.entities.apartmentName || '아파트'}를 말씩하시는 걸까요?`;
      case 'deal_type':
        return "매매, 전세, 월세 중 어떤 거래 정보가 궁금하신가요?";
      case 'apartment_name':
        return "구체적으로 어떤 아파트에 대해 알고 싶으신가요?";
      default:
        return `${clarification.reason}에 대해 더 구체적으로 말씩해 주시겠어요?`;
    }
  }
  
  /**
   * AI 3.0 강화 작업 계획 수립
   */
  private async createAI3EnhancedTaskPlan(
    intent: UserIntent, 
    conversationTurn: any, 
    userJourney: any, 
    userProfile: any
  ): Promise<TaskPlan> {
    // 기본 계획 생성
    const basePlan = await this.createTaskPlan(intent);
    
    // AI 3.0 강화 요소 추가
    const enhancedSteps = basePlan.steps.map(step => {
      if (step.type === 'apartment_resolve') {
        return {
          ...step,
          params: {
            ...step.params,
            ai3Enhancement: true,
            userProfile: userProfile.detectedType,
            journeyStage: userJourney.currentStage
          }
        };
      }
      return step;
    });
    
    // 다중 턴 처리가 필요한 경우 전용 단계 추가
    if (conversationTurn.isComplexRequest) {
      enhancedSteps.unshift({
        id: 'ai3_multiturn_decomposition',
        type: 'synthesize' as any,
        action: 'decompose_complex_request',
        params: {
          originalRequest: conversationTurn.originalRequest,
          subRequests: conversationTurn.subRequests
        }
      });
    }
    
    return {
      ...basePlan,
      steps: enhancedSteps,
      priority: userJourney.currentStage === 'decision' ? 'high' : basePlan.priority
    };
  }
  
  /**
   * AI 3.0 공감적 응답 생성
   */
  private async synthesizeAI3Response(
    results: ExecutionResult[], 
    intent: UserIntent, 
    qualityCheck: any,
    emotionalContext: any,
    userProfile: any,
    userJourney: any
  ): Promise<{
    reply: string;
    confidence: number;
    sources: string[];
    metadata: Record<string, any>;
  }> {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      // AI 3.0 공감적 오류 메시지
      const empathicError = await this.emotionalAnalyzer.generateEmpathicResponse(
        '오류 상황',
        emotionalContext,
        {
          isFirstTimeBuyer: userProfile.detectedType === 'first_buyer',
          previousInteractions: this.session.getConversationHistory().length
        }
      );
      
      return {
        reply: empathicError.response || "이런, 예상치 못한 문제가 발생했네요. 다시 한 번 말씩해 주시면 더 나은 도움을 드릴 수 있을 것 같아요.",
        confidence: 0.1,
        sources: [],
        metadata: { ai3Error: true, emotionalTone: emotionalContext.recommendedTone }
      };
    }
    
    // AI 3.0 강화 응답 생성 프롬프트
    const ai3ResponsePrompt = this.createAI3ResponsePrompt(
      successfulResults, 
      intent, 
      qualityCheck, 
      emotionalContext, 
      userProfile, 
      userJourney
    );
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ai3ResponsePrompt },
          { role: 'user', content: '위 정보를 바탕으로 AI 3.0 공감적이고 개인화된 응답을 생성해주세요.' }
        ],
        temperature: emotionalContext.stressLevel > 0.5 ? 0.2 : 0.4  // 스트레스 높으면 안정적 응답
      });
      
      const reply = response.choices[0]?.message?.content || '응답 생성에 실패했습니다.';
      
      return {
        reply,
        confidence: qualityCheck.overallQuality || 0.5,
        sources: successfulResults.map(r => r.stepId),
        metadata: {
          ai3Enhanced: true,
          emotionalTone: emotionalContext.recommendedTone,
          userProfileMatched: userProfile.detectedType !== 'explorer',
          journeyStageConsidered: userJourney.currentStage,
          empathicResponse: emotionalContext.stressLevel > 0.3,
          executedSteps: results.length,
          successfulSteps: successfulResults.length,
          quality: qualityCheck,
          intent: intent.category
        }
      };
      
    } catch (error) {
      console.error('❌ AI 3.0 응답 생성 오류:', error);
      
      // 폴백: 기본 응답 생성
      return this.synthesizeResponse(results, intent, qualityCheck);
    }
  }
  
  /**
   * AI 3.0 응답 생성용 프롬프트 작성
   */
  private createAI3ResponsePrompt(
    results: ExecutionResult[], 
    intent: UserIntent, 
    qualityCheck: any,
    emotionalContext: any,
    userProfile: any,
    userJourney: any
  ): string {
    const dataContext = results.map(r => ({
      step: r.stepId,
      data: r.data
    }));
    
    return `당신은 AI 3.0 공감적 부동산 상담사입니다.

**사용자 컨텍스트:**
- 사용자 의도: ${intent.category}
- 감정 상태: ${emotionalContext.dominantEmotion} (스트레스 레벨: ${emotionalContext.stressLevel})
- 사용자 유형: ${userProfile.detectedType}
- 여정 단계: ${userJourney.currentStage}
- 결정 준비도: ${emotionalContext.decisionReadiness}

**실행 결과:**
${JSON.stringify(dataContext, null, 2)}

**품질 지표:** ${qualityCheck.overallQuality}

**AI 3.0 응답 지침:**
1. **공감적 접근**: 사용자의 감정 상태와 스트레스 레벨에 따라 어조 조절
2. **개인화**: 사용자 유형에 맞는 맞춤형 정보 제공
3. **여정 고려**: 현재 여정 단계에 적합한 다음 단계 안내
4. **자연스러운 대화**: 기계적이지 않은 따뜻한 어조
5. **실용적 가치**: 데이터를 사용자에게 의미 있는 인사이트로 변환

**어조 가이드:**
- 스트레스 높음: 안심시키고 따뜻하게
- 흥미/활발: 열정적이고 생동감 있게
- 불안/우려: 놀래지 말고 이해하기 쉬운 설명

**사용자 유형별 접근:**
- first_buyer: 자세한 설명과 가이드 중심
- investor: 수익성과 시장 분석 중심
- relocator: 실용적 비교와 생활 편의성
- upgrader: 현재 대비 개선점 강조
- explorer: 다양한 옵션과 가능성 제시

**금지사항:**
- 데이터에 없는 내용 추측 금지
- 투자 조언이나 추천은 신중하게
- 과도한 기술 용어 사용 금지

한국어로 자연스럽고 공감적인 응답을 생성하세요.`;
  }
}