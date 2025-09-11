// apps/bff/src/ai/planner/intentAnalyzer.ts
// 사용자 질문에서 의도를 분석하고 추출하는 모듈

import { QuestionIntent, ExtractedEntity, PlanContext } from './types';
import { ConversationSlots } from '../types/slots';

/**
 * 질문 의도를 분석합니다
 */
export function analyzeIntent(question: string, slots: ConversationSlots): QuestionIntent {
  const normalizedQuestion = question.toLowerCase().trim();
  
  // 1. 카테고리 분류
  const category = classifyCategory(normalizedQuestion);
  
  // 2. 세부 분류
  const subcategory = classifySubcategory(normalizedQuestion, category);
  
  // 3. 개체 추출
  const entities = extractEntities(normalizedQuestion);
  
  // 4. 암시된 액션 추출
  const actions = extractImpliedActions(normalizedQuestion, category);
  
  // 5. 신뢰도 계산
  const confidence = calculateConfidence(normalizedQuestion, category, entities);

  return {
    category,
    subcategory,
    confidence,
    entities,
    actions
  };
}

/**
 * 주요 카테고리 분류
 */
function classifyCategory(question: string): QuestionIntent['category'] {
  // 검색 관련 키워드
  const searchKeywords = [
    '실거래가', '가격', '시세', '매매가', '전세', '월세', '거래',
    '아파트', '단지', '찾아', '검색', '조회', '알려'
  ];
  
  // 분석 관련 키워드
  const analysisKeywords = [
    '분석', '추이', '동향', '변화', '트렌드', '통계', '평균',
    '상승', '하락', '변동', '패턴'
  ];
  
  // 비교 관련 키워드
  const comparisonKeywords = [
    '비교', '차이', '대비', '어떤게', '뭐가 좋', '장단점'
  ];
  
  // 추천 관련 키워드
  const recommendationKeywords = [
    '추천', '투자', '어떤가', '어때', '좋은', '괜찮', '의견'
  ];
  
  // 명확화 관련 키워드
  const clarificationKeywords = [
    '그 아파트', '거기', '그곳', '그 지역', '그 단지', '앞에 말한'
  ];

  if (clarificationKeywords.some(keyword => question.includes(keyword))) {
    return 'clarification';
  }
  
  if (analysisKeywords.some(keyword => question.includes(keyword))) {
    return 'analysis';
  }
  
  if (comparisonKeywords.some(keyword => question.includes(keyword))) {
    return 'comparison';
  }
  
  if (recommendationKeywords.some(keyword => question.includes(keyword))) {
    return 'recommendation';
  }
  
  if (searchKeywords.some(keyword => question.includes(keyword))) {
    return 'search';
  }
  
  return 'general';
}

/**
 * 세부 카테고리 분류
 */
function classifySubcategory(question: string, category: QuestionIntent['category']): string | undefined {
  switch (category) {
    case 'search':
      if (question.includes('실거래가') || question.includes('가격') || question.includes('시세')) {
        return 'price_search';
      }
      if (question.includes('주변') || question.includes('편의시설') || question.includes('교통')) {
        return 'poi_search';
      }
      if (question.includes('아파트') || question.includes('단지')) {
        return 'apartment_search';
      }
      return 'general_search';
      
    case 'analysis':
      if (question.includes('추이') || question.includes('트렌드') || question.includes('변화')) {
        return 'trend_analysis';
      }
      if (question.includes('통계') || question.includes('평균') || question.includes('분포')) {
        return 'statistical_analysis';
      }
      if (question.includes('예측') || question.includes('전망')) {
        return 'prediction_analysis';
      }
      return 'general_analysis';
      
    case 'comparison':
      if (question.includes('아파트') || question.includes('단지')) {
        return 'apartment_comparison';
      }
      if (question.includes('지역') || question.includes('구역')) {
        return 'region_comparison';
      }
      return 'general_comparison';
      
    case 'recommendation':
      if (question.includes('투자')) {
        return 'investment_recommendation';
      }
      if (question.includes('거주') || question.includes('살기')) {
        return 'living_recommendation';
      }
      return 'general_recommendation';
      
    default:
      return undefined;
  }
}

/**
 * 개체 추출
 */
