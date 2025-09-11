// apps/bff/src/ai/processors/responseProcessor.ts
// AI 응답 후처리 파이프라인 - 스마트 링크 생성 시스템

import { db } from '../../lib/db';

/**
 * 링크 가능한 엔티티 유형
 */
export type LinkableEntityType = 
  | 'apartment'      // 아파트/단지
  | 'subway'         // 지하철역
  | 'bus_stop'       // 버스정류장
  | 'school'         // 학교
  | 'hospital'       // 병원
  | 'mart'           // 마트/쇼핑센터
  | 'park'           // 공원
  | 'government'     // 관공서
  | 'bank'           // 은행
  | 'restaurant';    // 음식점

/**
 * 감지된 엔티티 정보
 */
export interface DetectedEntity {
  /** 원본 텍스트 */
  text: string;
  /** 엔티티 유형 */
  type: LinkableEntityType;
  /** 매치된 데이터베이스 정보 */
  data: {
    id: string | number;
    name: string;
    address?: string;
    lat?: number;
    lon?: number;
    [key: string]: any;
  };
  /** 텍스트 내 시작 위치 */
  startIndex: number;
  /** 텍스트 내 끝 위치 */
  endIndex: number;
}

/**
 * 링크 처리된 응답 결과
 */
export interface ProcessedResponse {
  /** 링크가 삽입된 HTML 텍스트 */
  htmlContent: string;
  /** 감지된 엔티티 목록 */
  detectedEntities: DetectedEntity[];
  /** 처리 메타데이터 */
  metadata: {
    originalLength: number;
    processedLength: number;
    entitiesCount: number;
    processingTime: number;
  };
}

/**
 * 응답 후처리기 클래스
 */
export class ResponseProcessor {
  private apartmentCache: Map<string, any> = new Map();
  private poiCache: Map<string, any> = new Map();

  /**
   * AI 응답을 처리하여 스마트 링크를 생성합니다
   */
  async processResponse(originalText: string): Promise<ProcessedResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 응답 후처리 시작:', originalText.substring(0, 100) + '...');

      // 1. 엔티티 감지
      const entities = await this.detectEntities(originalText);
      
      // 2. 중복 제거 및 우선순위 정렬
      const uniqueEntities = this.deduplicateEntities(entities);
      
