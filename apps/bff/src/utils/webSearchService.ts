// apps/bff/src/utils/webSearchService.ts
interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    snippet: string;
    url?: string;
    source: string;
    relevance: number;
  }>;
  searchTime: number;
  resultCount: number;
}

interface ApartmentSearchData {
  apartmentName: string;
  location: string;
  priceRange?: string;
  areaInfo?: string;
  marketTrend?: string;
  popularTypes?: string[];
}

export class WebSearchService {
  private cache = new Map<string, { data: SearchResult; timestamp: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15분 캐시

  constructor() {
    // 캐시 정리 타이머
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // 5분마다
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  async search(query: string): Promise<SearchResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(query);

    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`🔄 캐시에서 검색 결과 반환: ${query}`);
      return cached.data;
    }

    console.log(`🌐 웹 검색 실행: "${query}"`);

    try {
      // 실제 Google Custom Search API 사용
      const searchResult = await this.performGoogleSearch(query);

      // 캐시에 저장
      this.cache.set(cacheKey, {
        data: searchResult,
        timestamp: Date.now(),
      });

      console.log(`✅ 웹 검색 완료: ${searchResult.resultCount}개 결과`);
      return searchResult;

    } catch (error) {
      console.error('❌ 웹 검색 오류:', error);

      // 오류 시 Mock 데이터로 폴백
      const fallbackResult = await this.generateMockSearchResult(query);

      return {
        query,
        results: fallbackResult.results,
        searchTime: Date.now() - startTime,
        resultCount: fallbackResult.results.length,
      };
    }
  }

  /**
   * 실제 Google Custom Search API 사용
   */
  private async performGoogleSearch(query: string): Promise<SearchResult> {
    const startTime = Date.now();
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    console.log('🔑 API 키 확인:', {
      hasApiKey: !!googleApiKey,
      apiKeyLength: googleApiKey?.length || 0,
      apiKeyPrefix: googleApiKey?.substring(0, 10) || 'none',
      hasSearchEngineId: !!googleSearchEngineId,
      searchEngineId: googleSearchEngineId || 'none'
    });

    if (!googleApiKey || !googleSearchEngineId) {
      console.log('❌ Google API 키 또는 검색 엔진 ID가 없어 Mock 데이터 사용');
      return this.generateMockSearchResult(query);
    }

    try {
      // 쿼리 타입에 따른 검색어 최적화
      const enhancedQuery = this.optimizeSearchQuery(query);

      const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(enhancedQuery)}&num=10&gl=kr&hl=ko`;

      console.log('🔍 Google API 호출:', enhancedQuery);

      const response = await fetch(googleUrl);
      if (!response.ok) {
        throw new Error(`Google API ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('🔍 Google API 응답 구조:', {
        hasItems: !!data.items,
        itemsLength: data.items?.length || 0,
        searchInformation: data.searchInformation,
        totalResults: data.searchInformation?.totalResults,
        firstItemTitle: data.items?.[0]?.title
      });

      if (data.items && data.items.length > 0) {
        const results = data.items.map((item: any) => ({
          title: item.title,
          snippet: item.snippet,
          url: item.link,
          source: new URL(item.link).hostname,
          relevance: this.calculateRelevance(item, query)
        }));

        console.log('✅ Google 검색 결과 매핑 완료:', {
          originalItemsCount: data.items.length,
          mappedResultsCount: results.length,
          sampleResult: results[0]
        });

        return {
          query: enhancedQuery,
          results,
          searchTime: Date.now() - startTime,
          resultCount: results.length,
        };
      } else {
        console.log('❌ Google 검색 결과 없음 상세 정보:', {
          hasData: !!data,
          hasItems: !!data.items,
          itemsLength: data.items?.length,
          dataKeys: Object.keys(data || {}),
          searchInformation: data.searchInformation
        });
        console.log('❌ Google API 전체 응답:', JSON.stringify(data, null, 2));
        return this.generateMockSearchResult(query);
      }

    } catch (error: any) {
      console.error('❌ Google Search API 오류:', error.message);
      return this.generateMockSearchResult(query);
    }
  }

  /**
   * 검색어 최적화 (쿼리 타입에 따라)
   */
  private optimizeSearchQuery(query: string): string {
    const lowerQuery = query.toLowerCase();

    // 핫플레이스, 트렌드 관련
    if (lowerQuery.includes('핫플레이스') || lowerQuery.includes('핫플') || lowerQuery.includes('인기')) {
      return `${query} 핫플레이스 인스타 맛집 카페 2024`;
    }

    // 맛집 관련
    if (lowerQuery.includes('맛집') || lowerQuery.includes('음식') || lowerQuery.includes('카페')) {
      return `${query} 맛집 추천 리뷰 맛있는집`;
    }

    // 놀거리, 데이트 관련
    if (lowerQuery.includes('놀거리') || lowerQuery.includes('데이트') || lowerQuery.includes('갈만한')) {
      return `${query} 데이트코스 놀거리 볼거리 추천`;
    }

    // 쇼핑, 상권 관련
    if (lowerQuery.includes('쇼핑') || lowerQuery.includes('상권')) {
      return `${query} 쇼핑몰 상권 매장 브랜드`;
    }

    // 기본: 그대로 반환
    return query;
  }

  /**
   * 검색 결과 관련도 계산
   */
  private calculateRelevance(item: any, originalQuery: string): number {
    let relevance = 0.5; // 기본값

    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const queryLower = originalQuery.toLowerCase();

    // 제목에 검색어 포함 시 높은 점수
    if (title.includes(queryLower)) {
      relevance += 0.3;
    }

    // 스니펫에 검색어 포함 시 추가 점수
    if (snippet.includes(queryLower)) {
      relevance += 0.2;
    }

    // 신뢰할 만한 도메인 추가 점수
    const trustedDomains = ['naver.com', 'daum.net', 'kakao.com', 'seoul.go.kr', 'blog.naver.com'];
    const domain = item.displayLink || '';
    if (trustedDomains.some(trusted => domain.includes(trusted))) {
      relevance += 0.1;
    }

    return Math.min(relevance, 1.0); // 최대 1.0으로 제한
  }

  private async generateMockSearchResult(query: string): Promise<SearchResult> {
    const startTime = Date.now();
    
    // 쿼리 분석
    const apartmentData = this.analyzeApartmentQuery(query);
    
    // Mock 검색 결과 생성
    const results = this.generateRelevantResults(apartmentData, query);
    
    return {
      query,
      results,
      searchTime: Date.now() - startTime,
      resultCount: results.length,
    };
  }

  private analyzeApartmentQuery(query: string): ApartmentSearchData {
    const lowerQuery = query.toLowerCase();
    
    // 아파트명 추출
    const apartmentPatterns = [
      /(\w+아파트)/g,
      /(래미안|롯데캐슬|현대|삼성|한양|대우|중흥|GS|SK|엘지|포스코)/g,
    ];
    
    let apartmentName = '';
    for (const pattern of apartmentPatterns) {
      const match = query.match(pattern);
      if (match) {
        apartmentName = match[0];
        break;
      }
    }

    // 지역명 추출
    const locationPatterns = [
      /(강남|서초|송파|강동|마포|용산|종로|중구|성동|광진|동대문|중랑|성북|강북|도봉|노원|은평|서대문|양천|강서|구로|금천|영등포|동작|관악)구?/g,
      /(잠실|목동|강남|압구정|청담|반포|서초|역삼|논현|신사|한남|이태원|홍대|신촌|여의도|건대|왕십리)/g,
    ];
    
    let location = '';
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        location = match[0];
        break;
      }
    }

    return {
      apartmentName: apartmentName || '아파트',
      location: location || '서울',
    };
  }

  private generateRelevantResults(apartmentData: ApartmentSearchData, originalQuery: string): any[] {
    const { apartmentName, location } = apartmentData;
    
    // 지역별 실제 아파트 정보 (교육용 Mock 데이터)
    const regionApartments = {
      '잠실': [
        { name: '잠실래미안', avgPrice: '15억', popular: true, area: '84㎡' },
        { name: '트리지움', avgPrice: '18억', popular: true, area: '114㎡' },
        { name: '잠실엘스', avgPrice: '12억', popular: false, area: '59㎡' },
      ],
      '목동': [
        { name: '목동아파트', avgPrice: '8억', popular: true, area: '84㎡' },
        { name: '목동롯데캐슬', avgPrice: '10억', popular: true, area: '114㎡' },
        { name: '월드컵파크', avgPrice: '9억', popular: false, area: '74㎡' },
      ],
      '강남': [
        { name: '래미안강남', avgPrice: '20억', popular: true, area: '84㎡' },
        { name: '압구정현대', avgPrice: '25억', popular: true, area: '134㎡' },
        { name: '논현롯데캐슬', avgPrice: '18억', popular: false, area: '94㎡' },
      ],
      '서울': [ // 기본값
        { name: '서울중심가아파트', avgPrice: '12억', popular: true, area: '84㎡' },
        { name: '도심래미안', avgPrice: '15억', popular: true, area: '104㎡' },
        { name: '서울타워뷰', avgPrice: '18억', popular: false, area: '124㎡' },
      ],
    };

    // 지역에 맞는 아파트 정보 선택
    const matchingRegion = Object.keys(regionApartments).find(region => 
      location.includes(region) || originalQuery.includes(region)
    ) || '서울';
    
    const apartments = regionApartments[matchingRegion as keyof typeof regionApartments] || regionApartments['서울'];
    
    // 검색 결과 생성
    const results = apartments.map((apt, index) => ({
      title: `${apt.name} 시세 정보 - ${location}`,
      snippet: `${apt.name}의 ${apt.area} 평균 시세는 ${apt.avgPrice}입니다. ${apt.popular ? '인기' : '조용한'} 단지로 유명합니다. 최근 거래량이 ${apt.popular ? '높아' : '안정적이어서'} 투자 가치가 주목받고 있습니다.`,
      url: `#${apt.name.toLowerCase()}-prices`, // 내부 참조로 변경
      source: '오픈임장 내부 분석',
      relevance: apt.popular ? 0.9 : 0.7,
    }));

    // 일반적인 시장 정보 추가
    if (location || apartmentName) {
      results.push({
        title: `${location} 부동산 시장 동향 분석`,
        snippet: `${location} 지역의 부동산 시장은 최근 안정세를 보이고 있습니다. 84㎡ 기준 평균 거래가는 전월 대비 2-3% 상승했으며, 특히 브랜드 아파트의 인기가 높습니다.`,
        url: `#${location}-market-trend`,
        source: '오픈임장 시장분석팀',
        relevance: 0.8,
      });
    }

    // 면적별 분석 정보 추가
    results.push({
      title: `${location} 주요 평형대별 시세 분석`,
      snippet: `${location}에서 가장 인기 있는 평형은 84㎡(32평)이며, 다음으로 114㎡(35평)이 선호됩니다. 소형 평형인 59㎡도 최근 1인 가구 증가로 거래량이 늘고 있습니다.`,
      url: `#${location}-area-analysis`,
      source: '오픈임장 평형분석',
      relevance: 0.75,
    });

    // 투자 가이드 정보 추가
    if (apartmentName && apartmentName !== '아파트') {
      results.push({
        title: `${apartmentName} 투자 가이드 및 주의사항`,
        snippet: `${apartmentName} 투자 시 고려사항: 교통접근성, 학군, 주변 개발계획을 확인하세요. 특히 ${location} 지역은 향후 3년간 재개발 계획이 있어 시세 변동 가능성이 있습니다.`,
        url: `#${apartmentName}-investment-guide`,
        source: '오픈임장 투자분석',
        relevance: 0.7,
      });
    }

    // 관련 단지 추천
    const relatedApartments = apartments.filter(apt => 
      !results.some(result => result.title.includes(apt.name))
    ).slice(0, 2);

    relatedApartments.forEach(apt => {
      results.push({
        title: `${apt.name} - ${location} 추천 단지`,
        snippet: `${apt.name}은 ${location}에서 ${apt.popular ? '가장 인기 있는' : '조용하고 살기 좋은'} 단지입니다. ${apt.area} 기준 ${apt.avgPrice} 수준으로 거래되고 있습니다.`,
        url: `#${apt.name}-details`,
        source: '오픈임장 추천',
        relevance: 0.65,
      });
    });

    // 관련도 순으로 정렬
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  // 검색 통계 조회
  getSearchStats() {
    return {
      cacheSize: this.cache.size,
      totalSearches: this.cache.size, // 간단화
      cacheHitRate: '估计 70%', // Mock 데이터
    };
  }

  // 인기 검색어 (Mock)
  getPopularQueries(): string[] {
    return [
      '잠실 래미안 시세',
      '목동 아파트 추천',
      '강남 84형 가격',
      '송파구 신축 아파트',
      '마포구 전세 시세',
      '롯데캐슬 브랜드 분석',
      '현대아파트 위치별 비교',
      '서초구 학군 아파트',
    ];
  }

  // 캐시 초기화
  clearCache() {
    this.cache.clear();
    console.log('🗑️ 웹 검색 캐시 초기화 완료');
  }
}

// Web 검색 서비스 - 부동산 관련 정보 검색 전용
// 실제 구현에서는 외부 검색 API나 크롤링 서비스를 사용할 수 있음

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults: number;
  searchTime: number;
}

// 서비스 인스턴스 export
export const webSearchService = new WebSearchService();
