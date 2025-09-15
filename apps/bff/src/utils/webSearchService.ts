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
      // 실제 웹 검색 대신 Mock 데이터 반환
      // 프로덕션에서는 Google Search API, Bing API 등 사용
      const mockResult = await this.generateMockSearchResult(query);
      
      // 캐시에 저장
      this.cache.set(cacheKey, {
        data: mockResult,
        timestamp: Date.now(),
      });

      console.log(`✅ 웹 검색 완료: ${mockResult.resultCount}개 결과`);
      return mockResult;

    } catch (error) {
      console.error('❌ 웹 검색 오류:', error);
      
      // 오류 시 기본 결과 반환
      return {
        query,
        results: [],
        searchTime: Date.now() - startTime,
        resultCount: 0,
      };
    }
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

/**
 * 웹 검색 서비스 클래스
 * 부동산 관련 질의에 특화된 검색 결과 제공
 */
export class WebSearchService {
  
  /**
   * 부동산 관련 질의를 웹 검색으로 처리
   */
  async searchRealEstate(query: string): Promise<WebSearchResponse> {
    console.log(`🌐 웹 검색 시작: "${query}"`);
    const startTime = Date.now();
    
    try {
      // 부동산 특화 검색 쿼리 생성
      const enhancedQuery = this.enhanceRealEstateQuery(query);
      console.log(`🔍 강화된 검색 쿼리: "${enhancedQuery}"`);
      
      // 실제 웹 검색 수행 (모의 구현)
      const searchResults = await this.performWebSearch(enhancedQuery);
      
      const searchTime = Date.now() - startTime;
      console.log(`✅ 웹 검색 완료: ${searchResults.length}건, ${searchTime}ms`);
      
      return {
        query: enhancedQuery,
        results: searchResults,
        totalResults: searchResults.length,
        searchTime
      };
      
    } catch (error) {
      console.error('❌ 웹 검색 실패:', error);
      return {
        query,
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * 부동산 검색 쿼리 강화
   */
  private enhanceRealEstateQuery(query: string): string {
    // 부동산 관련 키워드 추가
    const realEstateKeywords = ['아파트', '매매', '전세', '월세', '시세', '실거래가'];
    const hasRealEstateKeyword = realEstateKeywords.some(keyword => query.includes(keyword));
    
    if (!hasRealEstateKeyword) {
      return `${query} 아파트 부동산`;
    }
    
    return query;
  }
  
  /**
   * 실제 웹 검색 수행 (현재는 모의 구현)
   * 실제 환경에서는 검색 API나 크롤링 서비스로 대체
   */
  private async performWebSearch(query: string): Promise<WebSearchResult[]> {
    // 부동산 관련 검색 결과 모의 생성
    const mockResults: WebSearchResult[] = [];
    
    // 검색 쿼리에 따른 관련 결과 생성
    if (query.includes('목동')) {
      mockResults.push({
        title: '목동 아파트 시세 정보 - 2024년 최신',
        snippet: '목동 지역 주요 아파트 단지의 최신 시세 정보를 확인하세요. 목동신시가지, 목동구시가지 등 지역별 매매가, 전세가 정보 제공.',
        url: '#mokdong-prices',
        source: '부동산 시세 정보'
      });
      
      mockResults.push({
        title: '목동 래미안 아파트 90형 매매가 현황',
        snippet: '목동 래미안 아파트 90㎡(34평) 타입의 최근 매매 거래 현황입니다. 평균 매매가 11억 원대, 최고가 13억 원 수준으로 형성.',
        url: '#mokdong-raemian-90',
        source: '실거래가 분석'
      });
      
      mockResults.push({
        title: '목동 지역 추천 아파트 베스트 5',
        snippet: '목동에서 가장 인기 있는 아파트 단지들을 소개합니다. 래미안 목동, 현대 목동, 아크로리버파크 등 프리미엄 브랜드 아파트 정보.',
        url: '#mokdong-best-apartments',
        source: '아파트 분석 리포트'
      });
    }
    
    if (query.includes('90형') || query.includes('90㎡')) {
      mockResults.push({
        title: '90㎡ 아파트 구매 가이드 - 적정 시세와 선택 기준',
        snippet: '90㎡(34평) 아파트는 신혼부부나 3-4인 가족에게 적합한 크기입니다. 지역별 시세 차이와 구매 시 고려사항을 알아보세요.',
        url: '#90sqm-apartment-guide',
        source: '아파트 구매 가이드'
      });
    }
    
    if (query.includes('매매가') || query.includes('매매')) {
      mockResults.push({
        title: '2024년 서울 아파트 매매시장 전망',
        snippet: '2024년 서울 아파트 매매시장은 안정세를 보이고 있습니다. 주요 지역별 시세 동향과 향후 전망을 분석했습니다.',
        url: '#seoul-market-2024',
        source: '시장 분석 리포트'
      });
    }
    
    // 기본 부동산 정보가 없으면 일반적인 부동산 정보 제공
    if (mockResults.length === 0) {
      mockResults.push({
        title: '부동산 정보 종합 분석',
        snippet: '전국 아파트 매매, 전세, 월세 정보를 한눈에 확인하세요. 실시간 시세 정보와 거래 동향을 제공합니다.',
        url: '#real-estate-analysis',
        source: '부동산 분석 센터'
      });
    }
    
    // 검색 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    return mockResults;
  }
  
  /**
   * 검색 결과를 텍스트로 변환 (LLM 분석용)
   */
  static formatSearchResultsForLLM(searchResponse: WebSearchResponse): string {
    if (searchResponse.results.length === 0) {
      return `웹 검색 결과: "${searchResponse.query}" 에 대한 검색 결과가 없습니다.`;
    }
    
    let formatted = `웹 검색 결과 (${searchResponse.totalResults}건, ${searchResponse.searchTime}ms):\n\n`;
    
    searchResponse.results.forEach((result, index) => {
      formatted += `${index + 1}. **${result.title}**\n`;
      formatted += `   출처: ${result.source}\n`;
      formatted += `   내용: ${result.snippet}\n\n`;
    });
    
    return formatted;
  }
}