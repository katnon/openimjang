// AI Function Calling 전용 API 라우터
import { Hono } from 'hono';
import { tools } from '../ai/tools';
import { handlers } from '../ai/handlers';
import { validateOrThrow } from '../ai/tools/validation';

// 캐시, 레이트 리밋, 로깅, 메트릭 시스템
import { cacheMiddleware, cacheStatsMiddleware, cacheManagementMiddleware } from '../middleware/cache';
import { basicRateLimit, createFunctionRateLimit, rateLimitStatusMiddleware } from '../middleware/rateLimit';
import { aiLogger, generateRequestId, extractLogContext } from '../lib/logger';
import { MetricsHelper } from '../lib/metrics';

const apiAiToolsRoute = new Hono();

// 전체 라우트에 캐시 미들웨어 적용
apiAiToolsRoute.use('/tools/*', cacheMiddleware());

// POST /api/ai/tools/:name - 특정 AI 함수 호출 (레이트 리밋과 함께)
apiAiToolsRoute.post('/tools/:name', async (c, next) => {
  const functionName = c.req.param('name');
  
  // 함수별 동적 레이트 리밋 적용
  const functionRateLimit = createFunctionRateLimit(functionName);
  return functionRateLimit(c, next);
}, async (c) => {
  const requestId = generateRequestId();
  const logContext = extractLogContext(c.req);
  const { name } = c.req.param();
  
  // 함수 호출 시작 로그
  aiLogger.logFunctionCall({
    functionName: name,
    requestId,
    userId: logContext.userId,
    ip: logContext.ip,
    params: {}
  });

  try {
    // 함수 존재 여부 확인
    const tool = tools.find(t => t.function.name === name);
    if (!tool) {
      const error = `알 수 없는 함수입니다: ${name}`;
      aiLogger.logFunctionError({ functionName: name, requestId, error });
      
      return c.json({ 
        success: false, 
        error,
        availableFunctions: tools.map(t => t.function.name)
      }, 404);
    }

    // 요청 바디 파싱
    let requestBody: any;
    try {
      requestBody = await c.req.json();
    } catch (parseError) {
      const error = '유효하지 않은 JSON 형식입니다.';
      aiLogger.logFunctionError({ functionName: name, requestId, error });
      
      return c.json({ success: false, error }, 400);
    }

    // 로그 업데이트 (파라미터 정보 포함)
    aiLogger.logFunctionCall({
      functionName: name,
      requestId,
      userId: logContext.userId,
      ip: logContext.ip,
      params: requestBody
    });

    // JSON Schema 검증
    try {
      validateOrThrow(tool.function, requestBody);
    } catch (validationError: any) {
      aiLogger.logFunctionError({
        functionName: name,
        requestId,
        error: validationError.message || '파라미터 검증 실패'
      });

      return c.json({
        success: false,
        error: validationError.message || '파라미터 검증 실패',
        validationDetails: validationError.validationErrors
      }, validationError.status || 400);
    }

    // 핸들러 존재 여부 확인
    const handler = handlers[name];
    if (!handler) {
      const error = `${name} 핸들러가 아직 구현되지 않았습니다.`;
      aiLogger.logFunctionError({ functionName: name, requestId, error });
      
      return c.json({ success: false, error }, 501);
    }

    // 메트릭을 통한 함수 실행 (캐시는 캐시 미들웨어에서 처리됨)
    const result = await MetricsHelper.trackFunction(
      name,
      () => handler(requestBody),
      false // 캐시 히트 여부는 캐시 미들웨어에서 결정됨
    );
    
    return c.json({
      success: true,
      function: name,
      result,
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    aiLogger.logFunctionError({
      functionName: name,
      requestId,
      error: error.message || 'AI 함수 실행 중 오류가 발생했습니다.'
    });

    return c.json({
      success: false,
      error: error.message || 'AI 함수 실행 중 오류가 발생했습니다.',
      requestId
    }, 500);
  }
});

// GET /api/ai/tools - 사용 가능한 함수 목록 조회 (기본 레이트 리밋 적용)
apiAiToolsRoute.get('/tools', basicRateLimit, async (c) => {
  return c.json({
    success: true,
    totalCount: tools.length,
    functions: tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }))
  });
});

