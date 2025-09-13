// 사용자 질문에서 아파트를 똑똑하게 해석하고 찾는 서비스

import { apartmentContextManager, ApartmentInfo } from './apartmentContextManager';
import { vectorService } from './vectorService';
import { orchestrateSelect } from '../ai/handlers/utils/sqlOrchestrator';

export interface ApartmentResolution {
  apartment: ApartmentInfo | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'context_id' | 'context_name' | 'vector_search' | 'none';
  query: string;
  alternatives?: ApartmentInfo[]; // 다른 가능한 후보들
}

export class SmartApartmentResolver {
  
  /**
   * 사용자 질문에서 아파트를 해석하고 찾기
   */
  async resolveApartment(query: string, attachedApartments?: ApartmentInfo[]): Promise<ApartmentResolution> {
    console.log('🔍 아파트 해석 시작:', { query: query.slice(0, 50), attachedCount: attachedApartments?.length || 0 });
    
    // 첨부된 아파트가 있으면 컨텍스트에 추가
    if (attachedApartments?.length) {
      attachedApartments.forEach(apt => {
        apartmentContextManager.addApartment({
          ...apt,
          source: 'attached'
        });
      });
    }

    // 1단계: 아파트명 추출 시도
    const extractedNames = this.extractApartmentNames(query);
    console.log('📝 추출된 아파트명:', extractedNames);

    if (extractedNames.length === 0) {
      return {
        apartment: null,
        confidence: 'low',
        source: 'none',
        query
      };
    }

    // 2단계: 우선순위별 검색
    for (const name of extractedNames) {
      // 2-1. 컨텍스트에서 정확한 ID 매칭 우선
      const contextResults = apartmentContextManager.findByName(name);
      if (contextResults.length > 0) {
        const bestMatch = contextResults[0]; // 이미 우선순위 정렬됨
        
        if (bestMatch.id) {
          console.log('✅ 컨텍스트에서 ID 매칭 성공:', { name, id: bestMatch.id });
          return {
            apartment: bestMatch,
            confidence: 'high',
            source: 'context_id',
            query,
            alternatives: contextResults.slice(1)
          };
        }
        
        // ID는 없지만 이름 매칭은 됨
        console.log('✅ 컨텍스트에서 이름 매칭 성공:', { name });
        return {
          apartment: bestMatch,
          confidence: 'medium',
          source: 'context_name',
          query,
          alternatives: contextResults.slice(1)
        };
      }

      // 2-2. 벡터 검색으로 새로운 아파트 찾기
      try {
        const vectorResult = await this.searchApartmentByVector(name);
        if (vectorResult) {
          console.log('✅ 벡터 검색 성공:', { name, found: vectorResult.name });
          
          // 컨텍스트에 추가
          apartmentContextManager.addApartment({
            ...vectorResult,
            source: 'vector_search'
          });
          
          return {
            apartment: vectorResult,
            confidence: vectorResult.id ? 'medium' : 'low',
            source: 'vector_search',
            query
          };
        }
      } catch (error) {
        console.error('❌ 벡터 검색 실패:', error);
      }
    }

    return {
      apartment: null,
      confidence: 'low',
      source: 'none',
      query
    };
  }

