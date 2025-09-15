// LLM 라이프사이클 관리를 위한 대화 세션 클래스

import { ApartmentInfo, ApartmentContextManager } from './apartmentContextManager';

export interface UserMessage {
  id: string;
  content: string;
  timestamp: Date;
  intent?: string; // 파악된 사용자 의도
}

export interface SystemResponse {
  id: string;
  content: string;
  timestamp: Date;
  sources?: string[]; // 응답 생성에 사용된 데이터 소스
  confidence?: number; // 응답 품질 신뢰도
  metadata?: Record<string, any>;
}

export interface TaskExecution {
  taskId: string;
  taskType: 'slot' | 'planner' | 'clarify' | 'critic' | 'db' | 'rag' | 'web_search';
  input: any;
  output: any;
  success: boolean;
  timestamp: Date;
  executionTime?: number;
}

export interface UserPreference {
  preferredAreas?: string[]; // 선호 지역
  budgetRange?: [number, number]; // 예산 범위 (만원)
  apartmentTypes?: string[]; // 선호 아파트 유형
  dealTypes?: ('매매' | '전세' | '월세')[]; // 관심 거래 유형
  lastUpdated: Date;
}

export interface SessionSlot {
  key: string;
  value: any;
  confidence: number; // 0-1 사이
  source: 'user_explicit' | 'user_implicit' | 'system_inferred';
  lastUpdated: Date;
  metadata?: Record<string, any>;
}

/**
 * LLM 라이프사이클 동안 지속되는 대화 세션
 * 사용자 의도 추적, 컨텍스트 유지, 슬롯 관리 등을 담당
 */
export class ConversationSession {
  public readonly sessionId: string;
  public readonly startTime: Date;
  
  // 대화 히스토리
  private userMessages: UserMessage[] = [];
  private systemResponses: SystemResponse[] = [];
  
  // 작업 실행 이력
  private taskExecutions: TaskExecution[] = [];
  
  // 사용자 정보 및 선호도
  private userPreferences: UserPreference = {
    lastUpdated: new Date()
  };
  
  // 슬롯 기반 정보 관리
  private slots: Map<string, SessionSlot> = new Map();
  
  // 아파트 컨텍스트 관리자
  private apartmentContext: ApartmentContextManager;
  
  // 세션 상태
  private currentIntent: string | null = null;
  private isActive: boolean = true;
  private lastActivity: Date;

  constructor(sessionId?: string, apartmentContextManager?: ApartmentContextManager) {
    this.sessionId = sessionId || this.generateSessionId();
    this.startTime = new Date();
    this.lastActivity = new Date();
    this.apartmentContext = apartmentContextManager || new ApartmentContextManager();
    
    console.log(`🎭 새 대화 세션 시작: ${this.sessionId}`);
  }

  /**
   * 사용자 메시지 추가
   */
  addUserMessage(content: string, intent?: string): UserMessage {
    const message: UserMessage = {
      id: this.generateMessageId(),
      content,
      timestamp: new Date(),
      intent
    };
    
    this.userMessages.push(message);
    this.updateActivity();
    
    // 현재 의도 업데이트
    if (intent) {
      this.currentIntent = intent;
    }
    
    console.log(`👤 사용자 메시지 추가: ${content.substring(0, 50)}...`);
    return message;
  }

  /**
   * 시스템 응답 추가
   */
  addSystemResponse(content: string, sources?: string[], confidence?: number, metadata?: Record<string, any>): SystemResponse {
    const response: SystemResponse = {
      id: this.generateMessageId(),
      content,
      timestamp: new Date(),
      sources,
      confidence,
      metadata
    };
    
    this.systemResponses.push(response);
    this.updateActivity();
    
    console.log(`🤖 시스템 응답 추가: ${content.substring(0, 50)}...`);
    return response;
  }

  /**
   * 작업 실행 기록 추가
   */
  recordTaskExecution(taskExecution: Omit<TaskExecution, 'timestamp'>): void {
    this.taskExecutions.push({
      ...taskExecution,
      timestamp: new Date()
    });
    
    this.updateActivity();
    
    console.log(`⚙️ 작업 실행 기록: ${taskExecution.taskType} - ${taskExecution.success ? '성공' : '실패'}`);
  }

