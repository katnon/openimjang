/**
 * Swagger UI 라우터 - OpenAPI 3.0 자동 문서화
 */

import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { getOpenAPIJson } from '../lib/openapi';
import { basicRateLimit } from '../middleware/rateLimit';

const swaggerRoute = new Hono();

// 개발환경에서만 Swagger UI 접근 허용 (로컬 개발시에는 항상 접근 가능)
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

// OpenAPI JSON 스펙 제공 엔드포인트
swaggerRoute.get('/openapi.json', basicRateLimit, async (c) => {
  if (!isDevelopment) {
    return c.json({
      success: false,
      error: 'API 문서는 개발환경에서만 접근 가능합니다.'
    }, 403);
  }

  try {
    const spec = getOpenAPIJson();
    
    // CORS 헤더 추가 (Swagger UI에서 접근 가능하도록)
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    
    return c.json(spec);
  } catch (error: any) {
    console.error('❌ OpenAPI 스펙 생성 실패:', error);
    return c.json({
      success: false,
      error: 'OpenAPI 스펙 생성 중 오류가 발생했습니다.'
    }, 500);
  }
});

// Swagger UI 제공 엔드포인트
swaggerRoute.get('/docs', async (c) => {
  if (!isDevelopment) {
    return c.html(`
      <html>
        <head>
          <title>API 문서 - 접근 제한</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
            .info { color: #3498db; }
          </style>
        </head>
        <body>
          <h1 class="error">🚫 접근 제한</h1>
          <p class="info">API 문서는 개발환경에서만 접근 가능합니다.</p>
          <p>프로덕션 환경에서는 보안상의 이유로 API 문서를 제공하지 않습니다.</p>
        </body>
      </html>
    `, 403);
  }

  // Swagger UI 설정
  return swaggerUI({
    url: '/api/docs/openapi.json',
    config: {
      deepLinking: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    }
  })(c);
});

// Swagger UI 리소스 접근용 (개발환경만)
swaggerRoute.get('/docs/*', async (c) => {
  if (!isDevelopment) {
    return c.json({
      success: false,
      error: 'API 문서는 개발환경에서만 접근 가능합니다.'
    }, 403);
  }

  // swaggerUI에서 자동 처리
  return swaggerUI({
    url: '/api/docs/openapi.json'
  })(c);
});

// API 문서 메인 페이지 (리다이렉트)
swaggerRoute.get('/', async (c) => {
  if (!isDevelopment) {
    return c.json({
      success: false,
      error: 'API 문서는 개발환경에서만 접근 가능합니다.',
      availableEndpoints: [
        'GET /api/ai/health - 헬스 체크',
        'GET /api/ai/tools - AI 함수 목록',
        'POST /api/ai/tools/{name} - AI 함수 실행'
      ]
    }, 403);
  }

  return c.redirect('/api/docs/docs');
});

// API 정보 제공 (항상 접근 가능)
swaggerRoute.get('/info', basicRateLimit, async (c) => {
  const toolsCount = require('../ai/tools').tools.length;
  
  return c.json({
    success: true,
    apiInfo: {
      title: 'OpenImjang AI Tools API',
      version: '1.0.0',
      description: 'AI 기반 부동산 분석 도구 API',
      totalFunctions: toolsCount,
      categories: {
        realestate: '부동산 분석 함수 (12개)',
        geo: '지리정보 함수 (8개)',
        monitoring: '모니터링 API (3개)',
        cache: '캐시 관리 API (4개)'
      }
    },
    endpoints: {
      documentation: isDevelopment ? '/api/docs/docs' : '개발환경에서만 접근 가능',
      openapi: isDevelopment ? '/api/docs/openapi.json' : '개발환경에서만 접근 가능',
      health: '/api/ai/health',
      tools: '/api/ai/tools',
      metrics: '/api/ai/metrics/system'
    },
    rateLimit: {
      basic: '30 요청/분 (IP 기준)',
      functions: '함수별 차등 적용',
      development: isDevelopment ? '1000 요청/분' : '프로덕션 제한'
    },
    cache: {
      geo: '24시간 캐시',
      price: '1시간 캐시',
      search: '5분 캐시'
    }
  });
});

// OpenAPI 스펙 검증 엔드포인트 (개발용)
swaggerRoute.get('/validate', basicRateLimit, async (c) => {
  if (!isDevelopment) {
    return c.json({
      success: false,
      error: '검증 기능은 개발환경에서만 사용 가능합니다.'
    }, 403);
  }

  try {
    const spec = getOpenAPIJson();
    const pathCount = Object.keys(spec.paths).length;
    const toolsCount = require('../ai/tools').tools.length;
    
    // 기본 검증
    const validation = {
      specVersion: spec.openapi,
      pathsCount: pathCount,
      toolsCount: toolsCount,
      pathsMatchTools: pathCount >= toolsCount,
      hasInfo: !!spec.info,
      hasServers: spec.servers.length > 0,
      hasComponents: !!spec.components,
      valid: true
    };

    // AI Tools 경로 검증
    const { tools } = require('../ai/tools');
    const missingPaths = [];
    const extraPaths = [];
    
    for (const tool of tools) {
      const expectedPath = `/api/ai/tools/${tool.function.name}`;
      if (!spec.paths[expectedPath]) {
        missingPaths.push(expectedPath);
        validation.valid = false;
      }
    }

    validation.valid = validation.valid && missingPaths.length === 0;

    return c.json({
      success: true,
      validation: {
        ...validation,
        issues: {
          missingPaths,
          extraPaths
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: '스펙 검증 중 오류가 발생했습니다.',
      details: error.message
    }, 500);
  }
});

export default swaggerRoute;