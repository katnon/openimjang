// 지번주소 추출 및 DB 연동 서비스
import { db } from '../lib/db';

export interface JibunAddressInfo {
  apartmentId: number;
  apartmentName: string;
  jibunAddress: string;
  lat: number;
  lon: number;
}

export interface JibunExtractionResult {
  success: boolean;
  jibunAddress?: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'db_direct' | 'parsed_search' | 'inferred';
  apartmentInfo?: JibunAddressInfo;
}

/**
 * 지번주소 추출 및 DB 연동 서비스
 */
export class JibunAddressExtractor {

  /**
   * 아파트명으로 DB에서 지번주소 직접 조회
   */
  async getJibunAddressFromDB(apartmentName: string): Promise<JibunExtractionResult> {
    try {
      console.log('🏢 DB에서 아파트 정보 조회:', apartmentName);

      // 정확히 일치하는 아파트명 우선 조회
      const exactMatch = await db
        .selectFrom('oi.apt_info')
        .select(['id', 'apt_nm', 'jibun_address', 'lat', 'lon'])
        .where('apt_nm', '=', apartmentName)
        .where('jibun_address', 'is not', null)
        .executeTakeFirst();

      if (exactMatch && exactMatch.jibun_address) {
        console.log('✅ DB 정확 일치 발견:', exactMatch.apt_nm);
        return {
          success: true,
          jibunAddress: exactMatch.jibun_address,
          confidence: 'high',
          source: 'db_direct',
          apartmentInfo: {
            apartmentId: exactMatch.id,
            apartmentName: exactMatch.apt_nm,
            jibunAddress: exactMatch.jibun_address,
            lat: exactMatch.lat || 0,
            lon: exactMatch.lon || 0
          }
        };
      }

      // 부분 일치로 재시도 (LIKE 검색)
      const partialMatches = await db
        .selectFrom('oi.apt_info')
        .select(['id', 'apt_nm', 'jibun_address', 'lat', 'lon'])
        .where('apt_nm', 'ilike', `%${apartmentName}%`)
        .where('jibun_address', 'is not', null)
        .limit(5)
        .execute();

      if (partialMatches.length > 0) {
        console.log(`✅ DB 부분 일치 ${partialMatches.length}개 발견`);
        
        // 가장 유사한 것 선택 (짧은 것부터)
        const bestMatch = partialMatches.sort((a, b) => a.apt_nm.length - b.apt_nm.length)[0];
        
        return {
          success: true,
          jibunAddress: bestMatch.jibun_address!,
          confidence: 'medium',
          source: 'db_direct',
          apartmentInfo: {
            apartmentId: bestMatch.id,
            apartmentName: bestMatch.apt_nm,
            jibunAddress: bestMatch.jibun_address!,
            lat: bestMatch.lat || 0,
            lon: bestMatch.lon || 0
          }
        };
      }

      console.log('⚠️ DB에서 아파트 정보를 찾지 못함');
      return {
        success: false,
        confidence: 'low',
        source: 'db_direct'
      };

    } catch (error: any) {
      console.error('❌ DB 조회 실패:', error);
      return {
        success: false,
        confidence: 'low',
        source: 'db_direct'
      };
    }
  }