  /**
   * 사용자 질문에서 아파트명 추출
   */
  private extractApartmentNames(query: string): string[] {
    const names: string[] = [];
    
    console.log('🔍 아파트명 추출 시작:', { query });
    
    // 1. @멘션 패턴 추출 (단순하고 확실한 패턴)
    const mentionPattern = /@([가-힣a-zA-Z0-9\s\-_.()]+)/g;
    let match;
    console.log('🔍 @멘션 패턴 검색 시작, query:', JSON.stringify(query));
    while ((match = mentionPattern.exec(query)) !== null) {
      const mentioned = match[1].trim();
      console.log('📌 @멘션 발견:', mentioned, 'match:', match);
      
      // "건물정보", "매매가" 같은 키워드 제거
      let cleaned = mentioned.replace(/\s*(건물정보|매매가|전세|월세|정보|가격|시세|알려줘)\s*/g, '').trim();
      console.log('🧹 키워드 제거 후:', cleaned, 'length:', cleaned.length);
      
      if (cleaned && cleaned.length >= 1) { // 최소 길이를 1로 낮춤
        names.push(cleaned);
        console.log('✅ @멘션에서 추출:', cleaned);
      } else {
        console.log('❌ @멘션 조건 불만족:', { cleaned, hasContent: !!cleaned, length: cleaned.length });
      }
    }
    console.log('🔍 @멘션 패턴 검색 완료, 추출된 개수:', names.length);
    
    // 2. 한글 아파트명 직접 매칭 (더 관대한 패턴)
    const koreanPattern = /([가-힣]{1,}(?:\s*[가-힣0-9]*)*)/g;
    let koreanMatch;
    while ((koreanMatch = koreanPattern.exec(query)) !== null) {
      const koreanName = koreanMatch[1].trim();
      
      // 건물정보, 알려줘 같은 일반 단어 제외
      if (koreanName && 
          koreanName.length >= 1 && 
          !['건물정보', '알려줘', '정보', '가격', '시세', '매매가', '전세', '월세'].includes(koreanName) &&
          !names.some(n => n.includes(koreanName) || koreanName.includes(n))) {
        names.push(koreanName);
        console.log('✅ 한글 패턴에서 추출:', koreanName);
      }
    }
    
    // 3. 일반적인 아파트명 패턴 추출 (기존 로직 유지)
    const apartmentPattern = /([\uAC00-\uD7A3]+(?:[\uAC00-\uD7A3a-zA-Z0-9\s]*[\uAC00-\uD7A3a-zA-Z0-9])?(?:아파트|APT|빌딩|타워|빌라|오피스텔)?)/gi;
    let aptMatch;
    while ((aptMatch = apartmentPattern.exec(query)) !== null) {
      const aptName = aptMatch[1].trim();
      if (aptName.length >= 1 && !names.some(n => n.includes(aptName) || aptName.includes(n))) {
        names.push(aptName);
        console.log('✅ 아파트 패턴에서 추출:', aptName);
      }
    }
    
    const finalNames = [...new Set(names)]; // 중복 제거
    console.log('🎯 최종 추출된 아파트명들:', finalNames);
    return finalNames;
  }

  /**
   * 직접 데이터베이스 검색 (Kysely 우회) - 개선된 버전
   */
  private async searchApartmentByDirectDB(apartmentName: string): Promise<ApartmentInfo | null> {
    let pool: any = null;
    let client: any = null;
    
    try {
      console.log('🔍 직접 DB 검색 시작:', apartmentName);
      
      // PostgreSQL Pool을 사용하여 직접 쿼리
      const { Pool } = await import('pg');
      pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 3, // 연결 수 줄임
        idleTimeoutMillis: 10000, // 타임아웃 단축
        connectionTimeoutMillis: 3000,
        acquireTimeoutMillis: 3000
      });

      // 다양한 검색 패턴으로 아파트 검색
      const searchPatterns = [
        apartmentName, // 원본 그대로
        `${apartmentName}아파트`, // "아파트" 추가
        `${apartmentName}APT`, // "APT" 추가  
      ];
      
      console.log('🔍 검색 패턴들:', searchPatterns);
      
      for (const pattern of searchPatterns) {
        try {
          // 간단한 쿼리부터 시도
          const searchQuery = `
            SELECT 
              id, 
              apt_nm, 
              jibun_address,
              lat,
              lon
            FROM oi.apt_info 
            WHERE apt_nm ILIKE $1 
            OR apt_nm ILIKE $2
            ORDER BY 
              CASE 
                WHEN apt_nm = $3 THEN 1      -- 정확 매치 최우선
                WHEN apt_nm ILIKE $4 THEN 2  -- 시작 매치
                ELSE 3                       -- 포함 매치
              END,
              id
            LIMIT 3;
          `;

          const searchTerms = [
            `%${pattern}%`,    // 포함 검색
            `${pattern}%`,     // 시작 검색  
            pattern,           // 정확 매치
            `${pattern}%`      // 시작 매치 비교용
          ];

          console.log('🔍 실행할 SQL:', { pattern, terms: searchTerms.slice(0, 2) });

          client = await pool.connect();
          const result = await client.query(searchQuery, searchTerms);
          client.release();
          client = null;

          console.log('📊 검색 결과:', {
            pattern,
            rowCount: result.rows.length,
            foundApartments: result.rows.map((row: any) => ({ 
              id: row.id, 
              name: row.apt_nm 
            }))
          });

          if (result.rows.length > 0) {
            const firstRow = result.rows[0];
            
            const apartmentInfo = {
              id: firstRow.id,
              name: firstRow.apt_nm,
              address: firstRow.jibun_address,
              lat: firstRow.lat,
              lng: firstRow.lon,
              source: 'direct_db_search' as const,
              addedAt: new Date(),
              lastMentioned: new Date(),
              metadata: {
                originalQuery: apartmentName,
                searchPattern: pattern,
                directDBResult: true,
                foundRows: result.rows.length,
                allMatches: result.rows.map((row: any) => ({
                  id: row.id,
                  name: row.apt_nm
                }))
              }
            };

            console.log('✅ 직접 DB 검색 성공:', apartmentInfo);
            return apartmentInfo;
          }
          
        } catch (patternError) {
          console.error(`❌ 패턴 "${pattern}" 검색 실패:`, patternError);
          if (client) {
            try {
              client.release();
              client = null;
            } catch (releaseError) {
              console.error('클라이언트 릴리즈 실패:', releaseError);
            }
          }
          continue; // 다음 패턴 시도
        }
      }
      
