/**
 * 레이트 리밋 미들웨어 - hono-rate-limiter 기반
 */

import { rateLimiter } from 'hono-rate-limiter';
import { Context } from 'hono';

/**
 * 기본 레이트 리밋 설정
 */
const DEFAULT_RATE_LIMIT = {
  windowMs: 60 * 1000,  // 1분
  limit: 30,            // IP당 30회
  message: {
    success: false,
    error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: 60
  }
};

/**
 * 기본 AI 함수용 레이트 리미터
 */
export const basicRateLimit = rateLimiter({
  windowMs: DEFAULT_RATE_LIMIT.windowMs,
  limit: DEFAULT_RATE_LIMIT.limit,
  message: DEFAULT_RATE_LIMIT.message,
  keyGenerator: (c: Context) => {
    // IP 주소 기반 키 생성 (프록시 고려)
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    const remoteAddress = forwarded?.split(',')[0].trim() || realIP || 'anonymous';
    
    return `rate_limit:${remoteAddress}`;
  },
  onLimitReached: (c: Context) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    console.warn(`🚨 레이트 리밋 도달: IP ${ip}, URL ${c.req.url}`);
  }
});

/**
 * 엄격한 레이트 리밋 (민감한 함수용)
 */
export const strictRateLimit = rateLimiter({
  windowMs: 60 * 1000,  // 1분
  limit: 10,            // IP당 10회로 제한
  message: {
    success: false,
    error: '이 기능은 사용 제한이 있습니다. 1분 후 다시 시도해주세요.',
    retryAfter: 60
  },
  keyGenerator: (c: Context) => {
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    const remoteAddress = forwarded?.split(',')[0].trim() || realIP || 'anonymous';
    const functionName = c.req.param('name') || 'unknown';
    
    return `strict_rate_limit:${remoteAddress}:${functionName}`;
  }
});

/**
 * 사용자 기반 레이트 리밋 (인증된 사용자용)
 */
export const userRateLimit = rateLimiter({
  windowMs: 60 * 1000,  // 1분
  limit: 60,            // 인증된 사용자는 더 많이 허용
  message: {
    success: false,
    error: '사용자별 요청 한도를 초과했습니다. 1분 후 다시 시도해주세요.',
    retryAfter: 60
  },
  keyGenerator: (c: Context) => {
    // 사용자 ID가 있으면 사용자 기반, 없으면 IP 기반
    const userId = c.get('userId') || c.get('user')?.uid;
    if (userId) {
      return `user_rate_limit:${userId}`;
    }
    
    // fallback to IP
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    const remoteAddress = forwarded?.split(',')[0].trim() || realIP || 'anonymous';
    
    return `user_rate_limit:ip:${remoteAddress}`;
  }
});

/**
 * 함수별 맞춤 레이트 리밋 설정
 */
const FUNCTION_RATE_LIMITS = {
  // 비용이 높은 함수들 - 더 엄격한 제한
  'searchRealEstateDeals': { windowMs: 60 * 1000, limit: 10 },
  'getPriceTrends': { windowMs: 60 * 1000, limit: 10 },
  'compareMultipleApartments': { windowMs: 60 * 1000, limit: 5 },
  
  // 지리 정보 함수 - 중간 제한
  'geocodeAddress': { windowMs: 60 * 1000, limit: 20 },
  'reverseGeocode': { windowMs: 60 * 1000, limit: 20 },
  'getNearbyByCoords': { windowMs: 60 * 1000, limit: 15 },
  
  // 간단한 조회 함수 - 관대한 제한
  'lookupLegalDongCode': { windowMs: 60 * 1000, limit: 50 },
  'convertDongCode': { windowMs: 60 * 1000, limit: 50 },
} as const;

/**
 * 함수별 동적 레이트 리밋 생성
 */
export function createFunctionRateLimit(functionName: string) {
  const config = FUNCTION_RATE_LIMITS[functionName as keyof typeof FUNCTION_RATE_LIMITS] 
    || DEFAULT_RATE_LIMIT;
  
  return rateLimiter({
    windowMs: config.windowMs,
    limit: config.limit,
    message: {
      success: false,
      error: `${functionName} 함수의 요청 한도를 초과했습니다. ${Math.round(config.windowMs / 1000)}초 후 다시 시도해주세요.`,
      retryAfter: Math.round(config.windowMs / 1000),
      functionName
    },
    keyGenerator: (c: Context) => {
      const forwarded = c.req.header('x-forwarded-for');
      const realIP = c.req.header('x-real-ip');
      const remoteAddress = forwarded?.split(',')[0].trim() || realIP || 'anonymous';
      
      return `function_rate_limit:${functionName}:${remoteAddress}`;
    },
    onLimitReached: (c: Context) => {
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      console.warn(`🚨 함수별 레이트 리밋 도달: ${functionName}, IP ${ip}`);
    }
  });
}

/**
 * 개발환경용 관대한 레이트 리밋
 */
export const developmentRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1000,  // 개발환경에서는 매우 관대하게
  message: {
    success: false,
    error: '개발환경 레이트 리밋 도달',
    retryAfter: 60
  },
  keyGenerator: (c: Context) => 'dev_rate_limit'
});

/**
 * 환경에 따른 레이트 리밋 선택
 */
export function getEnvironmentRateLimit() {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development') {
    return developmentRateLimit;
  }
  
  return basicRateLimit;
}

/**
 * 레이트 리밋 상태 조회 미들웨어
 */
export const rateLimitStatusMiddleware = () => {
  return async (c: Context) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const userId = c.get('userId') || c.get('user')?.uid;
    
    // 실제 레이트 리밋 상태 조회는 hono-rate-limiter에서 직접 지원하지 않으므로
    // 대략적인 정보만 반환
    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      client: {
        ip: ip.split(',')[0]?.trim() || 'unknown',
        userId: userId || null,
        userAgent: c.req.header('user-agent')?.slice(0, 100) || 'unknown'
      },
      rateLimits: {
        basic: `${DEFAULT_RATE_LIMIT.limit} requests per ${DEFAULT_RATE_LIMIT.windowMs / 1000}s`,
        authenticated: userId ? '60 requests per 60s' : 'Not authenticated',
        environment: process.env.NODE_ENV || 'development'
      },
      note: '실시간 사용량 조회는 Redis 기반 구현시 지원됩니다.'
    });
  };
};