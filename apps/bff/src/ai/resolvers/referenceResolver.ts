// apps/bff/src/ai/resolvers/referenceResolver.ts
// 대화 맥락을 기반으로 지시어("그 아파트", "거기" 등)를 실제 값으로 해석

import { ConversationSlots, ReferenceMatch, UserSession, SessionMessage } from '../types/slots';

/**
 * 참조 표현을 실제 값으로 해석합니다.
 */
export function resolveReferences(
  references: ReferenceMatch[],
  currentSlots: ConversationSlots,
  messageHistory: SessionMessage[]
): ReferenceMatch[] {
  return references.map(ref => {
    const resolved = resolveReference(ref, currentSlots, messageHistory);
    return {
      ...ref,
      resolvedValue: resolved.value,
      confidence: resolved.confidence,
      contextSource: resolved.source
    };
  });
}

/**
 * 단일 참조 표현을 해석합니다.
 */
function resolveReference(
  reference: ReferenceMatch,
  currentSlots: ConversationSlots,
  messageHistory: SessionMessage[]
): { value: any, confidence: number, source: 'previous_slot' | 'message_history' | 'user_profile' } {
  
  // 1. 현재 슬롯에서 직접 해석 시도 (가장 높은 우선순위)
  const slotResolution = resolveFromCurrentSlots(reference, currentSlots);
  if (slotResolution.value !== null) {
    return {
      value: slotResolution.value,
      confidence: slotResolution.confidence,
      source: 'previous_slot'
    };
  }

  // 2. 메시지 히스토리에서 해석 시도
  const historyResolution = resolveFromMessageHistory(reference, messageHistory);
  if (historyResolution.value !== null) {
    return {
      value: historyResolution.value,
      confidence: historyResolution.confidence,
      source: 'message_history'
    };
  }

  // 3. 해석 실패
  return {
    value: null,
    confidence: 0,
    source: 'previous_slot'
  };
}

/**
 * 현재 슬롯에서 참조 해석
 */
function resolveFromCurrentSlots(
  reference: ReferenceMatch,
  slots: ConversationSlots
): { value: any, confidence: number } {
  
  const { fieldName, originalText, confidence: baseConfidence } = reference;
  
  // 필드별 해석 로직
  switch (fieldName) {
    case 'apartmentName':
      if (isApartmentReference(originalText)) {
        const value = slots.apartmentName;
        if (value) {
          return {
            value,
            confidence: Math.min(baseConfidence, 0.9) // 기존 신뢰도와 슬롯 신뢰도 중 낮은 값
          };
        }
      }
      break;

    case 'complexNumber':
      if (isComplexReference(originalText)) {
        const value = slots.complexNumber;
        if (value) {
          return { value, confidence: Math.min(baseConfidence, 0.9) };
        }
      }
      break;

    case 'area':
      if (isAreaReference(originalText)) {
        const value = slots.area;
        if (value) {
          return { value, confidence: Math.min(baseConfidence, 0.85) };
        }
      }
      break;

    case 'region':
      if (isRegionReference(originalText)) {
        const value = slots.region;
        if (value) {
          return { value, confidence: Math.min(baseConfidence, 0.8) };
        }
      }
      break;

    case 'dealType':
      // 거래유형은 일반적으로 참조되지 않지만, "같은 조건" 등의 표현 처리
      if (isSameConditionReference(originalText)) {
        const value = slots.dealType;
        if (value) {
          return { value, confidence: Math.min(baseConfidence, 0.7) };
        }
      }
      break;
  }

  return { value: null, confidence: 0 };
}

/**
 * 메시지 히스토리에서 참조 해석
 */