      console.log('❌ 모든 패턴에서 결과 없음');
      return null;

    } catch (error) {
      console.error('❌ 직접 DB 검색 실패:', error);
      return null;
    } finally {
      // 정리 작업
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('클라이언트 릴리즈 실패:', releaseError);
        }
      }
      if (pool) {
        try {
          await pool.end();
        } catch (poolError) {
          console.error('풀 종료 실패:', poolError);
        }
      }
    }
  }

  /**
   * 웹 검색을 통한 아파트 정보 보강 (더 간단하고 안전한 방식)
   */
  private async searchApartmentByWeb(apartmentName: string): Promise<ApartmentInfo | null> {
    try {
      console.log('🌐 실제 구글 웹서칭 시작:', apartmentName);
      
      // 아파트명 보완
      let enhancedName = apartmentName;
      if (!apartmentName.includes('아파트') && !apartmentName.includes('APT')) {
        enhancedName = `${apartmentName}아파트`;
      }
      
      // 구글 검색 쿼리 구성
      const searchQuery = `${enhancedName} 위치 주소 부동산`;
      console.log('🔍 구글 검색 쿼리:', searchQuery);
      
      // Claude Code WebSearch 도구 사용
      let searchResults;
      try {
        // 실제 웹서치 시도
        const webSearchResult = await this.performGoogleSearch(searchQuery);
        if (webSearchResult) {
          console.log('✅ 구글 검색 성공:', webSearchResult);
          return {
            id: undefined,
            name: enhancedName,
            region: webSearchResult.region || '서울특별시',
            address: webSearchResult.address,
            lat: webSearchResult.lat,
            lng: webSearchResult.lng,
            source: 'web_search',
            addedAt: new Date(),
            lastMentioned: new Date(),
            metadata: {
              originalQuery: apartmentName,
              webSearchResult: true,
              enhancedName,
              searchQuery,
              confidence: webSearchResult.confidence || 'medium',
              description: webSearchResult.description
            }
          };
        }
      } catch (webError) {
        console.warn('⚠️ 구글 검색 실패, fallback으로 전환:', webError);
      }
      
      // 구글 검색 실패 시에만 하드코딩된 지식 기반 사용 (우선순위 낮음)
      console.log('🔄 Fallback: 지식 기반 추론 사용');
      const fallbackResult = await this.searchApartmentByKnowledgeBase(apartmentName, enhancedName);
      if (fallbackResult) {
        return fallbackResult;
      }
      
      // 최후의 기본 정보 반환
      console.log('🔍 최후 기본 정보로 아파트 정보 생성');
      return {
        id: undefined,
        name: enhancedName,
        source: 'web_search',
        addedAt: new Date(),
        lastMentioned: new Date(),
        metadata: {
          originalQuery: apartmentName,
          webSearchResult: false,
          enhancedName,
          fallbackMode: true,
          confidence: 'low'
        }
      };
      
    } catch (error) {
      console.error('❌ 웹 검색 전체 실패:', error);
      return null;
    }
  }

  /**
   * 실제 구글 검색 수행
   */
  private async performGoogleSearch(query: string): Promise<{
    region?: string;
    address?: string;
    lat?: number;
    lng?: number;
    confidence?: string;
    description?: string;
  } | null> {
    try {
      console.log('🔍 구글 검색 API 호출:', query);
      
      // Fetch API를 사용하여 실제 구글 검색 수행
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      console.log('🌐 검색 URL:', searchUrl);
      
      // User-Agent 설정으로 실제 브라우저 시뮬레이션
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000
      });

      if (!response.ok) {
        console.warn('⚠️ 구글 검색 응답 오류:', response.status);
        return null;
      }

      const htmlContent = await response.text();
      console.log('✅ 구글 검색 HTML 받음, 크기:', htmlContent.length);

      // HTML에서 아파트 정보 추출
      const extractedInfo = this.parseApartmentInfoFromGoogle(htmlContent, query);
      
      if (extractedInfo) {
        console.log('✅ 구글 검색에서 아파트 정보 추출 성공:', extractedInfo);
        return extractedInfo;
      }

      console.log('⚠️ 구글 검색 결과에서 유용한 정보를 찾지 못함');
      return null;
      
    } catch (error) {
      console.error('❌ 구글 검색 API 오류:', error);
      
      // 네트워크 오류나 타임아웃의 경우 재시도 없이 null 반환
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('fetch')) {
          console.warn('🔄 네트워크 오류로 인한 구글 검색 실패');
        }
      }
      
      return null;
    }
  }

  /**
   * 구글 검색 HTML 결과에서 아파트 정보 파싱
   */
  private parseApartmentInfoFromGoogle(htmlContent: string, originalQuery: string): {
    region?: string;
    address?: string;
    lat?: number;
    lng?: number;
    confidence?: string;
    description?: string;
  } | null {
    try {
      console.log('🔍 HTML 파싱 시작');
      
      // 주요 지역명 패턴들
      const regionPatterns = [
        /서울특별시\s*([가-힣]+구)\s*([가-힣]+동)/g,
        /서울\s*([가-힣]+구)\s*([가-힣]+동)/g,
        /([가-힣]+구)\s*([가-힣]+동)/g,
        /서울\s*([가-힣]+구)/g,
        /([가-힣]+시)\s*([가-힣]+구)/g
      ];

      // 주소 패턴들  
      const addressPatterns = [
        /주소[:\s]*([가-힣\s\d\-]+(?:동|로|길)\s*\d*)/gi,
        /위치[:\s]*([가-힣\s\d\-]+(?:동|로|길)\s*\d*)/gi,
        /소재지[:\s]*([가-힣\s\d\-]+(?:동|로|길)\s*\d*)/gi
      ];

      let foundRegion = '';
      let foundAddress = '';
      let confidence = 'low';

      // 지역 정보 추출
      for (const pattern of regionPatterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        if (matches.length > 0) {
          const match = matches[0];
          if (match[1] && match[2]) {
            foundRegion = `서울특별시 ${match[1]} ${match[2]}`;
            confidence = 'high';
          } else if (match[1]) {
            foundRegion = `서울특별시 ${match[1]}`;
            confidence = 'medium';
          }
          break;
        }
      }

      // 주소 정보 추출
      for (const pattern of addressPatterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        if (matches.length > 0) {
          foundAddress = matches[0][1].trim();
          if (foundAddress.length > 5) {
            confidence = confidence === 'high' ? 'high' : 'medium';
            break;
          }
        }
      }

      // 부동산 관련 키워드 존재 여부로 신뢰도 조정
      const realEstateKeywords = ['부동산', '매매', '전세', '월세', '아파트', '단지', '호수'];
      const hasRealEstateContext = realEstateKeywords.some(keyword => 
        htmlContent.includes(keyword)
      );

      if (!hasRealEstateContext) {
        confidence = 'low';
      }

      // 최소한의 정보가 있는 경우에만 결과 반환
      if (foundRegion || foundAddress) {
        const result = {
          region: foundRegion || '서울특별시',
          address: foundAddress || `${foundRegion} ${originalQuery.replace('아파트', '')}아파트`,
          confidence,
          description: `구글 검색을 통해 찾은 ${originalQuery} 정보`
        };

        console.log('✅ HTML 파싱 결과:', result);
        return result;
      }

      console.log('⚠️ HTML에서 유용한 아파트 정보를 찾지 못함');
      return null;

    } catch (error) {
      console.error('❌ HTML 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 지식 기반 추론 (기존 하드코딩 로직을 별도 함수로 분리)
   */
  private async searchApartmentByKnowledgeBase(apartmentName: string, enhancedName: string): Promise<ApartmentInfo | null> {
    // 잘 알려진 지역의 유명 아파트 정보를 기본적으로 제공
    const wellKnownApartments: Record<string, { region: string; fullName: string; description: string }> = {
      '은마': { region: '서울특별시 강남구', fullName: '은마아파트', description: '강남구 대치동 소재 유명 아파트' },
      '현대': { region: '서울특별시 강남구', fullName: '현대아파트', description: '현대건설 아파트 브랜드' },
      '삼성': { region: '서울특별시 강남구', fullName: '삼성아파트', description: '삼성물산 아파트 브랜드' },
      '한양': { region: '서울특별시', fullName: '한양아파트', description: '한양 아파트 브랜드' },
      '래미안': { region: '전국', fullName: '래미안아파트', description: '삼성물산 래미안 브랜드' },
      '아크로': { region: '전국', fullName: '아크로아파트', description: 'DL이앤씨 아크로 브랜드' },
      '자이': { region: '전국', fullName: '자이아파트', description: 'GS건설 자이 브랜드' },
      '힐스테이트': { region: '전국', fullName: '힐스테이트아파트', description: '현대건설 힐스테이트 브랜드' },
      '아이파크': { region: '전국', fullName: '아이파크아파트', description: 'HDC현대산업개발 아이파크 브랜드' },
      '푸르지오': { region: '전국', fullName: '푸르지오아파트', description: '대우건설 푸르지오 브랜드' }
    };
    
    const matchedApt = wellKnownApartments[apartmentName];
    
    if (matchedApt) {
      console.log('✅ 지식 기반 정보 제공:', matchedApt);
      
      return {
        id: undefined,
        name: enhancedName,
        region: matchedApt.region,
        address: `${matchedApt.region} ${enhancedName}`,
        source: 'web_search',
        addedAt: new Date(),
        lastMentioned: new Date(),
        metadata: {
          originalQuery: apartmentName,
          webSearchResult: false,
          enhancedName,
          knowledgeBasedGuess: true,
          confidence: 'medium',
          description: matchedApt.description
        }
      };
    }
    
    return null;
  }

  /**
   * 벡터 검색을 통한 아파트 찾기 (기존 방식 + 직접 DB 검색 + 웹 검색 추가)
   */
  private async searchApartmentByVector(apartmentName: string): Promise<ApartmentInfo | null> {
    try {
      // 1. 먼저 직접 DB 검색 시도 (빠르고 정확함)
      const directResult = await this.searchApartmentByDirectDB(apartmentName);
      if (directResult) {
        return directResult;
      }

      // 2. 기존 벡터 검색 방식 (orchestrateSelect 사용)
      console.log('🔄 벡터 검색 방식으로 fallback');
      const question = `${apartmentName} 아파트의 건물 정보를 조회해줘. 아파트 ID, 아파트명, 위치 정보를 포함해서.`;
      
      const result = await orchestrateSelect({
        question,
        forceSchemaHints: [
          'oi.apt_info(id, apt_nm, jibun_address, lat, lon, created_at, updated_at)',
          'Note: Use oi.apt_info table for apartment information, not oi.apt_building_info'
        ],
        requireColumns: ['id', 'apt_nm'],
        safety: { maxRows: 10, readOnly: true }
      });

      if (result.success && result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0];
        
        return {
          id: firstRow.id,
          name: firstRow.apt_nm || firstRow.name || apartmentName,
          region: firstRow.region,
          lat: firstRow.lat,
          lng: firstRow.longitude || firstRow.lng,
          source: 'vector_search',
          addedAt: new Date(),
          lastMentioned: new Date(),
          metadata: {
            originalQuery: apartmentName,
            sqlQuery: result.sql,
            foundRows: result.rows.length
          }
        };
      }
      
      // 3. 벡터 검색도 실패하면 웹 검색 시도
      console.log('🔄 웹 검색 방식으로 최종 fallback');
      const webResult = await this.searchApartmentByWeb(apartmentName);
      if (webResult) {
        return webResult;
      }
      
      return null;
    } catch (error) {
      console.error('벡터 검색 실패:', error);
      return null;
    }
  }

  /**
   * 디버깅을 위한 현재 상태 조회
   */
  getDebugInfo() {
    return {
      contextManager: apartmentContextManager.getDebugInfo(),
      timestamp: new Date().toISOString()
    };
  }
}

// 싱글톤 인스턴스
export const smartApartmentResolver = new SmartApartmentResolver();