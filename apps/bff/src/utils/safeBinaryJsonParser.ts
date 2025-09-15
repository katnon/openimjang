// 바이너리 데이터로부터 안전하게 JSON을 파싱하는 유틸리티
// 한글 인코딩 문제를 근본적으로 해결

export interface SafeJsonResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  encoding?: string;
  originalText?: string;
}

/**
 * 바이너리 데이터에서 여러 인코딩을 시도해 JSON을 안전하게 파싱
 */
export class SafeBinaryJsonParser {
  
  /**
   * Hono Context의 Request에서 바이너리 데이터를 안전하게 JSON으로 파싱
   */
  static async parseFromRequest<T = any>(request: Request): Promise<SafeJsonResult<T>> {
    try {
      console.log('📦 바이너리 안전 JSON 파싱 시작...');
      
      // 원본 바이너리 데이터 획득
      const arrayBuffer = await request.arrayBuffer();
      const rawBuffer = new Uint8Array(arrayBuffer);
      
      console.log(`📊 원본 바이너리 크기: ${rawBuffer.length} bytes`);
      
      return this.parseFromBuffer<T>(rawBuffer);
      
    } catch (error) {
      console.error('❌ Request 바이너리 파싱 실패:', error);
      return {
        success: false,
        error: `Request 파싱 실패: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Uint8Array 바이너리 버퍼에서 JSON 파싱 (여러 인코딩 시도)
   */
  static parseFromBuffer<T = any>(buffer: Uint8Array): SafeJsonResult<T> {
    const encodingStrategies = [
      { name: 'UTF-8', decoder: () => new TextDecoder('utf-8', { fatal: true }).decode(buffer) },
      { name: 'UTF-8-Non-Fatal', decoder: () => new TextDecoder('utf-8', { fatal: false }).decode(buffer) },
      { name: 'EUC-KR', decoder: () => new TextDecoder('euc-kr').decode(buffer) },
      { name: 'CP949', decoder: () => new TextDecoder('cp949').decode(buffer) },
      { name: 'ISO-8859-1', decoder: () => new TextDecoder('iso-8859-1').decode(buffer) },
      // 마지막 수단: byte-by-byte Latin1 변환
      { 
        name: 'Latin1-Fallback', 
        decoder: () => Array.from(buffer).map(byte => String.fromCharCode(byte)).join('') 
      }
    ];

    for (const strategy of encodingStrategies) {
      try {
        console.log(`🔍 ${strategy.name} 인코딩 시도 중...`);
        
        const decodedText = strategy.decoder();
        console.log(`📝 ${strategy.name} 디코딩 결과: "${decodedText.substring(0, 50)}..."`);
        
        // 더 엄격한 깨진 문자 검사
        const hasReplacementChars = decodedText.includes('�');
        const hasControlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(decodedText);
        const hasOddEncodingPatterns = /[À-ÿ]{3,}/.test(decodedText); // ISO-8859-1로 잘못 디코딩된 UTF-8 패턴
        
        if (hasReplacementChars || hasControlChars || hasOddEncodingPatterns) {
          console.log(`⚠️ ${strategy.name}: 깨진 문자 감지됨 (replacement: ${hasReplacementChars}, control: ${hasControlChars}, pattern: ${hasOddEncodingPatterns})`);
          continue;
        }

        // JSON 파싱 시도
        const jsonData = JSON.parse(decodedText);
        
        // UTF-8 Non-Fatal의 경우 한국어 텍스트가 제대로 디코딩되었는지 추가 검증
        if (strategy.name === 'UTF-8-Non-Fatal') {
          const hasKorean = /[가-힣]/.test(decodedText);
          const hasValidText = decodedText.length > 10 && !hasReplacementChars;
          if (!hasKorean && !hasValidText) {
            console.log(`⚠️ UTF-8-Non-Fatal: 한국어 텍스트 검증 실패`);
            continue;
          }
        }
        
        console.log(`✅ ${strategy.name} 인코딩으로 JSON 파싱 성공!`);
        return {
          success: true,
          data: jsonData,
          encoding: strategy.name,
          originalText: decodedText
        };
        
      } catch (error) {
        console.log(`❌ ${strategy.name} 실패:`, error instanceof Error ? error.message : String(error));
        continue;
      }
    }
    
    // 모든 전략 실패 - 마지막 시도: 깨진 텍스트라도 JSON 파싱 가능하면 허용
    console.log('🔄 모든 엄격한 검증 실패, 관대한 fallback 시도...');
    
    const fallbackStrategies = [
      { name: 'UTF-8-Lenient', decoder: () => new TextDecoder('utf-8', { fatal: false }).decode(buffer) },
      { name: 'ISO-8859-1-Lenient', decoder: () => new TextDecoder('iso-8859-1').decode(buffer) },
      { name: 'Latin1-Raw', decoder: () => Array.from(buffer).map(byte => String.fromCharCode(byte)).join('') }
    ];
    
    for (const strategy of fallbackStrategies) {
      try {
        console.log(`🔄 ${strategy.name} 관대한 시도 중...`);
        const decodedText = strategy.decoder();
        console.log(`📝 ${strategy.name} 결과: "${decodedText.substring(0, 50)}..."`);
        
        // JSON 파싱 시도 (검증 없이)
        const jsonData = JSON.parse(decodedText);
        
        console.log(`⚠️ ${strategy.name} 관대한 모드로 JSON 파싱 성공 (텍스트 깨짐 가능성 있음)`);
        return {
          success: true,
          data: jsonData,
          encoding: strategy.name + '-lenient',
          originalText: decodedText
        };
        
      } catch (error) {
        console.log(`❌ ${strategy.name} 관대한 시도도 실패:`, error instanceof Error ? error.message : String(error));
        continue;
      }
    }
    
    // 정말 모든 전략 실패
    const lastAttempt = Array.from(buffer).map(byte => String.fromCharCode(byte)).join('');
    return {
      success: false,
      error: '모든 인코딩 전략 실패 - JSON 파싱 불가능',
      encoding: 'failed',
      originalText: lastAttempt.substring(0, 200) + '...'
    };
  }

  /**
   * 일반 문자열에서 JSON 파싱 (기존 로직과 호환성)
   */
  static parseFromString<T = any>(text: string): SafeJsonResult<T> {
    try {
      const jsonData = JSON.parse(text);
      return {
        success: true,
        data: jsonData,
        encoding: 'string-input',
        originalText: text
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
        encoding: 'string-input',
        originalText: text
      };
    }
  }

  /**
   * Hono Context에서 안전한 JSON 파싱 (일반적인 사용 케이스)
   */
  static async safeJsonFromContext<T = any>(c: any): Promise<SafeJsonResult<T>> {
    try {
      console.log('🔍 바이너리 안전 JSON 파싱 시작...');
      
      // Content-Type 확인
      const contentType = c.req.header('Content-Type');
      if (!contentType?.includes('application/json')) {
        console.log('⚠️ Content-Type이 application/json이 아님:', contentType);
        return {
          success: false,
          error: 'Content-Type이 application/json이 아님'
        };
      }

      // Hono Request 객체에서 바이너리 데이터 획득
      const arrayBuffer = await c.req.arrayBuffer();
      const rawBuffer = new Uint8Array(arrayBuffer);
      
      console.log(`📦 바이너리 데이터 획득: ${rawBuffer.length} bytes`);
      
      // 바이너리 버퍼에서 JSON 파싱
      return this.parseFromBuffer<T>(rawBuffer);
      
    } catch (error) {
      console.error('❌ Hono Context JSON 파싱 실패:', error);
      
      // 폴백: 기존 Hono 방식 시도
      try {
        console.log('🔄 Hono 기본 파서로 폴백 시도...');
        const fallbackData = await c.req.json();
        console.log('✅ Hono 기본 파서로 폴백 성공');
        return {
          success: true,
          data: fallbackData,
          encoding: 'hono-fallback'
        };
      } catch (fallbackError) {
        console.error('❌ 폴백도 실패:', fallbackError);
        return {
          success: false,
          error: `모든 파싱 방법 실패: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  }
}

// 편의 함수들
export const safeBinaryJsonParse = SafeBinaryJsonParser.parseFromBuffer;
export const safeJsonFromRequest = SafeBinaryJsonParser.parseFromRequest;
export const safeJsonFromContext = SafeBinaryJsonParser.safeJsonFromContext;