function resolveFromMessageHistory(
  reference: ReferenceMatch,
  messageHistory: SessionMessage[]
): { value: any, confidence: number } {
  
  // 최근 메시지부터 역순으로 검색
  const recentMessages = messageHistory.slice(-5).reverse();
  
  for (const message of recentMessages) {
    if (message.extractedSlots) {
      const slotValue = message.extractedSlots[reference.fieldName];
      if (slotValue) {
        return {
          value: slotValue,
          confidence: Math.max(reference.confidence * 0.8, 0.3) // 히스토리는 신뢰도 약간 감소
        };
      }
    }
  }

  // 메시지 내용에서 직접 추출 시도 (낮은 신뢰도)
  for (const message of recentMessages) {
    if (message.role === 'user') {
      const extractedValue = extractValueFromText(message.content, reference.fieldName);
      if (extractedValue) {
        return {
          value: extractedValue,
          confidence: Math.max(reference.confidence * 0.6, 0.2) // 더 낮은 신뢰도
        };
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * 아파트명 참조 표현인지 확인
 */
function isApartmentReference(text: string): boolean {
  const apartmentRefs = [
    '그 아파트', '그아파트', '거기', '그곳', '그 단지', '그단지',
    '그 건물', '그건물', '해당 아파트', '위 아파트'
  ];
  return apartmentRefs.some(ref => text.includes(ref));
}

/**
 * 단지번호 참조 표현인지 확인
 */
function isComplexReference(text: string): boolean {
  const complexRefs = [
    '그 단지', '그단지', '해당 단지', '같은 단지',
    '그 호', '그호', '해당 호'
  ];
  return complexRefs.some(ref => text.includes(ref));
}

/**
 * 면적 참조 표현인지 확인
 */
function isAreaReference(text: string): boolean {
  const areaRefs = [
    '같은 면적', '그 크기', '그크기', '동일한 면적',
    '해당 면적', '그 평형', '그평형'
  ];
  return areaRefs.some(ref => text.includes(ref));
}

/**
 * 지역 참조 표현인지 확인
 */
function isRegionReference(text: string): boolean {
  const regionRefs = [
    '그 지역', '그지역', '거기', '그곳', '해당 지역',
    '같은 지역', '동일 지역'
  ];
  return regionRefs.some(ref => text.includes(ref));
}

/**
 * 동일 조건 참조 표현인지 확인
 */
function isSameConditionReference(text: string): boolean {
  const conditionRefs = [
    '같은 조건', '동일한 조건', '비슷한 조건',
    '그 조건', '해당 조건'
  ];
  return conditionRefs.some(ref => text.includes(ref));
}

/**
 * 텍스트에서 특정 필드값 추출 시도
 */
function extractValueFromText(text: string, fieldName: keyof ConversationSlots): any {
  switch (fieldName) {
    case 'apartmentName':
      const aptMatch = text.match(/([\w가-힣]+(?:아파트|단지|빌라|타워|캐슬|팰리스|래미안|힐스테이트|엠밸리)[\w가-힣]*)/);
      return aptMatch ? aptMatch[1] : null;

    case 'complexNumber':
      const complexMatch = text.match(/(\d+)\s*단지/);
      return complexMatch ? complexMatch[1] + '단지' : null;

    case 'area':
      const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:형|평|㎡)/);
      return areaMatch ? parseFloat(areaMatch[1]) : null;

    case 'region':
      const regionMatch = text.match(/([\w가-힣]+)(?:구|군|시|동|읍|면)/);
      return regionMatch ? regionMatch[0] : null;

    case 'dealType':
      if (text.includes('매매')) return '매매';
      if (text.includes('전세')) return '전세';
      if (text.includes('월세')) return '월세';
      return null;

    default:
      return null;
  }
}

/**
 * 슬롯 병합 전략
 */
export function mergeSlots(
  currentSlots: ConversationSlots,
  newSlots: Partial<ConversationSlots>,
  resolvedReferences: ReferenceMatch[],
  strategy: 'replace' | 'merge' | 'preserve_existing' = 'merge'
): ConversationSlots {
  
  const merged = { ...currentSlots };

  // 1. 새로운 슬롯 병합
  for (const [key, value] of Object.entries(newSlots)) {
    if (value !== undefined && value !== null) {
      const fieldKey = key as keyof ConversationSlots;
      
      switch (strategy) {
        case 'replace':
          (merged as any)[fieldKey] = value;
          break;
          
        case 'merge':
          // 기존 값이 없거나 새 값이 더 신뢰할 만한 경우에만 교체
          if (!merged[fieldKey] || shouldReplaceSlotValue(merged[fieldKey], value)) {
            (merged as any)[fieldKey] = value;
          }
          break;
          
        case 'preserve_existing':
          // 기존 값이 없을 때만 설정
          if (!merged[fieldKey]) {
            (merged as any)[fieldKey] = value;
          }
          break;
      }
    }
  }

  // 2. 해석된 참조 적용
  for (const ref of resolvedReferences) {
    if (ref.resolvedValue !== null && ref.confidence > 0.3) {
      const fieldKey = ref.fieldName;
      
      // 참조 해석 결과는 신중하게 적용 (기존 값이 있으면 보존)
      if (!merged[fieldKey] || ref.confidence > 0.7) {
        (merged as any)[fieldKey] = ref.resolvedValue;
      }
    }
  }

  // 3. 메타데이터 업데이트
  merged.lastUpdated = new Date();

  return merged;
}

/**
 * 슬롯 값 교체 여부 결정
 */
function shouldReplaceSlotValue(existingValue: any, newValue: any): boolean {
  // 기존 값이 null/undefined면 항상 교체
  if (!existingValue) return true;
  
  // 새 값이 더 구체적인 경우 교체
  if (typeof newValue === 'string' && typeof existingValue === 'string') {
    return newValue.length > existingValue.length;
  }
  
  // 숫자의 경우 더 정확한 값으로 교체
  if (typeof newValue === 'number' && typeof existingValue === 'number') {
    return newValue !== existingValue;
  }
  
  return false;
}

/**
 * 참조 해석 품질 평가
 */
export function evaluateReferenceResolution(references: ReferenceMatch[]): {
  totalReferences: number;
  resolvedCount: number;
  averageConfidence: number;
  resolutionRate: number;
} {
  const totalReferences = references.length;
  const resolved = references.filter(ref => ref.resolvedValue !== null);
  const resolvedCount = resolved.length;
  
  const averageConfidence = resolved.length > 0 
    ? resolved.reduce((sum, ref) => sum + ref.confidence, 0) / resolved.length
    : 0;
    
  const resolutionRate = totalReferences > 0 ? resolvedCount / totalReferences : 0;

  return {
    totalReferences,
    resolvedCount,
    averageConfidence,
    resolutionRate
  };
}