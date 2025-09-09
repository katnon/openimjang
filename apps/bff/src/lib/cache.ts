/**
 * 캐시 매니저 - 메모리 기반 (향후 Redis 확장 가능)
 */

import crypto from 'node:crypto';
import { getEnvCacheTTL, shouldCache } from '../config/cache.config';

// 캐시 엔트리 인터페이스
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

// 캐시 통계
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

/**
 * 메모리 기반 캐시 매니저 (Singleton)
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  /**
   * 캐시 키 생성 - SHA256 해시 기반
   */
  generateKey(functionName: string, params: any): string {
    // 파라미터를 정규화하여 키 생성의 일관성 보장
    const normalized = this.normalizeParams(params);
    const paramString = JSON.stringify(normalized);
    const hash = crypto.createHash('sha256').update(paramString).digest('hex').slice(0, 16);
    
    return `ai_tool:${functionName}:${hash}`;
  }

  /**
   * 파라미터 정규화 - 순서에 관계없이 동일한 키 생성
   */
  private normalizeParams(params: any): any {
    if (params === null || params === undefined) {
      return null;
    }
    
    if (typeof params !== 'object') {
      return params;
    }

    if (Array.isArray(params)) {
      return params.map(item => this.normalizeParams(item));
    }

    // 객체는 키 순서로 정렬
    const sortedObj: any = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        sortedObj[key] = this.normalizeParams(params[key]);
      });

    return sortedObj;
  }

  /**
   * 캐시에서 값 조회
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // TTL 체크
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.deletes++;
      this.stats.misses++;
      return null;
    }

    // 히트 수 증가
    entry.hits++;
    this.stats.hits++;
    
    return entry.data;
  }

  /**
   * 캐시에 값 저장
   */
  set<T = any>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    };

    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * 캐시에서 특정 키 삭제
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * 패턴으로 캐시 키 삭제 (예: ai_tool:geocodeAddress:*)
   */
  deleteByPattern(pattern: string): number {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deletedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    this.stats.deletes += deletedCount;
    return deletedCount;
  }

  /**
   * 만료된 캐시 엔트리 정리
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    this.stats.deletes += cleanedCount;
    return cleanedCount;
  }

  /**
   * 전체 캐시 초기화
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.deletes += size;
    
    // 통계는 유지하되 크기 관련 정보만 리셋
    console.log(`🧹 캐시 전체 초기화: ${size}개 엔트리 삭제`);
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * 캐시 정보 상세 조회 (디버그용)
   */
  getDetails(): Array<{key: string, age: number, ttl: number, hits: number, size: number}> {
    const now = Date.now();
    const details: Array<{key: string, age: number, ttl: number, hits: number, size: number}> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      const size = JSON.stringify(entry.data).length;
      
      details.push({
        key,
        age,
        ttl: entry.ttl,
        hits: entry.hits,
        size
      });
    }
    
    return details.sort((a, b) => b.hits - a.hits); // 히트 수 기준 내림차순
  }
}

// Singleton 인스턴스
const cacheManager = new MemoryCache();

/**
 * 캐시 헬퍼 함수들
 */
export class CacheHelper {
  /**
   * AI 함수 결과 캐싱
   */
  static async cacheFunction<T>(
    functionName: string, 
    params: any, 
    executor: () => Promise<T>
  ): Promise<T> {
    // 캐시 비활성화된 함수는 바로 실행
    if (!shouldCache(functionName)) {
      return await executor();
    }

    const key = cacheManager.generateKey(functionName, params);
    
    // 캐시에서 조회 시도
    const cached = cacheManager.get<T>(key);
    if (cached !== null) {
      console.log(`💾 캐시 히트: ${functionName} (${key.slice(-8)})`);
      return cached;
    }

    // 캐시 미스 - 실제 함수 실행
    console.log(`🔄 캐시 미스: ${functionName} 실행 중...`);
    const startTime = Date.now();
    
    try {
      const result = await executor();
      const executionTime = Date.now() - startTime;
      
      // 결과를 캐시에 저장
      const ttl = getEnvCacheTTL(functionName);
      cacheManager.set(key, result, ttl);
      
      console.log(`✅ 캐시 저장: ${functionName} (${executionTime}ms, TTL: ${Math.round(ttl/1000)}s)`);
      
      return result;
    } catch (error) {
      console.error(`❌ 함수 실행 실패: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * 함수별 캐시 무효화
   */
  static invalidateFunction(functionName: string): number {
    const pattern = `ai_tool:${functionName}:*`;
    const deletedCount = cacheManager.deleteByPattern(pattern);
    console.log(`🗑️  ${functionName} 캐시 ${deletedCount}개 무효화`);
    return deletedCount;
  }

  /**
   * 만료된 캐시 정리
   */
  static cleanup(): number {
    const cleanedCount = cacheManager.cleanup();
    if (cleanedCount > 0) {
      console.log(`🧹 만료된 캐시 ${cleanedCount}개 정리`);
    }
    return cleanedCount;
  }

  /**
   * 캐시 통계 조회
   */
  static getStats(): CacheStats {
    return cacheManager.getStats();
  }

  /**
   * 캐시 상세 정보 조회
   */
  static getDetails() {
    return cacheManager.getDetails();
  }

  /**
   * 전체 캐시 초기화
   */
  static clear(): void {
    cacheManager.clear();
  }
}

// 주기적 캐시 정리 (5분마다)
setInterval(() => {
  CacheHelper.cleanup();
}, 5 * 60 * 1000);

export { cacheManager };