// AI Tools 파라미터 검증 파이프라인
import Ajv from 'ajv';
import { ToolSchema } from './types';

// Ajv 인스턴스 생성
const ajv = new Ajv({ 
  allErrors: true,           // 모든 에러 수집
  removeAdditional: 'all',   // 추가 속성 자동 제거
  strict: false              // OpenAI 스키마와 호환성을 위해 strict 모드 비활성화
});

/**
 * 스키마를 이용해 데이터를 검증하고, 검증 실패시 에러를 던집니다.
 */
export function validateOrThrow(schema: ToolSchema, data: unknown): void {
  const validate = ajv.compile(schema.parameters);
  const isValid = validate(data);
  
  if (!isValid) {
    const errors = validate.errors || [];
    const errorMessages = errors.map(err => {
      const path = err.instancePath || 'root';
      const message = err.message || 'validation error';
      return `${path}: ${message}`;
    });
    
    const error = new Error(`파라미터 검증 실패: ${errorMessages.join(', ')}`);
    (error as any).status = 400;
    (error as any).validationErrors = errors;
    throw error;
  }
}

/**
 * 스키마 검증 (에러를 던지지 않고 결과만 반환)
 */
export function validateSchema(schema: ToolSchema, data: unknown): {
  valid: boolean;
  errors?: any[];
} {
  try {
    const validate = ajv.compile(schema.parameters);
    const isValid = validate(data);
    return {
      valid: isValid,
      errors: isValid ? undefined : validate.errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: '스키마 컴파일 실패', error: error.message }]
    };
  }
}