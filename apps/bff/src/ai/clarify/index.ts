// apps/bff/src/ai/clarify/index.ts
// Clarify 정책 시스템 통합 인덱스

export * from './types';
export * from './templates';
export * from './matcher';
export * from './policy';

// 편의성을 위한 메인 exports
export { defaultClarifyPolicy } from './policy';
export { apartmentMatcher } from './matcher';
export { clarifyTemplates } from './templates';