  /**
   * 웹 검색 결과에서 지번주소 추출
   */
  extractJibunFromSearchResult(htmlContent: string, apartmentName: string): JibunExtractionResult {
    try {
      console.log('🔍 웹 검색 결과에서 지번주소 추출 시작');

      // 일반적인 지번주소 패턴들
      const jibunPatterns = [
        // "서울특별시 강남구 대치동 123-45" 형태
        /서울특별시\s*([가-힣]+구)\s*([가-힣]+동)\s*(\d+(?:-\d+)?)/g,
        // "강남구 대치동 123-45" 형태
        /([가-힣]+구)\s*([가-힣]+동)\s*(\d+(?:-\d+)?)/g,
        // "대치동 123-45" 형태
        /([가-힣]+동)\s*(\d+(?:-\d+)?)/g,
        // "123-45번지" 형태 (동네명 없이)
        /(\d+(?:-\d+)?)\s*번지/g
      ];

      const extractedAddresses: Array<{address: string; confidence: 'high' | 'medium' | 'low'}> = [];

      // 각 패턴으로 추출 시도
      for (const pattern of jibunPatterns) {
        const matches = [...htmlContent.matchAll(pattern)];
        
        for (const match of matches) {
          let address = '';
          let confidence: 'high' | 'medium' | 'low' = 'low';

          if (match[0].includes('서울특별시') && match[1] && match[2] && match[3]) {
            // 가장 완전한 형태
            address = `서울특별시 ${match[1]} ${match[2]} ${match[3]}`;
            confidence = 'high';
          } else if (match[1] && match[2] && match[3] && match[1].includes('구')) {
            // 구와 동이 있는 형태
            address = `서울특별시 ${match[1]} ${match[2]} ${match[3]}`;
            confidence = 'medium';
          } else if (match[1] && match[2]) {
            // 동과 번지만 있는 형태
            address = `서울특별시 [구명미상] ${match[1]} ${match[2]}`;
            confidence = 'low';
          }

          if (address && !extractedAddresses.find(e => e.address === address)) {
            extractedAddresses.push({ address, confidence });
          }
        }
      }

      // 추출된 주소 정렬 (신뢰도 높은 순)
      extractedAddresses.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      });

      console.log(`📍 추출된 지번주소: ${extractedAddresses.length}개`, 
        extractedAddresses.map(e => `${e.address} (${e.confidence})`));

      if (extractedAddresses.length > 0) {
        const bestAddress = extractedAddresses[0];
        return {
          success: true,
          jibunAddress: bestAddress.address,
          confidence: bestAddress.confidence,
          source: 'parsed_search'
        };
      }

