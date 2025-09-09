/**
 * 구조화된 로거 - pino 기반
 */

import pino from 'pino';

// 환경별 로그 레벨 설정
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// 개발환경용 Pretty 출력 설정
const transport = process.env.NODE_ENV === 'development' ? {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{levelLabel} - {msg}',
      errorLikeObjectKeys: ['err', 'error']
    }
  }
} : {};

// 기본 로거 생성
const baseLogger = pino({
  level: LOG_LEVEL,
  ...transport,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

/**
 * AI 함수 호출 추적용 구조화된 로거
 */
export class AILogger {
  private static instance: AILogger;
  private logger: pino.Logger;

  private constructor() {
    this.logger = baseLogger.child({
      service: 'ai-chatbot'
    });
  }

  static getInstance(): AILogger {
    if (!AILogger.instance) {
      AILogger.instance = new AILogger();
    }
    return AILogger.instance;
  }

  /**
   * AI 함수 호출 시작 로그
   */
  logFunctionCall(context: {
    functionName: string;
    requestId: string;
    userId?: string;
    ip: string;
    params: any;
  }) {
    this.logger.info({
      event: 'ai_function_call',
      requestId: context.requestId,
      functionName: context.functionName,
      userId: context.userId || 'anonymous',
      clientIp: context.ip,
      parameterCount: Object.keys(context.params || {}).length,
      timestamp: Date.now()
    }, `🚀 AI 함수 호출: ${context.functionName}`);
  }

  /**
   * AI 함수 성공 로그
   */
  logFunctionSuccess(context: {
    functionName: string;
    requestId: string;
    executionTime: number;
    resultSize: number;
    cacheHit: boolean;
  }) {
    this.logger.info({
      event: 'ai_function_success',
      requestId: context.requestId,
      functionName: context.functionName,
      executionTimeMs: context.executionTime,
      resultSizeBytes: context.resultSize,
      cacheHit: context.cacheHit,
      timestamp: Date.now()
    }, `✅ AI 함수 성공: ${context.functionName} (${context.executionTime}ms)`);
  }

  /**
   * AI 함수 에러 로그
   */
  logFunctionError(context: {
    functionName: string;
    requestId: string;
    error: Error | string;
    executionTime?: number;
  }) {
    const errorMessage = typeof context.error === 'string' ? context.error : context.error.message;
    const errorStack = typeof context.error === 'object' ? context.error.stack : undefined;

    this.logger.error({
      event: 'ai_function_error',
      requestId: context.requestId,
      functionName: context.functionName,
      errorMessage,
      errorStack,
      executionTimeMs: context.executionTime || 0,
      timestamp: Date.now()
    }, `❌ AI 함수 실패: ${context.functionName} - ${errorMessage}`);
  }

  /**
   * 캐시 이벤트 로그
   */
  logCacheEvent(context: {
    event: 'hit' | 'miss' | 'set' | 'invalidate';
    functionName: string;
    key: string;
    size?: number;
    ttl?: number;
  }) {
    const emoji = {
      hit: '💾',
      miss: '🔄',
      set: '💽',
      invalidate: '🗑️'
    }[context.event];

    this.logger.debug({
      event: 'cache_event',
      cacheEvent: context.event,
      functionName: context.functionName,
      cacheKey: context.key.slice(-8), // 키의 마지막 8자리만
      sizeBytes: context.size,
      ttlMs: context.ttl,
      timestamp: Date.now()
    }, `${emoji} 캐시 ${context.event}: ${context.functionName}`);
  }

  /**
   * 레이트 리밋 이벤트 로그
   */
  logRateLimitEvent(context: {
    event: 'allowed' | 'blocked';
    ip: string;
    userId?: string;
    functionName?: string;
    limitType: 'basic' | 'strict' | 'user' | 'function';
    requestsRemaining?: number;
    resetTime?: number;
  }) {
    const emoji = context.event === 'allowed' ? '✅' : '🚨';
    const level = context.event === 'blocked' ? 'warn' : 'debug';

    this.logger[level]({
      event: 'rate_limit',
      rateLimitEvent: context.event,
      clientIp: context.ip,
      userId: context.userId || 'anonymous',
      functionName: context.functionName,
      limitType: context.limitType,
      requestsRemaining: context.requestsRemaining,
      resetTime: context.resetTime,
      timestamp: Date.now()
    }, `${emoji} 레이트 리밋 ${context.event}: ${context.ip} (${context.limitType})`);
  }

  /**
   * 시스템 메트릭 로그
   */
  logSystemMetrics(metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    activeConnections: number;
    cacheSize: number;
    uptime: number;
  }) {
    this.logger.info({
      event: 'system_metrics',
      memory: {
        rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024), // MB
      },
      activeConnections: metrics.activeConnections,
      cacheSize: metrics.cacheSize,
      uptimeSeconds: Math.round(metrics.uptime),
      timestamp: Date.now()
    }, '📊 시스템 메트릭 수집');
  }

  /**
   * 외부 API 호출 로그
   */
  logExternalAPI(context: {
    apiName: string;
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    success: boolean;
    error?: string;
  }) {
    const emoji = context.success ? '🌐' : '⚠️';
    const level = context.success ? 'info' : 'warn';

    this.logger[level]({
      event: 'external_api',
      apiName: context.apiName,
      method: context.method,
      url: context.url.replace(/([?&]key=)[^&]+/, '$1***'), // API 키 마스킹
      statusCode: context.statusCode,
      responseTimeMs: context.responseTime,
      success: context.success,
      error: context.error,
      timestamp: Date.now()
    }, `${emoji} 외부 API: ${context.apiName} (${context.statusCode}, ${context.responseTime}ms)`);
  }

  /**
   * 사용자 세션 로그
   */
  logUserSession(context: {
    event: 'start' | 'end';
    userId?: string;
    ip: string;
    userAgent: string;
    sessionDuration?: number;
  }) {
    const emoji = context.event === 'start' ? '👋' : '👋🏻';

    this.logger.info({
      event: 'user_session',
      sessionEvent: context.event,
      userId: context.userId || 'anonymous',
      clientIp: context.ip,
      userAgent: context.userAgent.slice(0, 100), // 100자로 제한
      sessionDurationMs: context.sessionDuration,
      timestamp: Date.now()
    }, `${emoji} 사용자 세션 ${context.event}: ${context.ip}`);
  }

  /**
   * 일반 정보 로그
   */
  info(message: string, meta?: any) {
    this.logger.info(meta, message);
  }

  /**
   * 경고 로그
   */
  warn(message: string, meta?: any) {
    this.logger.warn(meta, message);
  }

  /**
   * 에러 로그
   */
  error(message: string, error?: Error | any) {
    if (error instanceof Error) {
      this.logger.error({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }, message);
    } else {
      this.logger.error({ error }, message);
    }
  }

  /**
   * 디버그 로그
   */
  debug(message: string, meta?: any) {
    this.logger.debug(meta, message);
  }
}

// Singleton 인스턴스 내보내기
export const aiLogger = AILogger.getInstance();

/**
 * 요청 ID 생성 헬퍼
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 로그 컨텍스트 추출 헬퍼
 */
export function extractLogContext(req: any): {
  ip: string;
  userAgent: string;
  userId?: string;
} {
  const forwarded = req.headers?.get?.('x-forwarded-for') || req.header?.('x-forwarded-for');
  const realIP = req.headers?.get?.('x-real-ip') || req.header?.('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
  
  const userAgent = req.headers?.get?.('user-agent') || req.header?.('user-agent') || 'unknown';
  const userId = req.get?.('userId') || req.get?.('user')?.uid;

  return { ip, userAgent, userId };
}