function extractEntities(question: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // 아파트명 추출
  const apartmentPatterns = [
    /([\w가-힣]+(?:아파트|단지|빌라|타워|캐슬|팰리스|래미안|힐스테이트|엠밸리|푸르지오|위브)[\w가-힣]*)/g
  ];
  
  for (const pattern of apartmentPatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'apartment',
        value: match[1],
        confidence: 0.9,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  // 지역명 추출
  const regionPatterns = [
    /([\w가-힣]+)(?:구|군|시|동|읍|면)/g
  ];
  
  for (const pattern of regionPatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'region',
        value: match[0],
        confidence: 0.8,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  // 면적 추출
  const areaPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:형|평|㎡|제곱미터|m2)/g
  ];
  
  for (const pattern of areaPatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'area',
        value: match[1],
        confidence: 0.95,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  // 가격 범위 추출
  const pricePatterns = [
    /(\d+)\s*억?\s*~\s*(\d+)\s*억/g,
    /(\d+)\s*에서\s*(\d+)\s*억/g
  ];
  
  for (const pattern of pricePatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'price',
        value: `${match[1]}-${match[2]}억`,
        confidence: 0.85,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  // 시간 표현 추출
  const timePatterns = [
    /(최근\s*\d+\s*개월)/g,
    /(최근\s*\d+\s*년)/g,
    /(작년|올해|금년|지난해)/g
  ];
  
  for (const pattern of timePatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'time',
        value: match[1] || match[0],
        confidence: 0.8,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  // 거래 유형 추출
  const dealTypePatterns = [
    /(매매|전세|월세)/g
  ];
  
  for (const pattern of dealTypePatterns) {
    const matches = Array.from(question.matchAll(pattern));
    for (const match of matches) {
      entities.push({
        type: 'deal_type',
        value: match[1],
        confidence: 0.95,
        position: [match.index || 0, (match.index || 0) + match[0].length]
      });
    }
  }
  
  return entities;
}

/**
 * 암시된 액션 추출
 */
function extractImpliedActions(question: string, category: QuestionIntent['category']): string[] {
  const actions: string[] = [];
  
  // 기본 액션은 카테고리에 따라 결정
  switch (category) {
    case 'search':
      actions.push('searchRealEstate');
      break;
    case 'analysis':
      actions.push('calculateStats', 'summarize');
      break;
    case 'comparison':
      actions.push('compare', 'summarize');
      break;
    case 'recommendation':
      actions.push('recommend');
      break;
    case 'clarification':
      actions.push('clarify');
      break;
  }
  
  // 추가 액션들을 키워드 기반으로 추출
  if (question.includes('그래프') || question.includes('차트') || question.includes('시각화')) {
    actions.push('visualize');
  }
  
  if (question.includes('주변') || question.includes('편의시설') || question.includes('교통')) {
    actions.push('searchPOI');
  }
  
  if (question.includes('추이') || question.includes('트렌드') || question.includes('변화')) {
    actions.push('calculateStats');
  }
  
  if (question.includes('예측') || question.includes('전망')) {
    actions.push('rag'); // 외부 지식이 필요할 수 있음
  }
  
  return [...new Set(actions)]; // 중복 제거
}

/**
 * 의도 분류 신뢰도 계산
 */
function calculateConfidence(
  question: string, 
  category: QuestionIntent['category'], 
  entities: ExtractedEntity[]
): number {
  let confidence = 0.5; // 기본 신뢰도
  
  // 키워드 매칭도에 따른 신뢰도 조정
  const categoryKeywords = getCategoryKeywords(category);
  const matchedKeywords = categoryKeywords.filter(keyword => 
    question.toLowerCase().includes(keyword)
  );
  
  confidence += (matchedKeywords.length / categoryKeywords.length) * 0.3;
  
  // 추출된 개체 수에 따른 신뢰도 조정
  confidence += Math.min(entities.length * 0.1, 0.2);
  
  // 문장 길이에 따른 조정 (너무 짧거나 길면 신뢰도 감소)
  const wordCount = question.split(/\s+/).length;
  if (wordCount >= 3 && wordCount <= 20) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * 카테고리별 대표 키워드
 */
function getCategoryKeywords(category: QuestionIntent['category']): string[] {
  const keywords = {
    search: ['찾아', '검색', '조회', '알려', '가격', '시세'],
    analysis: ['분석', '추이', '동향', '변화', '트렌드', '통계'],
    comparison: ['비교', '차이', '대비', '어떤게', '장단점'],
    recommendation: ['추천', '어떤가', '어때', '좋은', '의견'],
    clarification: ['그 아파트', '거기', '그곳', '그 지역'],
    general: ['부동산', '임장', '투자', '정보']
  };
  
  return keywords[category] || keywords.general;
}

/**
 * 컨텍스트 기반 의도 개선
 */
export function refineIntentWithContext(
  intent: QuestionIntent, 
  context: PlanContext
): QuestionIntent {
  // 이전 대화 기록을 고려하여 의도를 개선
  const { sessionHistory, slots } = context;
  
  // 참조 표현이 있는 경우 clarification으로 재분류
  if (intent.entities.some(e => ['그 아파트', '거기', '그곳'].includes(e.value))) {
    if (!slots.apartmentName) {
      return {
        ...intent,
        category: 'clarification',
        confidence: Math.max(intent.confidence, 0.8)
      };
    }
  }
  
  // 세션 기록 기반 개선
  if (sessionHistory.lastQuestionTypes.length > 0) {
    const lastType = sessionHistory.lastQuestionTypes[sessionHistory.lastQuestionTypes.length - 1];
    
    // 연속된 비슷한 질문 패턴 감지
    if (lastType === intent.category) {
      intent.confidence = Math.min(intent.confidence + 0.1, 1.0);
    }
  }
  
  return intent;
}