// apps/bff/scripts/test-slot-system.ts
// 슬롯 시스템 기능 테스트 스크립트

import { extractSlotsFromMessage } from '../src/ai/extractors/infoExtractor';
import { resolveReferences, mergeSlots } from '../src/ai/resolvers/referenceResolver';
import { ConversationSlots, SessionMessage } from '../src/ai/types/slots';

console.log('🧪 슬롯 시스템 테스트 시작\n');

// 테스트 1: 정보 추출 테스트
console.log('=== 테스트 1: 정보 추출 ===');
const testMessages = [
  '마곡엠밸리 7단지 매매가 알려줘',
  '59형 전세는 얼마야?',
  '강서구 아파트 찾아줘',
  '최근 3개월 거래가 궁금해',
  '3억에서 5억 사이로 찾아줘'
];

testMessages.forEach((message, index) => {
  console.log(`\n${index + 1}. 입력: "${message}"`);
  const result = extractSlotsFromMessage(message);
  console.log('   추출된 슬롯:', result.slots);
  console.log('   신뢰도:', result.confidence.toFixed(2));
  console.log('   참조 표현:', result.references.length > 0 ? result.references.map(r => r.originalText) : '없음');
});

// 테스트 2: 참조 해석 테스트
console.log('\n=== 테스트 2: 참조 해석 ===');

// 가상의 이전 슬롯 상태
const previousSlots: ConversationSlots = {
  apartmentName: '마곡엠밸리',
  complexNumber: '7단지',
  dealType: '매매',
  area: 84,
  region: '강서구'
};

// 가상의 메시지 히스토리  
const messageHistory: SessionMessage[] = [
  {
    role: 'user',
    content: '마곡엠밸리 7단지 84형 매매가 알려줘',
    timestamp: new Date(),
    extractedSlots: previousSlots
  }
];

const referenceTestMessages = [
  '그 아파트 전세는 어때?',
  '거기 59형도 있어?',
  '그 지역 다른 단지는?',
  '같은 면적으로 월세 찾아줘'
];

referenceTestMessages.forEach((message, index) => {
  console.log(`\n${index + 1}. 입력: "${message}"`);
  const extractResult = extractSlotsFromMessage(message);
  const resolvedRefs = resolveReferences(extractResult.references, previousSlots, messageHistory);
  
  console.log('   감지된 참조:', extractResult.references.map(r => r.originalText));
  console.log('   해석된 참조:', resolvedRefs.map(r => ({ 
    original: r.originalText, 
    resolved: r.resolvedValue,
    confidence: r.confidence.toFixed(2)
  })));
  
  const mergedSlots = mergeSlots(previousSlots, extractResult.slots, resolvedRefs);
  console.log('   최종 슬롯:', mergedSlots);
});

// 테스트 3: 슬롯 병합 전략 테스트
console.log('\n=== 테스트 3: 슬롯 병합 전략 ===');

const baseSlots: ConversationSlots = {
  apartmentName: '마곡엠밸리',
  dealType: '매매',
  area: 84
};

const newSlots = {
  dealType: '전세' as const,
  region: '강서구',
  period: '최근 3개월'
};

console.log('기존 슬롯:', baseSlots);
console.log('새 슬롯:', newSlots);

const strategies = ['merge', 'replace', 'preserve_existing'] as const;
strategies.forEach(strategy => {
  const merged = mergeSlots(baseSlots, newSlots, [], strategy);
  console.log(`${strategy} 전략 결과:`, merged);
});

// 테스트 4: 복잡한 시나리오 테스트
console.log('\n=== 테스트 4: 복잡한 시나리오 ===');

let currentSlots: ConversationSlots = {};
const conversationFlow = [
  '마곡엠밸리 정보 알려줘',
  '7단지 매매가는?',
  '84형 가격 궁금해',
  '그 아파트 전세는?',
  '59형도 보여줘',
  '거기 최근 3개월 거래현황은?'
];

console.log('대화 흐름 시뮬레이션:');
conversationFlow.forEach((message, index) => {
  console.log(`\n턴 ${index + 1}: "${message}"`);
  
  const extractResult = extractSlotsFromMessage(message);
  const msgHistory: SessionMessage[] = []; // 간소화
  const resolvedRefs = resolveReferences(extractResult.references, currentSlots, msgHistory);
  
  currentSlots = mergeSlots(currentSlots, extractResult.slots, resolvedRefs);
  
  console.log('   업데이트된 슬롯:', currentSlots);
  console.log('   참조 해석:', resolvedRefs.length > 0 ? resolvedRefs.map(r => `${r.originalText} → ${r.resolvedValue}`) : '없음');
});

console.log('\n🎉 슬롯 시스템 테스트 완료!');
console.log('\n최종 슬롯 상태:', currentSlots);