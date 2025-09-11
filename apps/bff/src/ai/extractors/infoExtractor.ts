// apps/bff/src/ai/extractors/infoExtractor.ts
// 사용자 입력에서 구조화된 정보 추출

import { ConversationSlots, ExtractionResult, ReferenceMatch } from '../types/slots';

/**
 * 사용자 메시지에서 부동산 관련 정보를 추출합니다.
 */
export function extractSlotsFromMessage(message: string): ExtractionResult {
  const slots: Partial<ConversationSlots> = {};
  const fieldConfidence: { [key: string]: number } = {};
  const references: ReferenceMatch[] = [];

  const normalizedMessage = message.toLowerCase().trim();
  let overallConfidence = 0;
  let extractedFields = 0;

  // 1. 아파트명 추출 (높은 신뢰도)
  const apartmentResult = extractApartmentName(message);
  if (apartmentResult.value) {
    slots.apartmentName = apartmentResult.value;
    fieldConfidence.apartmentName = apartmentResult.confidence;
    extractedFields++;
    overallConfidence += apartmentResult.confidence;
  }

  // 2. 단지번호 추출
  const complexResult = extractComplexNumber(message);
  if (complexResult.value) {
    slots.complexNumber = complexResult.value;
    fieldConfidence.complexNumber = complexResult.confidence;
    extractedFields++;
    overallConfidence += complexResult.confidence;
  }

  // 3. 거래유형 추출
  const dealTypeResult = extractDealType(message);
  if (dealTypeResult.value) {
    slots.dealType = dealTypeResult.value;
    fieldConfidence.dealType = dealTypeResult.confidence;
    extractedFields++;
    overallConfidence += dealTypeResult.confidence;
  }

  // 4. 면적 정보 추출
  const areaResult = extractArea(message);
  if (areaResult.value) {
    slots.area = areaResult.value;
    fieldConfidence.area = areaResult.confidence;
    extractedFields++;
    overallConfidence += areaResult.confidence;
  }

  // 5. 지역 정보 추출
  const regionResult = extractRegion(message);
  if (regionResult.value) {
    slots.region = regionResult.value;
    fieldConfidence.region = regionResult.confidence;
    extractedFields++;
    overallConfidence += regionResult.confidence;
  }

  // 6. 기간 정보 추출
  const periodResult = extractPeriod(message);
  if (periodResult.value) {
    slots.period = periodResult.value;
    fieldConfidence.period = periodResult.confidence;
    extractedFields++;
    overallConfidence += periodResult.confidence;
  }

  // 7. 가격 범위 추출
  const priceRangeResult = extractPriceRange(message);
  if (priceRangeResult.value) {
    slots.priceRange = priceRangeResult.value;
    fieldConfidence.priceRange = priceRangeResult.confidence;
    extractedFields++;
    overallConfidence += priceRangeResult.confidence;
  }

  // 8. 참조 표현 감지
  const referenceMatches = detectReferences(message);
  references.push(...referenceMatches);

  return {
    slots,
    confidence: extractedFields > 0 ? overallConfidence / extractedFields : 0,
    fieldConfidence,
    references
  };
}

/**
 * 아파트명 추출
 */
