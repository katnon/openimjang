// apps/bff/src/ai/clarify/templates.ts
// 슬롯별 Clarify 질문 템플릿 구현

import { 
  ClarifyTemplate, 
  ClarifyQuestion, 
  ClarifyContext, 
  ClarifyReason,
  ApartmentCandidate 
} from './types';

/**
 * 아파트명 Clarify 템플릿
 */
export const apartmentNameTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, partialValue, candidates, userProfile } = context;

  switch (reason) {
    case 'missing':
      return {
        question: "어느 아파트에 대해 알고 싶으신가요? 아파트 이름을 알려주세요.",
        priority: 1,
        expectedResponseType: 'text',
        hint: "예: 마곡엠밸리, 강남래미안 등"
      };

    case 'partial':
      if (partialValue) {
        return {
          question: `말씀하신 '${partialValue}' 관련하여 추가 정보가 필요합니다. 해당 아파트의 정확한 이름이나 위치를 알려주시겠어요?`,
          priority: 1,
          expectedResponseType: 'text',
          hint: "정확한 아파트명이나 지역 정보를 추가해 주세요"
        };
      }
      break;

    case 'ambiguous':
      if (candidates && candidates.length > 0) {
        const suggestionList = candidates.slice(0, 5); // 최대 5개까지
        return {
          question: `'${partialValue}' 아파트가 여러 곳 있습니다. 어느 곳을 말씀하시는 건가요?`,
          suggestions: suggestionList,
          priority: 1,
          expectedResponseType: 'selection',
          hint: "원하는 아파트를 선택하거나 더 구체적인 정보를 알려주세요"
        };
      }
      break;

    case 'confirmation':
      if (partialValue) {
        return {
          question: `'${partialValue}' 아파트가 맞나요?`,
          priority: 2,
          expectedResponseType: 'boolean',
          suggestions: ['네, 맞습니다', '아니요, 다른 아파트입니다']
        };
      }
      break;
  }

  // 기본값
  return {
    question: "아파트 이름을 다시 확인해 주시겠어요?",
    priority: 2,
    expectedResponseType: 'text'
  };
};

/**
 * 거래유형 Clarify 템플릿
 */
export const dealTypeTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, userProfile } = context;

  // 사용자 프로필 기반 개인화
  const profileHint = userProfile?.purpose?.includes('투자') 
    ? "투자 목적이시라면 매매 정보가 도움이 될 것 같아요" 
    : userProfile?.purpose?.includes('거주')
    ? "거주 목적이시라면 전세나 월세 정보도 함께 확인해보시는 것이 좋겠어요"
    : undefined;

  switch (reason) {
    case 'missing':
      return {
        question: "어떤 거래 유형을 알고 싶으신가요?",
        suggestions: ['매매', '전세', '월세', '전체'],
        priority: 3,
        expectedResponseType: 'selection',
        hint: profileHint || "매매, 전세, 월세 중에서 선택해 주세요"
      };

    case 'ambiguous':
      return {
        question: "거래 유형을 좀 더 구체적으로 알려주시겠어요?",
        suggestions: ['매매 가격', '전세 가격', '월세 정보', '모든 거래'],
        priority: 3,
        expectedResponseType: 'selection'
      };
  }

  return {
    question: "매매와 전세 중 어떤 거래를 알고 싶으신가요?",
    suggestions: ['매매', '전세'],
    priority: 3,
    expectedResponseType: 'selection'
  };
};

/**
 * 면적 Clarify 템플릿
 */
export const areaTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, partialValue, currentSlots } = context;

  // 해당 아파트의 대표 평형 정보가 있다면 활용
  const apartmentName = currentSlots.apartmentName;
  const commonAreas = ['59', '74', '84', '101', '114']; // 일반적인 면적들

  switch (reason) {
    case 'missing':
      const baseQuestion = apartmentName 
        ? `${apartmentName}의 몇 평형을 기준으로 알아볼까요?`
        : "관심 있는 평형(전용면적)을 알려주시겠어요?";
      
      return {
        question: baseQuestion,
        suggestions: commonAreas.map(area => `${area}㎡`),
        priority: 4,
        expectedResponseType: 'text',
        hint: "예: 84㎡, 59형 등으로 입력해 주세요"
      };

    case 'partial':
    case 'ambiguous':
      if (partialValue) {
        return {
          question: `전용면적 ${partialValue}㎡를 말씀하시는 게 맞나요?`,
          priority: 4,
          expectedResponseType: 'boolean',
          suggestions: ['네, 맞습니다', '아니요, 다른 면적입니다']
        };
      }
      break;

    case 'confirmation':
      if (partialValue) {
        return {
          question: `${partialValue}㎡ 타입이 여러 개 있습니다. 특정 타입이 있나요, 아니면 전체 평균으로 볼까요?`,
          suggestions: ['전체 평균', '특정 타입'],
          priority: 4,
          expectedResponseType: 'selection'
        };
      }
      break;
  }

  return {
    question: "전용면적을 ㎡ 단위로 알려주세요.",
    priority: 4,
    expectedResponseType: 'text',
    hint: "예: 84 (84㎡를 의미)"
  };
};

/**
 * 기간 Clarify 템플릿
 */
