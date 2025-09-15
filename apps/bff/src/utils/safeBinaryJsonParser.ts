// apps/bff/src/utils/safeBinaryJsonParser.ts
interface ParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  encoding?: string;
  originalLength?: number;
  parsedLength?: number;
}

interface EncodingStrategy {
  name: string;
  decode: (buffer: Buffer) => string;
  fallbackMode?: boolean;
}

export class SafeBinaryJsonParser {
  private readonly encodingStrategies: EncodingStrategy[] = [
    // 1순위: UTF-8 (기본)
    {
      name: 'utf8',
      decode: (buffer: Buffer) => buffer.toString('utf8'),
    },
    
    // 2순위: EUC-KR (한국어 웹사이트 인코딩)
    {
      name: 'euc-kr',
      decode: (buffer: Buffer) => {
        // Node.js에서 EUC-KR은 직접 지원하지 않으므로 
        // Latin1로 읽고 수동 변환 시도
        const latin1 = buffer.toString('latin1');
        return this.attemptEucKrConversion(latin1);
      },
    },
    
    // 3순위: CP949 (Windows 한국어)
    {
      name: 'cp949',
      decode: (buffer: Buffer) => {
        // CP949도 Latin1로 읽고 변환 시도
        const latin1 = buffer.toString('latin1');
        return this.attemptCp949Conversion(latin1);
      },
    },
    
    // 4순위: ISO-8859-1 (Latin1)
    {
      name: 'latin1',
      decode: (buffer: Buffer) => buffer.toString('latin1'),
    },
    
    // 5순위: ASCII (기본 안전장치)
    {
      name: 'ascii',
      decode: (buffer: Buffer) => buffer.toString('ascii'),
    },
    
    // 6순위: Fallback 모드 (부분 복구 시도)
    {
      name: 'utf8-fallback',
      decode: (buffer: Buffer) => this.attemptUtf8Fallback(buffer),
      fallbackMode: true,
    },
  ];

  private attemptEucKrConversion(latin1: string): string {
    // EUC-KR 변환 시도 (간단한 휴리스틱)
    // 실제 프로덕션에서는 iconv-lite 같은 라이브러리 사용 권장
    try {
      // Latin1에서 한글 범위 바이트 패턴 감지 시도
      const bytes = Buffer.from(latin1, 'latin1');
      
      // EUC-KR 한글 범위: 0xA1A1~0xFEFE
      let hasKoreanPattern = false;
      for (let i = 0; i < bytes.length - 1; i++) {
        const b1 = bytes[i];
        const b2 = bytes[i + 1];
        if (b1 >= 0xA1 && b1 <= 0xFE && b2 >= 0xA1 && b2 <= 0xFE) {
          hasKoreanPattern = true;
          break;
        }
      }
      
      if (hasKoreanPattern) {
        // 간단한 EUC-KR → UTF-8 변환 시도
        // (실제로는 완전한 변환 테이블이 필요)
        return this.simpleEucKrToUtf8(bytes);
      }
      
      return latin1;
    } catch (error) {
      return latin1;
    }
  }

  private attemptCp949Conversion(latin1: string): string {
    // CP949 변환 시도 (EUC-KR의 확장)
    // 실제로는 더 복잡한 로직 필요
    return this.attemptEucKrConversion(latin1);
  }

