#!/usr/bin/env bun
// AI Tools 검증 스크립트

import { tools } from '../apps/bff/src/ai/tools';
import { handlers } from '../apps/bff/src/ai/handlers';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalTools: number;
    implementedHandlers: number;
    missingHandlers: number;
  };
}

async function validateTools(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const toolNames = new Set<string>();

  console.log('🔍 AI Tools 검증 시작...\n');

  // 1. 기본 구조 검증
  if (!Array.isArray(tools)) {
    errors.push('tools가 배열이 아닙니다.');
    return { success: false, errors, warnings, stats: { totalTools: 0, implementedHandlers: 0, missingHandlers: 0 } };
  }

  // 2. 각 도구 검증
  for (const [index, tool] of tools.entries()) {
    const prefix = `Tool[${index}]`;

    // 구조 검증
    if (!tool || typeof tool !== 'object') {
      errors.push(`${prefix}: 유효하지 않은 도구 객체`);
      continue;
    }

    if (tool.type !== 'function') {
      errors.push(`${prefix}: type이 'function'이 아닙니다: ${tool.type}`);
    }

    if (!tool.function) {
      errors.push(`${prefix}: function 속성이 없습니다`);
      continue;
    }

    const func = tool.function;

    // 함수 이름 검증
    if (!func.name || typeof func.name !== 'string') {
      errors.push(`${prefix}: 함수 이름이 없거나 유효하지 않습니다`);
      continue;
    }

    // 중복 이름 검사
    if (toolNames.has(func.name)) {
      errors.push(`${prefix}: 중복된 함수 이름: ${func.name}`);
    } else {
      toolNames.add(func.name);
    }

    // 설명 검증
    if (!func.description || typeof func.description !== 'string') {
      warnings.push(`${prefix}(${func.name}): 설명이 없거나 유효하지 않습니다`);
    }

    // 파라미터 검증
    if (!func.parameters) {
      errors.push(`${prefix}(${func.name}): parameters가 없습니다`);
      continue;
    }

    const params = func.parameters;
    if (params.type !== 'object') {
      errors.push(`${prefix}(${func.name}): parameters.type이 'object'가 아닙니다`);
    }

    if (!params.properties || typeof params.properties !== 'object') {
      warnings.push(`${prefix}(${func.name}): properties가 없거나 유효하지 않습니다`);
    }

    // required 필드 검증
    if (params.required && Array.isArray(params.required)) {
      for (const reqField of params.required) {
        if (!params.properties || !(reqField in params.properties)) {
          errors.push(`${prefix}(${func.name}): required 필드 '${reqField}'가 properties에 없습니다`);
        }
      }
    }

    // strict 모드 검증
    if (func.strict !== true) {
      warnings.push(`${prefix}(${func.name}): strict 모드가 활성화되지 않았습니다`);
    }
  }

  // 3. 핸들러 검증
  let implementedHandlers = 0;
  let missingHandlers = 0;

  for (const toolName of toolNames) {
    if (handlers[toolName]) {
      implementedHandlers++;
      // 핸들러가 함수인지 확인
      if (typeof handlers[toolName] !== 'function') {
        errors.push(`핸들러 ${toolName}이 함수가 아닙니다`);
      }
    } else {
      missingHandlers++;
      warnings.push(`핸들러 ${toolName}이 구현되지 않았습니다`);
    }
  }

  // 4. 결과 정리
  const stats = {
    totalTools: tools.length,
    implementedHandlers,
    missingHandlers
  };

  const success = errors.length === 0;

  return { success, errors, warnings, stats };
}

// 스크립트 실행
async function main() {
  try {
    const result = await validateTools();

    // 결과 출력
    console.log('📊 검증 통계:');
    console.log(`  - 총 도구 수: ${result.stats.totalTools}`);
    console.log(`  - 구현된 핸들러: ${result.stats.implementedHandlers}`);
    console.log(`  - 미구현 핸들러: ${result.stats.missingHandlers}\n`);

    if (result.warnings.length > 0) {
      console.log('⚠️  경고:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
      console.log();
    }

    if (result.errors.length > 0) {
      console.log('❌ 오류:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      console.log();
    }

    if (result.success) {
      console.log('✅ AI Tools 검증 완료! 모든 검사를 통과했습니다.');
      process.exit(0);
    } else {
      console.log('❌ AI Tools 검증 실패! 오류를 수정해주세요.');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 검증 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}