// GET /api/ai/tools/:name - 특정 함수 정보 조회 (기본 레이트 리밋 적용)
apiAiToolsRoute.get('/tools/:name', basicRateLimit, async (c) => {
  const { name } = c.req.param();
  const tool = tools.find(t => t.function.name === name);
  
  if (!tool) {
    return c.json({
      success: false,
      error: `함수를 찾을 수 없습니다: ${name}`
    }, 404);
  }

  // 함수별 메트릭도 함께 반환
  const metrics = MetricsHelper.getFunctionMetrics(name);
  const functionMetric = metrics.length > 0 ? metrics[0] : null;

  return c.json({
    success: true,
    function: tool.function,
    metrics: functionMetric ? {
      totalCalls: functionMetric.totalCalls,
      successRate: Math.round((functionMetric.successCalls / functionMetric.totalCalls) * 100),
      avgExecutionTime: Math.round(functionMetric.avgExecutionTime),
      cacheHitRate: functionMetric.totalCalls > 0 
        ? Math.round((functionMetric.cacheHits / functionMetric.totalCalls) * 100) 
        : 0,
      lastCalled: new Date(functionMetric.lastCalled).toISOString()
    } : null
  });
});

// === 모니터링 및 관리 엔드포인트 ===

// GET /api/ai/cache/stats - 캐시 통계 조회
apiAiToolsRoute.get('/cache/stats', basicRateLimit, cacheStatsMiddleware());

// POST /api/ai/cache/:action - 캐시 관리 (clear, cleanup, invalidate)
apiAiToolsRoute.post('/cache/:action', basicRateLimit, cacheManagementMiddleware());

// GET /api/ai/metrics/system - 시스템 메트릭 조회
apiAiToolsRoute.get('/metrics/system', basicRateLimit, async (c) => {
  try {
    const metrics = MetricsHelper.getSystemMetrics();
    
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error: any) {
    aiLogger.error('시스템 메트릭 조회 실패', error);
    return c.json({
      success: false,
      error: '시스템 메트릭 조회 중 오류가 발생했습니다.'
    }, 500);
  }
});

// GET /api/ai/metrics/functions - 함수별 메트릭 조회
apiAiToolsRoute.get('/metrics/functions', basicRateLimit, async (c) => {
  try {
    const functionName = c.req.query('function');
    const metrics = MetricsHelper.getFunctionMetrics(functionName);
    
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      functions: metrics.map(metric => ({
        name: metric.name,
        totalCalls: metric.totalCalls,
        successCalls: metric.successCalls,
        errorCalls: metric.errorCalls,
        successRate: Math.round((metric.successCalls / metric.totalCalls) * 100 * 100) / 100,
        cacheHitRate: metric.totalCalls > 0 
          ? Math.round((metric.cacheHits / metric.totalCalls) * 100 * 100) / 100 
          : 0,
        avgExecutionTime: Math.round(metric.avgExecutionTime),
        minExecutionTime: metric.minExecutionTime === Infinity ? 0 : metric.minExecutionTime,
        maxExecutionTime: metric.maxExecutionTime,
        lastCalled: new Date(metric.lastCalled).toISOString(),
        recentErrors: metric.errors.slice(-3) // 최근 3개 에러만
      }))
    });
  } catch (error: any) {
    aiLogger.error('함수 메트릭 조회 실패', error);
    return c.json({
      success: false,
      error: '함수 메트릭 조회 중 오류가 발생했습니다.'
    }, 500);
  }
});

// GET /api/ai/metrics/report - 종합 성능 리포트
apiAiToolsRoute.get('/metrics/report', basicRateLimit, async (c) => {
  try {
    const report = MetricsHelper.generatePerformanceReport();
    
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      report
    });
  } catch (error: any) {
    aiLogger.error('성능 리포트 생성 실패', error);
    return c.json({
      success: false,
      error: '성능 리포트 생성 중 오류가 발생했습니다.'
    }, 500);
  }
});

// GET /api/ai/rate-limit/status - 레이트 리밋 상태 조회
apiAiToolsRoute.get('/rate-limit/status', basicRateLimit, rateLimitStatusMiddleware());

// GET /api/ai/health - 헬스 체크
apiAiToolsRoute.get('/health', async (c) => {
  try {
    const { getHealthMetrics } = await import('../lib/metrics');
    const health = getHealthMetrics();
    
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default apiAiToolsRoute;