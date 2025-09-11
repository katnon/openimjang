// apps/bff/src/ai/clarify/matcher.ts
// 부분 일치 처리 및 후보 검색 로직

import { db } from '../../lib/db';
import { sql } from 'kysely';
import { ApartmentCandidate, ClarifyReason } from './types';

/**
 * 아파트 후보 검색기
 */
export class ApartmentMatcher {
  
  /**
   * 부분 아파트명으로 후보 검색
   */
  async searchCandidates(partialName: string, region?: string, limit: number = 10): Promise<ApartmentCandidate[]> {
    try {
      console.log('🔍 아파트 후보 검색:', { partialName, region, limit });

      let query = db
        .selectFrom('oi.apt_info')
        .select(['id', 'apt_nm', 'jibun_address'])
        .where('apt_nm', 'ilike', `%${partialName}%`)
        .limit(limit);

      // 지역 필터 추가
      if (region) {
        query = query.where('jibun_address', 'ilike', `%${region}%`);
      }

      const results = await query.execute();

      // 유사도 점수 계산 및 변환
      const candidates: ApartmentCandidate[] = results.map(row => {
        const score = this.calculateSimilarity(partialName, row.apt_nm);
        
        return {
          aptId: row.id,
          aptName: row.apt_nm,
          region: row.jibun_address || '',
          score: Math.round(score * 100) / 100, // 소수점 2자리까지
          complexNumbers: this.extractComplexNumbers(row.apt_nm)
        };
      });

      // 점수순으로 정렬
      candidates.sort((a, b) => b.score - a.score);

      console.log(`✅ 후보 ${candidates.length}개 검색 완료`);
      return candidates;

    } catch (error: any) {
      console.error('❌ 아파트 후보 검색 실패:', error);
      return [];
    }
  }

  /**
   * 단지번호 후보 검색
   */
  async searchComplexNumbers(apartmentName: string): Promise<string[]> {
    try {
      const results = await db
        .selectFrom('oi.apt_info')
        .select(['apt_nm'])
        .where('apt_nm', 'ilike', `%${apartmentName}%`)
        .execute();

      const complexNumbers = new Set<string>();
      
      results.forEach(row => {
        const numbers = this.extractComplexNumbers(row.apt_nm);
        numbers.forEach(num => complexNumbers.add(num));
      });

      return Array.from(complexNumbers).sort();

    } catch (error: any) {
      console.error('❌ 단지번호 검색 실패:', error);
      return [];
    }
  }

  /**
   * 문자열 유사도 계산 (레벤슈타인 거리 기반)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;

    // 부분 일치 보너스
    if (str2.includes(str1)) {
      return 0.8 + (str1.length / str2.length) * 0.2;
    }
    if (str1.includes(str2)) {
      return 0.7 + (str2.length / str1.length) * 0.2;
    }

    // 레벤슈타인 거리 계산
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    
    return (maxLen - distance) / maxLen;
  }

  /**
   * 아파트명에서 단지번호 추출
   */
  private extractComplexNumbers(apartmentName: string): string[] {
    const numbers: string[] = [];
    
    // 패턴: 숫자 + (단지|차|동)
    const patterns = [
      /(\d+)단지/g,
      /(\d+)차/g,
      /(\d+)동/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(apartmentName)) !== null) {
        const number = match[1];
        const suffix = match[0].replace(number, '');
        numbers.push(number + suffix);
      }
    });

    return [...new Set(numbers)]; // 중복 제거
  }

  /**
   * 아파트명 애매함 정도 판단
   */
  determineAmbiguityReason(
    inputName: string, 
    candidates: ApartmentCandidate[]
  ): { reason: ClarifyReason; needsClarification: boolean } {
    
    if (!inputName || inputName.trim().length === 0) {
      return { reason: 'missing', needsClarification: true };
    }

    if (candidates.length === 0) {
      return { reason: 'invalid', needsClarification: true };
    }

    if (candidates.length === 1) {
      const candidate = candidates[0];
      if (candidate.score >= 0.9) {
        // 높은 신뢰도 - 확인만 필요
        return { reason: 'confirmation', needsClarification: false };
      } else if (candidate.score >= 0.7) {
        // 중간 신뢰도 - 확인 필요
        return { reason: 'confirmation', needsClarification: true };
      } else {
        // 낮은 신뢰도 - 부분 일치
        return { reason: 'partial', needsClarification: true };
      }
    }

    // 여러 후보가 있는 경우
    const topScore = candidates[0].score;
    const secondScore = candidates[1]?.score || 0;

    if (topScore >= 0.9 && topScore - secondScore >= 0.2) {
      // 확실한 최고 후보
      return { reason: 'confirmation', needsClarification: true };
    } else {
      // 애매한 경우
      return { reason: 'ambiguous', needsClarification: true };
    }
  }

  /**
   * 일반적인 면적 후보 제공
   */
  getCommonAreas(): string[] {
    return ['32', '42', '59', '74', '84', '101', '114', '129', '149'];
  }

  /**
   * 특정 아파트의 실제 면적 정보 검색
   */
  async getApartmentAreas(apartmentName: string): Promise<string[]> {
    try {
      const results = await db
        .selectFrom('oi.apt_deal_all')
        .select(['exclu_use_ar'])
        .where('apt_nm', 'ilike', `%${apartmentName}%`)
        .where('exclu_use_ar', 'is not', null)
        .groupBy(['exclu_use_ar'])
        .orderBy('exclu_use_ar', 'asc')
        .limit(20)
        .execute();

      return results.map(row => row.exclu_use_ar!.toString());

    } catch (error: any) {
      console.error('❌ 아파트 면적 정보 검색 실패:', error);
      return this.getCommonAreas();
    }
  }
}

/**
 * 기본 매처 인스턴스
 */
export const apartmentMatcher = new ApartmentMatcher();