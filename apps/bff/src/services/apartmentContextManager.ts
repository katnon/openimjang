// 대화 컨텍스트에서 아파트 정보를 관리하는 서비스

export interface ApartmentInfo {
  id?: number; // DB의 oi.apt_info.id (primary key)
  name: string; // 아파트명
  region?: string; // 지역명
  lat?: number;
  lng?: number;
  source: 'attached' | 'mentioned' | 'vector_search'; // 어디서 온 정보인지
  addedAt: Date; // 언제 추가되었는지
  lastMentioned: Date; // 마지막 언급 시간
  metadata?: Record<string, any>; // 추가 메타데이터
}

export class ApartmentContextManager {
  private apartments: Map<string, ApartmentInfo> = new Map();
  private readonly TTL_MINUTES = 10; // 10분간 언급 없으면 제거
  
  constructor() {
    // 주기적으로 오래된 아파트 정보 정리
    setInterval(() => this.cleanup(), 60000); // 1분마다
  }

  /**
   * 아파트 정보를 컨텍스트에 추가/업데이트
   */
  addApartment(apartment: Omit<ApartmentInfo, 'addedAt' | 'lastMentioned'>): void {
    const key = this.getKey(apartment);
    const existing = this.apartments.get(key);
    
    const now = new Date();
    const apartmentInfo: ApartmentInfo = {
      ...apartment,
      addedAt: existing?.addedAt || now,
      lastMentioned: now,
      // ID가 있으면 더 정확한 정보로 업데이트
      id: apartment.id || existing?.id,
    };
    
    this.apartments.set(key, apartmentInfo);
    
    console.log(`🏢 아파트 컨텍스트 추가/업데이트: ${key}`, {
      source: apartment.source,
      hasId: !!apartment.id,
      totalCount: this.apartments.size
    });
  }

  /**
   * 아파트명으로 컨텍스트에서 검색
   */
  findByName(name: string): ApartmentInfo[] {
    const normalizedQuery = this.normalizeApartmentName(name);
    const results: ApartmentInfo[] = [];
    
    for (const [key, apartment] of this.apartments.entries()) {
      const normalizedAptName = this.normalizeApartmentName(apartment.name);
      
      // 완전 일치 우선
      if (normalizedAptName === normalizedQuery) {
        this.updateLastMentioned(key);
        return [apartment];
      }
      
      // 부분 일치
      if (normalizedAptName.includes(normalizedQuery) || normalizedQuery.includes(normalizedAptName)) {
        this.updateLastMentioned(key);
        results.push(apartment);
      }
    }
    
    // ID가 있는 것을 우선순위로 정렬
    return results.sort((a, b) => {
      if (a.id && !b.id) return -1;
      if (!a.id && b.id) return 1;
      // attached 소스를 우선시
      if (a.source === 'attached' && b.source !== 'attached') return -1;
      if (a.source !== 'attached' && b.source === 'attached') return 1;
      // 최근 언급된 순으로
      return b.lastMentioned.getTime() - a.lastMentioned.getTime();
    });
  }

  /**
   * ID로 정확한 아파트 찾기
   */
  findById(id: number): ApartmentInfo | undefined {
    for (const [key, apartment] of this.apartments.entries()) {
      if (apartment.id === id) {
        this.updateLastMentioned(key);
        return apartment;
      }
    }
    return undefined;
  }

  /**
   * 현재 컨텍스트의 모든 아파트 반환
   */
  getAllApartments(): ApartmentInfo[] {
    return Array.from(this.apartments.values())
      .sort((a, b) => b.lastMentioned.getTime() - a.lastMentioned.getTime());
  }

  /**
   * 특정 아파트의 마지막 언급 시간 업데이트
   */
  private updateLastMentioned(key: string): void {
    const apartment = this.apartments.get(key);
    if (apartment) {
      apartment.lastMentioned = new Date();
      this.apartments.set(key, apartment);
    }
  }

  /**
   * 아파트 정보의 고유 키 생성
   */
  private getKey(apartment: Pick<ApartmentInfo, 'id' | 'name' | 'region'>): string {
    if (apartment.id) {
      return `id:${apartment.id}`;
    }
    const normalizedName = this.normalizeApartmentName(apartment.name);
    const region = apartment.region || '';
    return `name:${normalizedName}:${region}`;
  }

  /**
   * 아파트명 정규화 (검색 정확도 향상)
   */
  private normalizeApartmentName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '') // 공백 제거
      .replace(/[아파트|apt|빌딩|타워|빌라]/g, '') // 일반적인 접미사 제거
      .trim();
  }

  /**
   * TTL 기반 오래된 아파트 정보 정리
   */
  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, apartment] of this.apartments.entries()) {
      const minutesSinceLastMention = (now.getTime() - apartment.lastMentioned.getTime()) / (1000 * 60);
      
      // attached 소스는 세션동안 유지, 나머지는 TTL 적용
      if (apartment.source !== 'attached' && minutesSinceLastMention > this.TTL_MINUTES) {
        expiredKeys.push(key);
      }
    }
    
    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => this.apartments.delete(key));
      console.log(`🧹 아파트 컨텍스트 정리: ${expiredKeys.length}개 제거, 남은 개수: ${this.apartments.size}`);
    }
  }

  /**
   * 디버깅을 위한 컨텍스트 상태 출력
   */
  getDebugInfo(): any {
    return {
      totalApartments: this.apartments.size,
      apartments: Array.from(this.apartments.entries()).map(([key, apt]) => ({
        key,
        name: apt.name,
        id: apt.id,
        source: apt.source,
        addedAt: apt.addedAt,
        lastMentioned: apt.lastMentioned,
        minutesSinceLastMention: Math.floor((Date.now() - apt.lastMentioned.getTime()) / (1000 * 60))
      }))
    };
  }
}

// 싱글톤 인스턴스
export const apartmentContextManager = new ApartmentContextManager();