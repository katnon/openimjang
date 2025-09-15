/**
 * @deprecated AI 3.0 NaturalFlowManager로 대체되었습니다.
 * 사용 금지: 새로운 AI 3.0 자연스러운 대화 플로우 시스템을 사용하세요.
 * 대안: apps/bff/src/services/ai3/NaturalFlowManager.ts
 * 마이그레이션 예정일: 2025-01-15
 */
// apps/bff/src/ai/clarify/index.ts (LEGACY)
// Clarify 정책 시스템 통합 인덱스

export * from './types';
export * from './templates';
export * from './matcher';
export * from './policy';

// 편의성을 위한 메인 exports
export { defaultClarifyPolicy } from './policy';
export { apartmentMatcher } from './matcher';
export { clarifyTemplates } from './templates';