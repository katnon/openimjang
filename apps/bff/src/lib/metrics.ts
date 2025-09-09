/**
 * 메트릭 수집 시스템 - AI 함수 호출 추적 및 성능 모니터링
 */

import { aiLogger } from './logger';

// 함수별 호출 통계
interface FunctionMetrics {
  name: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  cacheHits: number;
  cacheMisses: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalExecutionTime: number;
  lastCalled: number;
  errors: Array<{
    timestamp: number;
    message: string;
  }>;
}

// 시스템 메트릭
interface SystemMetrics {
  startTime: number;
  uptime: number;
  totalRequests: number;
  activeRequests: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheStats: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  rateLimitEvents: {
    allowed: number;
    blocked: number;
    blockRate: number;
  };
  topFunctions: Array<{
    name: string;
    calls: number;
    avgTime: number;
  }>;
}

/**
 * 메트릭 수집기 (Singleton)
 */
class MetricsCollector {
  private static instance: MetricsCollector;
  private functionMetrics = new Map<string, FunctionMetrics>();
  private systemStartTime: number;
  private totalRequests = 0;
  private activeRequests = 0;
  private rateLimitAllowed = 0;
  private rateLimitBlocked = 0;

  private constructor() {
    this.systemStartTime = Date.now();
    
    // 주기적 메트릭 로깅 (5분마다)
    setInterval(() => {
      this.logSystemMetrics();
    }, 5 * 60 * 1000);
    
    // 메모리 정리 (1시간마다)
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * 함수 호출 시작 추적
   */
  trackFunctionStart(functionName: string): void {
    this.totalRequests++;
    this.activeRequests++;
    
    if (!this.functionMetrics.has(functionName)) {
      this.functionMetrics.set(functionName, {
        name: functionName,
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        avgExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        totalExecutionTime: 0,
        lastCalled: 0,
        errors: []
      });
    }

    const metrics = this.functionMetrics.get(functionName)!;
    metrics.totalCalls++;
    metrics.lastCalled = Date.now();
  }

  /**
   * 함수 호출 성공 추적
   */
  trackFunctionSuccess(functionName: string, executionTime: number, cacheHit: boolean): void {
    this.activeRequests--;
    
    const metrics = this.functionMetrics.get(functionName);
    if (!metrics) return;

    metrics.successCalls++;
    
    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }

    // 실행 시간 통계 업데이트 (캐시 히트가 아닌 경우만)
    if (!cacheHit) {
      metrics.totalExecutionTime += executionTime;
      metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
      metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
      
      const actualExecutions = metrics.successCalls - metrics.cacheHits + metrics.errorCalls;
      if (actualExecutions > 0) {
        metrics.avgExecutionTime = metrics.totalExecutionTime / actualExecutions;
      }
    }
  }

  /**
   * 함수 호출 에러 추적
   */
  trackFunctionError(functionName: string, error: string, executionTime?: number): void {
    this.activeRequests--;
    
    const metrics = this.functionMetrics.get(functionName);
    if (!metrics) return;

    metrics.errorCalls++;
    
    if (executionTime) {
      metrics.totalExecutionTime += executionTime;
      const actualExecutions = metrics.successCalls - metrics.cacheHits + metrics.errorCalls;
      if (actualExecutions > 0) {
        metrics.avgExecutionTime = metrics.totalExecutionTime / actualExecutions;
      }
    }

    // 최근 에러 10개만 보관
    metrics.errors.push({
      timestamp: Date.now(),
      message: error.slice(0, 200) // 에러 메시지 길이 제한
    });
    
    if (metrics.errors.length > 10) {
      metrics.errors.shift();
    }
  }

  /**
   * 레이트 리밋 이벤트 추적
   */
  trackRateLimit(allowed: boolean): void {
    if (allowed) {
      this.rateLimitAllowed++;
    } else {
      this.rateLimitBlocked++;
    }
  }

