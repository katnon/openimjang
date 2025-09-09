/**
 * 캐시 미들웨어 - Hono용
 */

import { Context, Next } from 'hono';
import { CacheHelper } from '../lib/cache';

/**
 * AI 함수 호출용 캐시 미들웨어
 */
export const cacheMiddleware = () => {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    const functionName = c.req.param('name');
    
    // POST 요청이고 function name이 있는 경우만 캐싱 적용
    if (method !== 'POST' || !functionName) {
      await next();
      return;
    }

    try {
      // 요청 바디를 미리 파싱 (한 번만 읽기 위해)
      const body = await c.req.json();
      
      // 캐시 헬퍼를 사용해서 함수 결과 캐싱
      const result = await CacheHelper.cacheFunction(
        functionName,
        body,
        async () => {
          // 원본 요청 바디를 다시 설정 (미들웨어 체인에서 사용할 수 있도록)
          c.req = new Request(c.req.url, {
            method: c.req.method,
            headers: c.req.headers,
            body: JSON.stringify(body)
          });
          
          // 다음 미들웨어로 진행
          await next();
          
          // 응답 결과를 JSON으로 파싱해서 반환
          const response = c.res;
          if (response.status === 200) {
            const responseText = await response.text();
            return JSON.parse(responseText);
          } else {
            // 에러 응답은 캐시하지 않고 그대로 던짐
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }
        }
      );

      // 캐시된 결과를 응답으로 설정
      return c.json(result);

    } catch (error: any) {
      console.error('❌ 캐시 미들웨어 오류:', error);
      
      // 캐시 오류가 발생하면 일반 처리로 fallback
      await next();
    }
  };
};

/**
 * 캐시 통계 조회용 미들웨어
 */
export const cacheStatsMiddleware = () => {
  return async (c: Context) => {
    const stats = CacheHelper.getStats();
    const details = CacheHelper.getDetails();
    
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        stats,
        topCached: details.slice(0, 10), // 상위 10개 캐시 항목
        summary: {
          totalSize: details.reduce((sum, item) => sum + item.size, 0),
          avgHits: details.length > 0 ? Math.round(details.reduce((sum, item) => sum + item.hits, 0) / details.length) : 0,
          oldestEntry: details.length > 0 ? Math.max(...details.map(item => item.age)) : 0
        }
      }
    });
  };
};

/**
 * 캐시 관리용 미들웨어 (무효화, 정리 등)
 */
export const cacheManagementMiddleware = () => {
  return async (c: Context) => {
    const action = c.req.param('action');
    const functionName = c.req.query('function');
    
    switch (action) {
      case 'clear':
        CacheHelper.clear();
        return c.json({
          success: true,
          message: '전체 캐시가 초기화되었습니다.'
        });
        
      case 'cleanup':
        const cleanedCount = CacheHelper.cleanup();
        return c.json({
          success: true,
          message: `만료된 캐시 ${cleanedCount}개가 정리되었습니다.`,
          cleanedCount
        });
        
      case 'invalidate':
        if (!functionName) {
          return c.json({
            success: false,
            error: 'function 쿼리 파라미터가 필요합니다.'
          }, 400);
        }
        
        const invalidatedCount = CacheHelper.invalidateFunction(functionName);
        return c.json({
          success: true,
          message: `${functionName} 함수의 캐시 ${invalidatedCount}개가 무효화되었습니다.`,
          invalidatedCount
        });
        
      default:
        return c.json({
          success: false,
          error: '지원하지 않는 액션입니다.',
          availableActions: ['clear', 'cleanup', 'invalidate']
        }, 400);
    }
  };
};