  /**
   * 슬롯 설정
   */
  setSlot(key: string, value: any, confidence: number = 1.0, source: SessionSlot['source'] = 'user_explicit', metadata?: Record<string, any>): void {
    const slot: SessionSlot = {
      key,
      value,
      confidence,
      source,
      lastUpdated: new Date(),
      metadata
    };
    
    this.slots.set(key, slot);
    this.updateActivity();
    
    console.log(`🎰 슬롯 설정: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * 슬롯 조회
   */
  getSlot(key: string): SessionSlot | undefined {
    return this.slots.get(key);
  }

  /**
   * 모든 슬롯 조회
   */
  getAllSlots(): Record<string, SessionSlot> {
    const result: Record<string, SessionSlot> = {};
    for (const [key, slot] of this.slots.entries()) {
      result[key] = slot;
    }
    return result;
  }

  /**
   * 아파트 컨텍스트에 아파트 추가
   */
  addApartment(apartment: Omit<ApartmentInfo, 'addedAt' | 'lastMentioned'>): void {
    this.apartmentContext.addApartment(apartment);
    
    // 아파트 관련 슬롯도 업데이트
    if (apartment.id) {
      this.setSlot('current_apartment_id', apartment.id, 1.0, 'system_inferred');
    }
    this.setSlot('current_apartment_name', apartment.name, 1.0, 'system_inferred');
  }

  /**
   * 아파트 검색
   */
  findApartments(name: string): ApartmentInfo[] {
    return this.apartmentContext.findByName(name);
  }

  /**
   * 모든 아파트 조회 (Function Calling용)
   */
  getAllApartments(): ApartmentInfo[] {
    return this.apartmentContext.getAllApartments();
  }

  /**
   * 사용자 선호도 업데이트
   */
  updateUserPreferences(preferences: Partial<UserPreference>): void {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences,
      lastUpdated: new Date()
    };
    
    this.updateActivity();
    console.log(`👤 사용자 선호도 업데이트:`, preferences);
  }

  /**
   * 현재 의도 설정
   */
  setCurrentIntent(intent: string): void {
    this.currentIntent = intent;
    this.setSlot('current_intent', intent, 1.0, 'system_inferred');
    console.log(`🎯 현재 의도 설정: ${intent}`);
  }

  /**
   * 대화 히스토리 조회
   */
  getConversationHistory(limit?: number): Array<UserMessage | SystemResponse> {
    const combined = [
      ...this.userMessages.map(m => ({ ...m, type: 'user' as const })),
      ...this.systemResponses.map(m => ({ ...m, type: 'system' as const }))
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return limit ? combined.slice(-limit) : combined;
  }

  /**
   * 최근 작업 실행 이력
   */
  getRecentTaskExecutions(limit: number = 10): TaskExecution[] {
    return this.taskExecutions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 최근 상호작용 이력 (AI 3.0 시스템용)
   */
  getRecentInteractions(limit: number = 10): Array<{
    type: 'user_message' | 'system_response' | 'task_execution';
    content: any;
    timestamp: Date;
    metadata?: Record<string, any>;
  }> {
    const interactions: Array<{
      type: 'user_message' | 'system_response' | 'task_execution';
      content: any;
      timestamp: Date;
      metadata?: Record<string, any>;
    }> = [];

    // 사용자 메시지 추가
    this.userMessages.forEach(msg => {
      interactions.push({
        type: 'user_message',
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: { id: msg.id, intent: msg.intent }
      });
    });

    // 시스템 응답 추가
    this.systemResponses.forEach(resp => {
      interactions.push({
        type: 'system_response',
        content: resp.content,
        timestamp: resp.timestamp,
        metadata: { 
          id: resp.id, 
          sources: resp.sources, 
          confidence: resp.confidence,
          ...resp.metadata 
        }
      });
    });

    // 작업 실행 추가
    this.taskExecutions.forEach(task => {
      interactions.push({
        type: 'task_execution',
        content: { taskType: task.taskType, success: task.success, input: task.input, output: task.output },
        timestamp: task.timestamp,
        metadata: { taskId: task.taskId, executionTime: task.executionTime }
      });
    });

    // 시간순 정렬 후 최신 N개 반환
    return interactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 세션 상태 정보
   */
  getSessionStatus(): {
    sessionId: string;
    startTime: Date;
    lastActivity: Date;
    duration: number;
    messageCount: number;
    taskCount: number;
    currentIntent: string | null;
    slotCount: number;
    apartmentCount: number;
    isActive: boolean;
  } {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      duration: Date.now() - this.startTime.getTime(),
      messageCount: this.userMessages.length + this.systemResponses.length,
      taskCount: this.taskExecutions.length,
      currentIntent: this.currentIntent,
      slotCount: this.slots.size,
      apartmentCount: this.apartmentContext.getAllApartments().length,
      isActive: this.isActive
    };
  }

  /**
   * 컨텍스트 요약 (LLM에 전달할 용도)
   */
  getContextSummary(): {
    currentIntent: string | null;
    apartments: ApartmentInfo[];
    userPreferences: UserPreference;
    recentMessages: Array<UserMessage | SystemResponse>;
    keySlots: Record<string, any>;
  } {
    const recentMessages = this.getConversationHistory(6); // 최근 3턴
    const keySlots: Record<string, any> = {};
    
    // 중요한 슬롯들만 선별
    const importantSlots = ['current_apartment_id', 'current_apartment_name', 'user_budget', 'preferred_area', 'deal_type'];
    for (const key of importantSlots) {
      const slot = this.getSlot(key);
      if (slot) {
        keySlots[key] = slot.value;
      }
    }
    
    return {
      currentIntent: this.currentIntent,
      apartments: this.apartmentContext.getAllApartments(),
      userPreferences: this.userPreferences,
      recentMessages,
      keySlots
    };
  }

  /**
   * 세션 종료
   */
  close(): void {
    this.isActive = false;
    console.log(`🎭 대화 세션 종료: ${this.sessionId}, 지속시간: ${this.getSessionStatus().duration}ms`);
  }

  /**
   * 활동 시간 업데이트
   */
  private updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 메시지 ID 생성
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 디버깅 정보
   */
  getDebugInfo(): any {
    return {
      session: this.getSessionStatus(),
      slots: this.getAllSlots(),
      apartments: this.apartmentContext.getDebugInfo(),
      recentTasks: this.getRecentTaskExecutions(5),
      userPreferences: this.userPreferences
    };
  }
}