  /**
   * 시스템 메트릭 조회
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const uptime = now - this.systemStartTime;
    const memoryUsage = process.memoryUsage();
    
    // 캐시 통계 (외부에서 주입받을 수 있도록)
    let cacheStats = { size: 0, hits: 0, misses: 0, hitRate: 0 };
    try {
      // CacheHelper가 있다면 통계 조회
      const { CacheHelper } = require('./cache');
      cacheStats = CacheHelper.getStats();
    } catch (e) {
      // 캐시 모듈이 없거나 오류시 기본값 사용
    }

    // 인기 함수 상위 10개
    const topFunctions = Array.from(this.functionMetrics.values())
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 10)
      .map(metric => ({
        name: metric.name,
        calls: metric.totalCalls,
        avgTime: Math.round(metric.avgExecutionTime)
      }));

    const totalRateLimitEvents = this.rateLimitAllowed + this.rateLimitBlocked;
    const blockRate = totalRateLimitEvents > 0 
      ? (this.rateLimitBlocked / totalRateLimitEvents) * 100 
      : 0;

    return {
      startTime: this.systemStartTime,
      uptime,
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      memoryUsage,
      cacheStats,
      rateLimitEvents: {
        allowed: this.rateLimitAllowed,
        blocked: this.rateLimitBlocked,
        blockRate: Math.round(blockRate * 100) / 100
      },
      topFunctions
    };
  }

  /**
   * 함수별 메트릭 조회
   */
  getFunctionMetrics(functionName?: string): FunctionMetrics[] {
    if (functionName) {
      const metric = this.functionMetrics.get(functionName);
      return metric ? [metric] : [];
    }

    return Array.from(this.functionMetrics.values())
      .sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport(): {
    overview: SystemMetrics;
    slowestFunctions: Array<{
      name: string;
      avgTime: number;
      calls: number;
      errorRate: number;
    }>;
    mostPopularFunctions: Array<{
      name: string;
      calls: number;
      successRate: number;
      cacheHitRate: number;
    }>;
    recentErrors: Array<{
      functionName: string;
      timestamp: number;
      message: string;
    }>;
  } {
    const overview = this.getSystemMetrics();
    const allMetrics = this.getFunctionMetrics();

    // 가장 느린 함수들
    const slowestFunctions = allMetrics
      .filter(m => m.avgExecutionTime > 0)
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, 5)
      .map(metric => ({
        name: metric.name,
        avgTime: Math.round(metric.avgExecutionTime),
        calls: metric.totalCalls,
        errorRate: Math.round((metric.errorCalls / metric.totalCalls) * 100 * 100) / 100
      }));

    // 가장 인기있는 함수들
    const mostPopularFunctions = allMetrics
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map(metric => ({
        name: metric.name,
        calls: metric.totalCalls,
        successRate: Math.round((metric.successCalls / metric.totalCalls) * 100 * 100) / 100,
        cacheHitRate: metric.totalCalls > 0 
          ? Math.round((metric.cacheHits / metric.totalCalls) * 100 * 100) / 100 
          : 0
      }));

    // 최근 에러들
    const recentErrors: Array<{
      functionName: string;
      timestamp: number;
      message: string;
    }> = [];

    for (const metric of allMetrics) {
      for (const error of metric.errors) {
        recentErrors.push({
          functionName: metric.name,
          timestamp: error.timestamp,
          message: error.message
        });
      }
    }

    recentErrors.sort((a, b) => b.timestamp - a.timestamp);
    recentErrors.splice(20); // 최근 20개만

    return {
      overview,
      slowestFunctions,
      mostPopularFunctions,
      recentErrors
    };
  }

  /**
   * 시스템 메트릭 로깅
   */
  private logSystemMetrics(): void {
    const metrics = this.getSystemMetrics();
    
    aiLogger.logSystemMetrics({
      memoryUsage: metrics.memoryUsage,
      activeConnections: metrics.activeRequests,
      cacheSize: metrics.cacheStats.size,
      uptime: metrics.uptime / 1000 // 초 단위
    });
  }