  private simpleEucKrToUtf8(bytes: Buffer): string {
    // 매우 간단한 EUC-KR → UTF-8 변환 시도
    // 실제 프로덕션에서는 완전한 변환 테이블 필요
    try {
      let result = '';
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        
        // ASCII 범위는 그대로
        if (byte < 0x80) {
          result += String.fromCharCode(byte);
        } else if (i < bytes.length - 1) {
          // 한글 시도 (매우 제한적)
          const next = bytes[i + 1];
          if (byte >= 0xA1 && byte <= 0xFE && next >= 0xA1 && next <= 0xFE) {
            // 실제 한글 변환은 매우 복잡하므로 대체 문자 사용
            result += '한'; // 임시 대체
            i++; // 다음 바이트 건너뛰기
          } else {
            result += String.fromCharCode(byte);
          }
        } else {
          result += String.fromCharCode(byte);
        }
      }
      return result;
    } catch (error) {
      return bytes.toString('latin1');
    }
  }

  private attemptUtf8Fallback(buffer: Buffer): string {
    // UTF-8 Fallback: 깨진 바이트를 대체 문자로 변환
    try {
      let result = '';
      let i = 0;
      
      while (i < buffer.length) {
        const byte = buffer[i];
        
        // ASCII 범위 (0x00-0x7F)
        if (byte < 0x80) {
          result += String.fromCharCode(byte);
          i++;
        }
        // UTF-8 2바이트 (0xC0-0xDF)
        else if ((byte & 0xE0) === 0xC0 && i + 1 < buffer.length) {
          const byte2 = buffer[i + 1];
          if ((byte2 & 0xC0) === 0x80) {
            try {
              const char = Buffer.from([byte, byte2]).toString('utf8');
              result += char;
              i += 2;
            } catch {
              result += '�'; // 대체 문자
              i++;
            }
          } else {
            result += '�';
            i++;
          }
        }
        // UTF-8 3바이트 (0xE0-0xEF) - 한글 포함
        else if ((byte & 0xF0) === 0xE0 && i + 2 < buffer.length) {
          const byte2 = buffer[i + 1];
          const byte3 = buffer[i + 2];
          if ((byte2 & 0xC0) === 0x80 && (byte3 & 0xC0) === 0x80) {
            try {
              const char = Buffer.from([byte, byte2, byte3]).toString('utf8');
              result += char;
              i += 3;
            } catch {
              result += '�';
              i++;
            }
          } else {
            result += '�';
            i++;
          }
        }
        // UTF-8 4바이트 (0xF0-0xF7)
        else if ((byte & 0xF8) === 0xF0 && i + 3 < buffer.length) {
          const byte2 = buffer[i + 1];
          const byte3 = buffer[i + 2];
          const byte4 = buffer[i + 3];
          if ((byte2 & 0xC0) === 0x80 && (byte3 & 0xC0) === 0x80 && (byte4 & 0xC0) === 0x80) {
            try {
              const char = Buffer.from([byte, byte2, byte3, byte4]).toString('utf8');
              result += char;
              i += 4;
            } catch {
              result += '�';
              i++;
            }
          } else {
            result += '�';
            i++;
          }
        }
        // 인식할 수 없는 바이트
        else {
          result += '�';
          i++;
        }
      }
      
      return result;
    } catch (error) {
      return buffer.toString('utf8', 0, Math.min(buffer.length, 1000)) + '...';
    }
  }

  private isValidJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  private hasKoreanText(text: string): boolean {
    // 한글 유니코드 범위: 0xAC00-0xD7AF (가-힣)
    const koreanRegex = /[\uAC00-\uD7AF]/;
    return koreanRegex.test(text);
  }

  private estimateEncodingQuality(text: string): number {
    let score = 0;
    
    // 한글이 정상적으로 보이는지 확인
    if (this.hasKoreanText(text)) {
      score += 30;
    }
    
    // 깨진 문자(대체 문자) 패널티
    const brokenCharCount = (text.match(/[�]/g) || []).length;
    score -= brokenCharCount * 10;
    
    // 특수 깨진 패턴 패널티
    const brokenPatterns = [
      /[��]+/g,           // 연속된 깨진 문자
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // 제어 문자
      /\\u[0-9a-fA-F]{4}/g, // 이스케이프된 유니코드
    ];
    
    brokenPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      score -= matches.length * 5;
    });
    
    // ASCII 문자 보너스
    const asciiRatio = (text.match(/[\x20-\x7E]/g) || []).length / text.length;
    score += asciiRatio * 10;
    
    return Math.max(0, score);
  }

  parseFromBuffer<T = any>(buffer: Buffer): ParseResult<T> {
    const originalLength = buffer.length;
    console.log(`🔍 SafeBinaryJsonParser: ${originalLength}바이트 데이터 파싱 시작`);
    
    const results: Array<ParseResult<T> & { strategy: string; quality: number }> = [];
    
    // 각 인코딩 전략 시도
    for (const strategy of this.encodingStrategies) {
      try {
        console.log(`🧪 인코딩 전략 시도: ${strategy.name}`);
        
        const decodedText = strategy.decode(buffer);
        const parsedLength = decodedText.length;
        
        // JSON 유효성 검사
        if (this.isValidJson(decodedText)) {
          const parsedData = JSON.parse(decodedText);
          const quality = this.estimateEncodingQuality(decodedText);
          
          console.log(`✅ ${strategy.name}: JSON 파싱 성공 (품질점수: ${quality})`);
          
          results.push({
            success: true,
            data: parsedData,
            encoding: strategy.name,
            originalLength,
            parsedLength,
            strategy: strategy.name,
            quality,
          });
          
          // Fallback 모드가 아니고 품질이 좋으면 즉시 반환
          if (!strategy.fallbackMode && quality > 50) {
            console.log(`🎯 고품질 결과로 즉시 반환: ${strategy.name}`);
            return results[results.length - 1];
          }
        } else {
          console.log(`❌ ${strategy.name}: JSON 파싱 실패`);
        }
      } catch (error) {
        console.log(`💥 ${strategy.name}: 디코딩 오류 -`, (error as Error).message);
      }
    }
    
    // 결과가 있다면 가장 품질 좋은 것 선택
    if (results.length > 0) {
      results.sort((a, b) => b.quality - a.quality);
      const best = results[0];
      
      console.log(`🏆 최고 품질 결과 선택: ${best.strategy} (점수: ${best.quality})`);
      console.log(`📊 총 ${results.length}개 전략 중 성공한 것들:`, 
        results.map(r => `${r.strategy}(${r.quality})`).join(', '));
      
      return {
        success: best.success,
        data: best.data,
        encoding: best.encoding,
        originalLength: best.originalLength,
        parsedLength: best.parsedLength,
      };
    }
    
    // 모든 전략 실패
    console.error('💀 모든 인코딩 전략 실패');
    console.error('📄 Raw buffer preview:', buffer.subarray(0, 100).toString('hex'));
    
    return {
      success: false,
      error: `모든 인코딩 전략 실패 (${this.encodingStrategies.length}개 시도)`,
      originalLength,
      parsedLength: 0,
    };
  }

  parseFromString<T = any>(text: string): ParseResult<T> {
    try {
      if (this.isValidJson(text)) {
        const parsedData = JSON.parse(text);
        const quality = this.estimateEncodingQuality(text);
        
        return {
          success: true,
          data: parsedData,
          encoding: 'string-input',
          originalLength: text.length,
          parsedLength: text.length,
        };
      } else {
        return {
          success: false,
          error: 'Invalid JSON format',
          originalLength: text.length,
          parsedLength: text.length,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `JSON 파싱 오류: ${(error as Error).message}`,
        originalLength: text.length,
        parsedLength: text.length,
      };
    }
  }

  // 디버깅을 위한 인코딩 분석 정보
  analyzeBuffer(buffer: Buffer): {
    size: number;
    hasNullBytes: boolean;
    hasBinaryData: boolean;
    possibleEncodings: string[];
    preview: string;
  } {
    const hasNullBytes = buffer.includes(0);
    
    // 바이너리 데이터 감지 (제어 문자가 많은지 확인)
    let controlCharCount = 0;
    for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
      const byte = buffer[i];
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlCharCount++;
      }
    }
    const hasBinaryData = controlCharCount > buffer.length * 0.1;
    
    // 가능한 인코딩 추측
    const possibleEncodings: string[] = [];
    
    // UTF-8 BOM 확인
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      possibleEncodings.push('utf8-bom');
    }
    
    // UTF-16 BOM 확인
    if (buffer.length >= 2) {
      if ((buffer[0] === 0xFF && buffer[1] === 0xFE) || (buffer[0] === 0xFE && buffer[1] === 0xFF)) {
        possibleEncodings.push('utf16');
      }
    }
    
    // ASCII 확인
    if (buffer.every(byte => byte < 128)) {
      possibleEncodings.push('ascii');
    }
    
    // UTF-8 패턴 확인
    try {
      buffer.toString('utf8');
      possibleEncodings.push('utf8');
    } catch {
      // UTF-8로 변환 실패
    }
    
    // EUC-KR 패턴 확인 (간단한 휴리스틱)
    let hasEucKrPattern = false;
    for (let i = 0; i < buffer.length - 1; i++) {
      const b1 = buffer[i];
      const b2 = buffer[i + 1];
      if (b1 >= 0xA1 && b1 <= 0xFE && b2 >= 0xA1 && b2 <= 0xFE) {
        hasEucKrPattern = true;
        break;
      }
    }
    if (hasEucKrPattern) {
      possibleEncodings.push('euc-kr');
    }
    
    const preview = buffer.subarray(0, 200).toString('utf8', 0, 200).replace(/\0/g, '\\0');
    
    return {
      size: buffer.length,
      hasNullBytes,
      hasBinaryData,
      possibleEncodings,
      preview,
    };
  }
}