export const periodTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, userProfile } = context;

  // 사용자 목적에 따른 추천 기간
  const profileHint = userProfile?.purpose?.includes('투자')
    ? "투자 분석을 위해서는 1년 이상의 데이터를 보시는 것을 추천드려요"
    : userProfile?.purpose?.includes('매매')
    ? "매매 계획이시라면 최근 6개월 데이터가 유용할 것 같아요"
    : undefined;

  switch (reason) {
    case 'missing':
      return {
        question: "조회할 기간을 설정해 주세요.",
        suggestions: ['최근 3개월', '최근 6개월', '최근 1년', '최근 2년'],
        priority: 6,
        expectedResponseType: 'selection',
        hint: profileHint || "기간을 선택하시거나 직접 입력해 주세요"
      };

    case 'ambiguous':
      return {
        question: "'최근'이라 함은 구체적으로 어느 기간을 말씀하시는 건가요?",
        suggestions: ['3개월', '6개월', '1년'],
        priority: 6,
        expectedResponseType: 'selection'
      };
  }

  return {
    question: "데이터 조회 기간을 알려주세요.",
    suggestions: ['3개월', '6개월', '1년'],
    priority: 6,
    expectedResponseType: 'selection'
  };
};

/**
 * 지역 Clarify 템플릿
 */
export const regionTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, partialValue } = context;

  switch (reason) {
    case 'missing':
      return {
        question: "어느 지역에 대해 알고 싶으신가요?",
        priority: 2,
        expectedResponseType: 'text',
        hint: "예: 강남구, 서초구, 마곡동 등"
      };

    case 'partial':
    case 'ambiguous':
      if (partialValue) {
        return {
          question: `'${partialValue}' 지역의 어느 구체적인 위치를 말씀하시는 건가요?`,
          priority: 2,
          expectedResponseType: 'text',
          hint: "더 구체적인 지역명을 알려주세요"
        };
      }
      break;
  }

  return {
    question: "지역을 좀 더 구체적으로 알려주세요.",
    priority: 2,
    expectedResponseType: 'text'
  };
};

/**
 * 단지번호 Clarify 템플릿
 */
export const complexNumberTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, currentSlots, candidates } = context;
  const apartmentName = currentSlots.apartmentName;

  switch (reason) {
    case 'missing':
    case 'ambiguous':
      if (candidates && candidates.length > 0) {
        return {
          question: apartmentName 
            ? `${apartmentName}에 여러 단지가 있습니다. 어느 단지를 말씀하시는 건가요?`
            : "몇 단지를 말씀하시는 건가요?",
          suggestions: candidates,
          priority: 5,
          expectedResponseType: 'selection'
        };
      }
      break;
  }

  return {
    question: "단지 번호를 알려주세요.",
    priority: 5,
    expectedResponseType: 'text',
    hint: "예: 7단지, 3차 등"
  };
};

/**
 * 가격범위 Clarify 템플릿
 */
export const priceRangeTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason, userProfile, currentSlots } = context;

  // 사용자 예산 정보 활용
  const budgetInfo = userProfile?.budgetRange;
  const dealType = currentSlots.dealType;

  let suggestions: string[] = [];
  let hint = "";

  if (dealType === '매매') {
    suggestions = ['3억 이하', '3억~5억', '5억~7억', '7억~10억', '10억 이상'];
    hint = "매매 가격 범위를 선택해 주세요";
  } else if (dealType === '전세') {
    suggestions = ['2억 이하', '2억~3억', '3억~4억', '4억~5억', '5억 이상'];
    hint = "전세 가격 범위를 선택해 주세요";
  } else {
    suggestions = ['50만원 이하', '50만원~100만원', '100만원~150만원', '150만원 이상'];
    hint = "월세 범위를 선택해 주세요";
  }

  // 사용자 예산 정보가 있으면 힌트에 포함
  if (budgetInfo && budgetInfo.length === 2) {
    const min = Math.floor(budgetInfo[0] / 10000);
    const max = Math.floor(budgetInfo[1] / 10000);
    hint += ` (회원님 예산: ${min}억~${max}억)`;
  }

  switch (reason) {
    case 'missing':
      return {
        question: "관심 있는 가격 범위를 알려주시겠어요?",
        suggestions,
        priority: 7,
        expectedResponseType: 'selection',
        hint
      };
  }

  return {
    question: "가격 범위를 설정해 주세요.",
    suggestions,
    priority: 7,
    expectedResponseType: 'selection'
  };
};

/**
 * 면적범위 Clarify 템플릿
 */
export const areaRangeTemplate: ClarifyTemplate = (context: ClarifyContext): ClarifyQuestion => {
  const { reason } = context;

  switch (reason) {
    case 'missing':
      return {
        question: "관심 있는 면적 범위를 알려주시겠어요?",
        suggestions: ['59㎡ 이하', '60㎡~84㎡', '85㎡~100㎡', '100㎡ 이상'],
        priority: 8,
        expectedResponseType: 'selection',
        hint: "면적 범위를 선택하거나 직접 입력해 주세요"
      };
  }

  return {
    question: "면적 범위를 설정해 주세요.",
    priority: 8,
    expectedResponseType: 'text'
  };
};

/**
 * 모든 템플릿을 모은 매핑 객체
 */
export const clarifyTemplates = {
  apartmentName: apartmentNameTemplate,
  dealType: dealTypeTemplate,
  area: areaTemplate,
  period: periodTemplate,
  region: regionTemplate,
  complexNumber: complexNumberTemplate,
  priceRange: priceRangeTemplate,
  areaRange: areaRangeTemplate
};