function extractApartmentName(message: string): { value: string | null, confidence: number } {
  // 일반적인 아파트명 패턴
  const patterns = [
    // 정확한 아파트명 패턴
    /([\w가-힣]+(?:아파트|단지|빌라|타워|캐슬|팰리스|래미안|힐스테이트|엠밸리|푸르지오|위브|디에이치|롯데캐슬|현대|삼성|대우|LG)[\w가-힣]*)/g,
    // 단순 아파트명 (숫자 + 한글)
    /([\w가-힣]{2,})\s*(?:아파트|단지|APT)/gi,
    // 브랜드명
    /(래미안|힐스테이트|엠밸리|푸르지오|위브|디에이치|롯데캐슬)\s*([\w가-힣]+)/gi
  ];

  for (const pattern of patterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      const apartmentName = match[1] || match[0];
      if (apartmentName && apartmentName.length >= 2) {
        return {
          value: apartmentName.trim(),
          confidence: 0.9 // 높은 신뢰도
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 단지번호 추출
 */
function extractComplexNumber(message: string): { value: string | null, confidence: number } {
  // 단지 번호 패턴
  const patterns = [
    /(\d+)\s*단지/g,
    /(\d+)\s*차/g,
    /(\d+)\s*호/g
  ];

  for (const pattern of patterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const number = matches[0][1];
      return {
        value: number + '단지',
        confidence: 0.8
      };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 거래유형 추출
 */
function extractDealType(message: string): { value: '매매' | '전세' | '월세' | '전체' | null, confidence: number } {
  const dealTypePatterns = {
    '매매': ['매매', '매수', '구매', '매입', '매매가', '시세', '값'],
    '전세': ['전세', '전셋값', '전세가', '전세금'],
    '월세': ['월세', '월임', '월세금', '월세가'],
    '전체': ['전체', '모두', '모든', '전반']
  };

  for (const [dealType, keywords] of Object.entries(dealTypePatterns)) {
    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        return {
          value: dealType as any,
          confidence: 0.85
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 면적 정보 추출
 */
function extractArea(message: string): { value: number | null, confidence: number } {
  // 면적 패턴 (평형, 제곱미터)
  const patterns = [
    /(\d+(?:\.\d+)?)\s*형/g,           // 59형
    /(\d+(?:\.\d+)?)\s*평/g,           // 32평
    /(\d+(?:\.\d+)?)\s*㎡/g,           // 84㎡
    /(\d+(?:\.\d+)?)\s*제곱미터/g,      // 84제곱미터
    /(\d+(?:\.\d+)?)\s*m2/gi,          // 84m2
    /(\d+(?:\.\d+)?)\s*M²/g            // 84M²
  ];

  for (const pattern of patterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const areaStr = matches[0][1];
      const area = parseFloat(areaStr);
      
      if (area > 0 && area < 1000) { // 합리적인 범위
        return {
          value: Math.round(area * 100) / 100, // 소수점 2자리까지
          confidence: 0.9
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 지역 정보 추출
 */
function extractRegion(message: string): { value: string | null, confidence: number } {
  // 지역명 패턴
  const patterns = [
    /([\w가-힣]+)(?:구|군|시)/g,       // 강서구, 성남시
    /([\w가-힣]+)(?:동|읍|면)/g,       // 신당동, 마곡동
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/g // 광역시도
  ];

  for (const pattern of patterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const region = matches[0][0];
      return {
        value: region,
        confidence: 0.7
      };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 기간 정보 추출
 */
function extractPeriod(message: string): { value: string | null, confidence: number } {
  const patterns = [
    /최근\s*(\d+)\s*개월/g,
    /(\d+)\s*개월/g,
    /최근\s*(\d+)\s*년/g,
    /(\d+)\s*년/g,
    /(작년|올해|금년|지난해)/g
  ];

  for (const pattern of patterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      if (match[1]) {
        // 숫자가 있는 경우
        const period = match[0];
        return {
          value: period,
          confidence: 0.8
        };
      } else {
        // "작년", "올해" 등
        return {
          value: match[0],
          confidence: 0.7
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 가격 범위 추출
 */
function extractPriceRange(message: string): { value: [number, number] | null, confidence: number } {
  // 가격 범위 패턴
  const rangePatterns = [
    /(\d+)\s*억?\s*~\s*(\d+)\s*억/g,      // "3~5억", "3억~5억"
    /(\d+)\s*에서\s*(\d+)\s*억/g,         // "3에서 5억"
    /(\d+)\s*억?\s*\w*\s*(\d+)\s*억\s*사이/g,  // "3억에서 5억 사이"
    /(\d+)\s*만\s*~\s*(\d+)\s*만/g,      // "3000만~5000만"
    /(\d+)\s*천\s*~\s*(\d+)\s*천/g       // "3천~5천" (만원 단위)
  ];

  for (const pattern of rangePatterns) {
    const matches = Array.from(message.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      
      if (min < max) {
        let multiplier = 1;
        if (message.includes('억')) {
          multiplier = 10000; // 억원 → 만원
        } else if (message.includes('천') && message.includes('만')) {
          multiplier = 1000; // 천만원 → 만원
        } else if (message.includes('천')) {
          multiplier = 1000; // 천만원 → 만원
        }
        
        return {
          value: [min * multiplier, max * multiplier],
          confidence: 0.85
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 참조 표현 감지 (지시어)
 */
function detectReferences(message: string): ReferenceMatch[] {
  const references: ReferenceMatch[] = [];
  
  const referencePatterns = [
    { pattern: /그\s*아파트/g, field: 'apartmentName' as const, confidence: 0.9 },
    { pattern: /거기/g, field: 'apartmentName' as const, confidence: 0.8 },
    { pattern: /그\s*곳/g, field: 'apartmentName' as const, confidence: 0.8 },
    { pattern: /그\s*단지/g, field: 'complexNumber' as const, confidence: 0.9 },
    { pattern: /같은\s*면적/g, field: 'area' as const, confidence: 0.8 },
    { pattern: /그\s*크기/g, field: 'area' as const, confidence: 0.7 },
    { pattern: /그\s*지역/g, field: 'region' as const, confidence: 0.8 },
  ];

  for (const refPattern of referencePatterns) {
    const matches = Array.from(message.matchAll(refPattern.pattern));
    for (const match of matches) {
      references.push({
        originalText: match[0],
        resolvedValue: null, // 실제 해석은 referenceResolver에서 수행
        fieldName: refPattern.field,
        confidence: refPattern.confidence,
        contextSource: 'previous_slot' // 기본값
      });
    }
  }

  return references;
}

/**
 * 유틸리티: 메시지에서 숫자 추출
 */
export function extractNumbers(text: string): number[] {
  const numberPattern = /\b\d+(?:\.\d+)?\b/g;
  const matches = text.match(numberPattern);
  return matches ? matches.map(Number) : [];
}

/**
 * 유틸리티: 메시지에서 키워드 존재 여부 확인
 */
export function containsKeywords(text: string, keywords: string[]): boolean {
  const normalizedText = text.toLowerCase();
  return keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()));
}