      console.log('⚠️ 웹 검색 결과에서 지번주소를 찾지 못함');
      return {
        success: false,
        confidence: 'low',
        source: 'parsed_search'
      };

    } catch (error: any) {
      console.error('❌ 지번주소 추출 실패:', error);
      return {
        success: false,
        confidence: 'low',
        source: 'parsed_search'
      };
    }
  }

  /**
   * 지역 정보를 바탕으로 지번주소 추론
   */
  inferJibunFromRegion(apartmentName: string, region: string): JibunExtractionResult {
    try {
      console.log('🤔 지역 정보로 지번주소 추론:', { apartmentName, region });

      // 서울 구/동 패턴 매칭
      const regionMatch = region.match(/서울특별시\s*([가-힣]+구)(?:\s*([가-힣]+동))?/);
      
      if (regionMatch) {
        const gu = regionMatch[1];
        const dong = regionMatch[2] || '[동명미상]';
        
        // 기본적인 지번주소 형태 생성 (실제 번지는 [번지미상]으로 표시)
        const inferredAddress = `서울특별시 ${gu} ${dong} [번지미상]`;
        
        console.log('✅ 지역 기반 지번주소 추론:', inferredAddress);
        
        return {
          success: true,
          jibunAddress: inferredAddress,
          confidence: 'low',
          source: 'inferred'
        };
      }

      console.log('⚠️ 지역 정보가 부족하여 지번주소를 추론할 수 없음');
      return {
        success: false,
        confidence: 'low',
        source: 'inferred'
      };

    } catch (error: any) {
      console.error('❌ 지번주소 추론 실패:', error);
      return {
        success: false,
        confidence: 'low',
        source: 'inferred'
      };
    }
  }

  /**
   * 통합 지번주소 추출 (DB → 웹 파싱 → 추론 순서)
   */
  async extractJibunAddress(
    apartmentName: string, 
    searchHtmlContent?: string, 
    region?: string
  ): Promise<JibunExtractionResult> {
    console.log('🎯 통합 지번주소 추출 시작:', apartmentName);

    // 1단계: DB에서 직접 조회 (가장 정확)
    const dbResult = await this.getJibunAddressFromDB(apartmentName);
    if (dbResult.success && dbResult.confidence === 'high') {
      console.log('✅ DB 직접 조회 성공 (high confidence)');
      return dbResult;
    }

    // 2단계: 웹 검색 결과 파싱
    if (searchHtmlContent) {
      const webResult = this.extractJibunFromSearchResult(searchHtmlContent, apartmentName);
      if (webResult.success && webResult.confidence !== 'low') {
        console.log('✅ 웹 파싱 성공 (medium+ confidence)');
        return webResult;
      }
    }

    // 3단계: DB에서 부분 일치 결과 사용 (있다면)
    if (dbResult.success && dbResult.confidence === 'medium') {
      console.log('✅ DB 부분 일치 사용 (medium confidence)');
      return dbResult;
    }

    // 4단계: 지역 정보로 추론
    if (region) {
      const inferredResult = this.inferJibunFromRegion(apartmentName, region);
      if (inferredResult.success) {
        console.log('✅ 지역 기반 추론 성공');
        return inferredResult;
      }
    }

    // 5단계: 웹 파싱의 낮은 신뢰도 결과라도 사용
    if (searchHtmlContent) {
      const webResult = this.extractJibunFromSearchResult(searchHtmlContent, apartmentName);
      if (webResult.success) {
        console.log('✅ 웹 파싱 낮은 신뢰도 결과 사용');
        return webResult;
      }
    }

    console.log('❌ 모든 방법으로 지번주소 추출 실패');
    return {
      success: false,
      confidence: 'low',
      source: 'db_direct'
    };
  }

  /**
   * 지번주소를 DB에 저장/업데이트
   */
  async saveJibunAddressToDB(
    apartmentName: string,
    jibunAddress: string,
    lat?: number,
    lon?: number
  ): Promise<boolean> {
    try {
      console.log('💾 지번주소 DB 저장:', { apartmentName, jibunAddress });

      // 기존 레코드 확인
      const existing = await db
        .selectFrom('oi.apt_info')
        .select(['id', 'jibun_address'])
        .where('apt_nm', '=', apartmentName)
        .executeTakeFirst();

      if (existing) {
        // 업데이트
        const updateData: any = {
          jibun_address: jibunAddress,
          updated_at: new Date()
        };

        if (lat) updateData.lat = lat;
        if (lon) updateData.lon = lon;

        await db
          .updateTable('oi.apt_info')
          .set(updateData)
          .where('id', '=', existing.id)
          .execute();

        console.log('✅ 기존 레코드 업데이트 완료');
      } else {
        // 새 레코드 생성
        const insertData: any = {
          apt_nm: apartmentName,
          jibun_address: jibunAddress,
          created_at: new Date(),
          updated_at: new Date()
        };

        if (lat) insertData.lat = lat;
        if (lon) insertData.lon = lon;

        await db
          .insertInto('oi.apt_info')
          .values(insertData)
          .execute();

        console.log('✅ 새 레코드 생성 완료');
      }

      return true;

    } catch (error: any) {
      console.error('❌ DB 저장 실패:', error);
      return false;
    }
  }

  /**
   * 아파트명으로 종합 정보 조회 (지번주소 포함)
   */
  async getApartmentWithJibunInfo(apartmentName: string): Promise<JibunAddressInfo | null> {
    try {
      const result = await db
        .selectFrom('oi.apt_info')
        .select(['id', 'apt_nm', 'jibun_address', 'lat', 'lon'])
        .where('apt_nm', 'ilike', `%${apartmentName}%`)
        .where('jibun_address', 'is not', null)
        .orderBy('apt_nm')
        .executeTakeFirst();

      if (result) {
        return {
          apartmentId: result.id,
          apartmentName: result.apt_nm,
          jibunAddress: result.jibun_address!,
          lat: result.lat || 0,
          lon: result.lon || 0
        };
      }

      return null;

    } catch (error: any) {
      console.error('❌ 아파트 정보 조회 실패:', error);
      return null;
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
export const jibunAddressExtractor = new JibunAddressExtractor();