      // 3. HTML 링크 생성
      const htmlContent = this.generateLinkedHtml(originalText, uniqueEntities);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ 응답 후처리 완료: ${uniqueEntities.length}개 엔티티 감지, ${processingTime}ms`);

      return {
        htmlContent,
        detectedEntities: uniqueEntities,
        metadata: {
          originalLength: originalText.length,
          processedLength: htmlContent.length,
          entitiesCount: uniqueEntities.length,
          processingTime
        }
      };

    } catch (error: any) {
      console.error('❌ 응답 후처리 오류:', error);
      
      // 오류 시 원본 텍스트 반환
      return {
        htmlContent: originalText,
        detectedEntities: [],
        metadata: {
          originalLength: originalText.length,
          processedLength: originalText.length,
          entitiesCount: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 텍스트에서 링크 가능한 엔티티들을 감지합니다
   */
  private async detectEntities(text: string): Promise<DetectedEntity[]> {
    const entities: DetectedEntity[] = [];

    // 1. 아파트/단지명 감지
    const apartmentEntities = await this.detectApartments(text);
    entities.push(...apartmentEntities);

    // 2. 지하철역 감지
    const subwayEntities = await this.detectSubwayStations(text);
    entities.push(...subwayEntities);

    // 3. 주요 시설 감지 (병원, 학교, 마트 등)
    const poiEntities = await this.detectPOIs(text);
    entities.push(...poiEntities);

    return entities;
  }

  /**
   * 아파트명 감지
   */
  private async detectApartments(text: string): Promise<DetectedEntity[]> {
    const entities: DetectedEntity[] = [];
    
    try {
      // 아파트명 패턴 (한글 + 숫자 + 아파트/단지)
      const apartmentPattern = /([가-힣\w\s]+(?:아파트|단지|빌라|타운|하우스|팰리스|캐슬|힐스|파크|시티|엠밸리)(?:\d+단지)?)/g;
      
      let match;
      while ((match = apartmentPattern.exec(text)) !== null) {
        const aptName = match[1].trim();
        
        // 캐시 확인
        let aptData = this.apartmentCache.get(aptName);
        
        if (!aptData) {
          // DB에서 아파트 정보 검색
          const searchResults = await db
            .selectFrom('oi.apt_info')
            .select(['id', 'apt_nm', 'jibun_address', 'lat', 'lon'])
            .where('apt_nm', 'ilike', `%${aptName}%`)
            .limit(1)
            .execute();

          if (searchResults.length > 0) {
            aptData = searchResults[0];
            this.apartmentCache.set(aptName, aptData);
          }
        }

        if (aptData) {
          entities.push({
            text: match[1],
            type: 'apartment',
            data: {
              id: aptData.id,
              name: aptData.apt_nm,
              address: aptData.jibun_address,
              lat: aptData.lat,
              lon: aptData.lon
            },
            startIndex: match.index!,
            endIndex: match.index! + match[1].length
          });
        }
      }

    } catch (error: any) {
      console.error('❌ 아파트명 감지 오류:', error);
    }

    return entities;
  }

  /**
   * 지하철역 감지
   */
  private async detectSubwayStations(text: string): Promise<DetectedEntity[]> {
    const entities: DetectedEntity[] = [];
    
    try {
      // 지하철역 패턴 (역명 + 역)
      const stationPattern = /([가-힣\w]+역)/g;
      
      let match;
      while ((match = stationPattern.exec(text)) !== null) {
        const stationName = match[1];
        
        // 일반적인 지하철역인지 확인 (간단한 화이트리스트)
        const commonStations = [
          '서울역', '강남역', '신림역', '홍대입구역', '신촌역', '이대역',
          '명동역', '동대문역', '종로3가역', '을지로입구역', '시청역',
          '광화문역', '종각역', '신도림역', '구로역', '가산디지털단지역',
          '금천구청역', '안양역', '수원역', '인천역', '부평역',
          '잠실역', '선릉역', '역삼역', '교대역', '서초역', '방배역',
          '사당역', '낙성대역', '서울대입구역', '봉천역', '신대방역',
          '여의도역', '당산역', '합정역', '상수역', '마포역', '공덕역',
          '애오개역', '충정로역', '서대문역', '광화문역', '동대문역사문화공원역'
        ];

        if (commonStations.includes(stationName)) {
          entities.push({
            text: match[1],
            type: 'subway',
            data: {
              id: stationName,
              name: stationName,
              // 실제 좌표는 카카오 API로 검색 필요
            },
            startIndex: match.index!,
            endIndex: match.index! + match[1].length
          });
        }
      }

    } catch (error: any) {
      console.error('❌ 지하철역 감지 오류:', error);
    }

    return entities;
  }

  /**
   * POI (관심지점) 감지
   */
  private async detectPOIs(text: string): Promise<DetectedEntity[]> {
    const entities: DetectedEntity[] = [];
    
    try {
      // 주요 시설 패턴들
      const patterns = [
        { pattern: /([가-힣\w\s]+(?:병원|의료원|클리닉))/g, type: 'hospital' as LinkableEntityType },
        { pattern: /([가-힣\w\s]+(?:초등학교|중학교|고등학교|대학교))/g, type: 'school' as LinkableEntityType },
        { pattern: /([가-힣\w\s]+(?:마트|백화점|쇼핑센터|몰|플라자))/g, type: 'mart' as LinkableEntityType },
        { pattern: /([가-힣\w\s]+(?:공원|산|숲|정원))/g, type: 'park' as LinkableEntityType },
        { pattern: /([가-힣\w\s]+(?:구청|시청|주민센터|동사무소))/g, type: 'government' as LinkableEntityType },
      ];

      for (const { pattern, type } of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const facilityName = match[1].trim();
          
          // 너무 짧거나 일반적인 단어는 제외
          if (facilityName.length > 2 && !this.isCommonWord(facilityName)) {
            entities.push({
              text: match[1],
              type,
              data: {
                id: facilityName,
                name: facilityName,
                // 실제 좌표는 카카오 API로 검색 필요
              },
              startIndex: match.index!,
              endIndex: match.index! + match[1].length
            });
          }
        }
      }

    } catch (error: any) {
      console.error('❌ POI 감지 오류:', error);
    }

    return entities;
  }

  /**
   * 중복 엔티티 제거 및 우선순위 정렬
   */
  private deduplicateEntities(entities: DetectedEntity[]): DetectedEntity[] {
    // 위치 기반으로 중복 제거 (겹치는 텍스트 영역)
    const sortedEntities = entities.sort((a, b) => a.startIndex - b.startIndex);
    const uniqueEntities: DetectedEntity[] = [];

    for (const entity of sortedEntities) {
      const hasOverlap = uniqueEntities.some(existing => 
        (entity.startIndex < existing.endIndex && entity.endIndex > existing.startIndex)
      );

      if (!hasOverlap) {
        uniqueEntities.push(entity);
      }
    }

    return uniqueEntities;
  }

  /**
   * HTML 링크 생성
   */
  private generateLinkedHtml(originalText: string, entities: DetectedEntity[]): string {
    if (entities.length === 0) {
      return originalText;
    }

    // 뒤에서부터 처리하여 인덱스 변화 방지
    const sortedEntities = entities.sort((a, b) => b.startIndex - a.startIndex);
    let result = originalText;

    for (const entity of sortedEntities) {
      const linkHtml = this.createLinkHtml(entity);
      result = result.slice(0, entity.startIndex) + linkHtml + result.slice(entity.endIndex);
    }

    return result;
  }

  /**
   * 개별 링크 HTML 생성
   */
  private createLinkHtml(entity: DetectedEntity): string {
    const { text, type, data } = entity;
    
    // 링크 클래스와 데이터 속성 설정
    const linkClass = `oi-link oi-link-${type}`;
    const dataAttrs = [
      `data-type="${type}"`,
      `data-id="${data.id}"`,
      `data-name="${data.name}"`,
    ];

    if (data.lat && data.lon) {
      dataAttrs.push(`data-lat="${data.lat}"`);
      dataAttrs.push(`data-lon="${data.lon}"`);
    }

    if (data.address) {
      dataAttrs.push(`data-address="${data.address}"`);
    }

    // 아이콘 추가
    const icon = this.getEntityIcon(type);
    
    return `<a href="#" class="${linkClass}" ${dataAttrs.join(' ')} onclick="return false;">${icon}${text}</a>`;
  }

  /**
   * 엔티티 유형별 아이콘 반환
   */
  private getEntityIcon(type: LinkableEntityType): string {
    const icons = {
      apartment: '🏢',
      subway: '🚇',
      bus_stop: '🚌',
      school: '🏫',
      hospital: '🏥',
      mart: '🛒',
      park: '🌳',
      government: '🏛️',
      bank: '🏦',
      restaurant: '🍴'
    };

    return icons[type] || '📍';
  }

  /**
   * 일반적인 단어인지 확인 (링크 제외용)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      '그곳', '여기', '저기', '거기', '이곳', '어디',
      '병원', '학교', '마트', '공원', '역', '정도',
      '시설', '건물', '장소', '위치', '지역', '곳'
    ];

    return commonWords.includes(word.trim());
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.apartmentCache.clear();
    this.poiCache.clear();
    console.log('✅ ResponseProcessor 캐시 초기화 완료');
  }

  /**
   * 실거래가 테이블의 컬럼명을 거래유형에 맞게 개선합니다
   */
  improveRealEstateTable(text: string): string {
    // 마크다운 테이블을 찾는 정규식 (| 거래금액 | 보증금 | 형태의 테이블)
    const tableRegex = /(\|[^|\n]*거래금액[^|\n]*\|[^|\n]*보증금[^|\n]*\|[^|\n]*\|\s*\n\s*\|[^|\n]*\|[^|\n]*\|[^|\n]*\|\s*\n(?:\|[^|\n]*\|[^|\n]*\|[^|\n]*\|[^|\n]*\n)*)/gi;
    
    return text.replace(tableRegex, (match) => {
      console.log('🔍 실거래가 테이블 감지 및 개선 시작');
      
      // 테이블 행들을 분리
      const lines = match.split('\n').filter(line => line.trim());
      if (lines.length < 3) return match; // 헤더, 구분선, 최소 1개 데이터 행 필요
      
      // 헤더 행과 데이터 행들 분리
      const headerLine = lines[0];
      const separatorLine = lines[1];
      const dataLines = lines.slice(2);
      
      // 데이터 행들을 분석하여 거래유형별로 그룹화
      const groupedRows: { [key: string]: string[] } = {
        '매매': [],
        '전세': [],
        '월세': []
      };
      
      dataLines.forEach(line => {
        // 각 행의 거래금액과 보증금, 월세 값을 추출
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length < 4) return;
        
        // 일반적으로 [거래일, 거래금액, 보증금, 월세, 면적, 층] 순서
        const dealAmount = cells[1] || '';
        const deposit = cells[2] || '';
        const monthlyRent = cells[3] || '';
        
        // 거래유형 판단
        let dealType = '';
        if (dealAmount && dealAmount !== '-' && dealAmount !== '0' && dealAmount !== '') {
          dealType = '매매';
        } else if (monthlyRent === '-' || monthlyRent === '0' || monthlyRent === '') {
          dealType = '전세';
        } else {
          dealType = '월세';
        }
        
        groupedRows[dealType].push(line);
      });
      
      // 거래유형별로 테이블 재구성
      let improvedTable = '';
      
      Object.entries(groupedRows).forEach(([dealType, rows]) => {
        if (rows.length === 0) return;
        
        // 거래유형에 맞는 헤더 생성
        let typeSpecificHeader = '';
        let typeSpecificSeparator = '';
        
        switch (dealType) {
          case '매매':
            typeSpecificHeader = '| 거래일 | 매매가 | 면적 | 층 |';
            typeSpecificSeparator = '|-------|-------|------|-----|';
            break;
          case '전세':
            typeSpecificHeader = '| 거래일 | 전세가 | 면적 | 층 |';
            typeSpecificSeparator = '|-------|-------|------|-----|';
            break;
          case '월세':
            typeSpecificHeader = '| 거래일 | 보증금 | 월세 | 면적 | 층 |';
            typeSpecificSeparator = '|-------|-------|------|------|-----|';
            break;
        }
        
        improvedTable += `\n**${dealType} 거래**\n\n${typeSpecificHeader}\n${typeSpecificSeparator}\n`;
        
        // 데이터 행들을 거래유형에 맞게 변환
        rows.forEach(row => {
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length < 4) return;
          
          let transformedRow = '';
          switch (dealType) {
            case '매매':
              // [거래일, 매매가, 면적, 층]
              transformedRow = `| ${cells[0]} | ${cells[1]} | ${cells[4] || cells[3]} | ${cells[5] || cells[4] || '-'} |`;
              break;
            case '전세':
              // [거래일, 전세가(보증금), 면적, 층]
              transformedRow = `| ${cells[0]} | ${cells[2]} | ${cells[4] || cells[3]} | ${cells[5] || cells[4] || '-'} |`;
              break;
            case '월세':
              // [거래일, 보증금, 월세, 면적, 층]
              transformedRow = `| ${cells[0]} | ${cells[2]} | ${cells[3]} | ${cells[4]} | ${cells[5] || '-'} |`;
              break;
          }
          
          improvedTable += transformedRow + '\n';
        });
        
        improvedTable += '\n';
      });
      
      console.log('✅ 실거래가 테이블 개선 완료');
      return improvedTable.trim();
    });
  }
}

/**
 * 기본 응답 처리기 인스턴스
 */
export const defaultResponseProcessor = new ResponseProcessor();

/**
 * 빠른 응답 처리 헬퍼 함수 - 실거래가 테이블 개선 + 스마트 링크 생성
 */
export async function processAIResponse(text: string): Promise<ProcessedResponse> {
  // 1. 실거래가 테이블 개선
  const improvedText = defaultResponseProcessor.improveRealEstateTable(text);
  
  // 2. 스마트 링크 생성
  return await defaultResponseProcessor.processResponse(improvedText);
}