  /**
   * 메모리 정리 - 오래된 에러 기록 제거
   */
  private cleanup(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;

    for (const metric of this.functionMetrics.values()) {
      const originalLength = metric.errors.length;
      metric.errors = metric.errors.filter(error => error.timestamp > oneHourAgo);
      cleanedCount += originalLength - metric.errors.length;
    }

    if (cleanedCount > 0) {
      aiLogger.debug(`🧹 메트릭 정리: 오래된 에러 기록 ${cleanedCount}개 삭제`);
    }
  }

  /**
   * 메트릭 리셋 (개발/테스트용)
   */
  reset(): void {
    this.functionMetrics.clear();
    this.totalRequests = 0;
    this.activeRequests = 0;
    this.rateLimitAllowed = 0;
    this.rateLimitBlocked = 0;
    this.systemStartTime = Date.now();
    
    aiLogger.info('📊 메트릭 데이터 리셋 완료');
  }
}

// Singleton 인스턴스
const metricsCollector = MetricsCollector.getInstance();

/**
 * 메트릭 헬퍼 함수들
 */
export class MetricsHelper {
  /**
   * 함수 실행 추적 래퍼
   */
  static async trackFunction<T>(
    functionName: string,
    executor: () => Promise<T>,
    cacheHit: boolean = false
  ): Promise<T> {
    metricsCollector.trackFunctionStart(functionName);
    const startTime = Date.now();

    try {
      const result = await executor();
      const executionTime = Date.now() - startTime;
      
      metricsCollector.trackFunctionSuccess(functionName, executionTime, cacheHit);
      
      aiLogger.logFunctionSuccess({
        functionName,
        requestId: 'tracked', // 실제 구현시 실제 requestId 사용
        executionTime,
        resultSize: JSON.stringify(result).length,
        cacheHit
      });

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      metricsCollector.trackFunctionError(functionName, errorMessage, executionTime);
      
      aiLogger.logFunctionError({
        functionName,
        requestId: 'tracked',
        error,
        executionTime
      });

      throw error;
    }
  }

  /**
   * 레이트 리밋 이벤트 추적
   */
  static trackRateLimit(allowed: boolean): void {
    metricsCollector.trackRateLimit(allowed);
  }

  /**
   * 시스템 메트릭 조회
   */
  static getSystemMetrics() {
    return metricsCollector.getSystemMetrics();
  }

  /**
   * 함수별 메트릭 조회
   */
  static getFunctionMetrics(functionName?: string) {
    return metricsCollector.getFunctionMetrics(functionName);
  }

  /**
   * 성능 리포트 생성
   */
  static generatePerformanceReport() {
    return metricsCollector.generatePerformanceReport();
  }

  /**
   * 메트릭 리셋
   */
  static reset() {
    metricsCollector.reset();
  }
}

// 인스턴스 내보내기
export { metricsCollector };

/**
 * 함수 실행 시간 측정 데코레이터 헬퍼
 */
export function measureExecutionTime(): {
  start: () => void;
  end: () => number;
} {
  let startTime = 0;

  return {
    start: () => {
      startTime = Date.now();
    },
    end: () => {
      return Date.now() - startTime;
    }
  };
}

/**
 * 헬스 체크용 메트릭
 */
export function getHealthMetrics() {
  const metrics = metricsCollector.getSystemMetrics();
  const memoryMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
  const uptimeHours = Math.round(metrics.uptime / (1000 * 60 * 60) * 100) / 100;

  return {
    status: 'healthy',
    uptime: `${uptimeHours}h`,
    memory: `${memoryMB}MB`,
    activeRequests: metrics.activeRequests,
    totalRequests: metrics.totalRequests,
    cacheHitRate: `${metrics.cacheStats.hitRate}%`,
    rateLimitBlockRate: `${metrics.rateLimitEvents.blockRate}%`
  };
}