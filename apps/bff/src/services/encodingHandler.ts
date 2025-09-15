// 🔧 OpenImjang - 다중 인코딩 처리 시스템
// UTF-8 인코딩 문제 해결을 위한 바이너리 재조합 및 다중 인코딩 지원

import iconv from 'iconv-lite';

export interface EncodingResult {
  decodedText: string;
  encoding: string;
  confidence: number;
  success: boolean;
  originalBytes?: Buffer;
}

export interface EncodingAttempt {
  encoding: string;
  priority: number;
  description: string;
}

/**
 * 다중 인코딩 처리 및 바이너리 재조합 시스템
 * 2.0 시스템의 바이너리 변환 방식을 참고하여 구현
 */
export class EncodingHandler {
  private static readonly SUPPORTED_ENCODINGS: EncodingAttempt[] = [
    { encoding: 'utf8', priority: 1, description: 'UTF-8 (기본)' },
    { encoding: 'euc-kr', priority: 2, description: 'EUC-KR (한국어 레거시)' },
    { encoding: 'cp949', priority: 3, description: 'CP949 (Windows 한국어)' },
    { encoding: 'iso-8859-1', priority: 4, description: 'ISO-8859-1 (Latin-1)' },
    { encoding: 'ascii', priority: 5, description: 'ASCII' }
  ];

  /**
   * 텍스트가 깨진 인코딩인지 감지
   */
  private static isCorruptedText(text: string): boolean {
    // Windows curl에서 발생하는 특정 패턴들 우선 체크
    const windowsCorruptionPatterns = [
      /[��]{2,}/g,  // Windows에서 흔히 발생하는 연속된 물음표들
      /\?{3,}/g,    // 연속된 물음표 (한글이 ?로 변환됨)
      /[\x80-\xFF]{3,}/g, // 높은 ASCII 값의 연속 (바이트 깨짐)
    ];
    
    // 일반적인 인코딩 깨짐 패턴들
    const generalCorruptionPatterns = [
      /�{2,}/g, // 연속된 replacement characters
      /[\uFFFD]/g, // Unicode replacement character
      /[^\x20-\x7E\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF\u3040-\u309F\u30A0-\u30FF]/g // 일반적이지 않은 문자들
    ];

    const allPatterns = [...windowsCorruptionPatterns, ...generalCorruptionPatterns];
    const isCorrupted = allPatterns.some(pattern => pattern.test(text));
    
    // 추가 검증: 한글 문자가 전혀 없고 특수 바이트만 있는 경우
    const hasKorean = /[가-힣]/.test(text);
    const hasHighBytes = /[\x80-\xFF]/.test(text);
    const onlyHighBytes = hasHighBytes && !hasKorean && !/[a-zA-Z0-9\s]/.test(text);
    
    return isCorrupted || onlyHighBytes;
  }

  /**
   * 텍스트를 바이너리로 변환 (2.0 시스템 방식)
   */
  private static textToBuffer(text: string): Buffer {
    try {
      // Windows curl에서 발생하는 특별한 패턴 처리
      const methods = [
        // Method 1: UTF-8 바이트 배열로 직접 변환
        () => {
          const bytes = [];
          for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            if (charCode < 128) {
              bytes.push(charCode);
            } else {
              // 2바이트 이상의 UTF-8 처리
              const utf8Bytes = Buffer.from(text[i], 'utf8');
              bytes.push(...utf8Bytes);
            }
          }
          return Buffer.from(bytes);
        },
        
        // Method 2: Latin1 인코딩으로 원본 바이트 복원
        () => Buffer.from(text, 'latin1'),
        
        // Method 3: Binary로 직접 변환
        () => Buffer.from(text, 'binary'),
        
        // Method 4: 각 문자를 바이트값으로 변환
        () => Buffer.from(Array.from(text).map(char => char.charCodeAt(0) & 0xFF)),
        
        // Method 5: UTF-8 기본값
        () => Buffer.from(text, 'utf8'),
      ];

      for (const [index, method] of methods.entries()) {
        try {
          const buffer = method();
          if (buffer.length > 0) {
            console.log(`📦 바이너리 변환 성공 (Method ${index + 1}): ${buffer.length} bytes`);
            return buffer;
          }
        } catch (e) {
          console.warn(`📦 바이너리 변환 Method ${index + 1} 실패:`, e);
          continue;
        }
      }

      return Buffer.from(text, 'utf8');
    } catch (error) {
      console.warn('📦 바이너리 변환 실패, UTF-8 기본값 사용:', error);
      return Buffer.from(text, 'utf8');
    }
  }

  /**
   * 다중 인코딩으로 디코딩 시도
   */
  private static attemptMultipleEncodings(buffer: Buffer): EncodingResult {
    const results: EncodingResult[] = [];

    for (const { encoding, description } of this.SUPPORTED_ENCODINGS) {
      try {
        let decodedText: string;

        if (encoding === 'utf8') {
          decodedText = buffer.toString('utf8');
        } else {
          decodedText = iconv.decode(buffer, encoding);
        }

        const confidence = this.calculateConfidence(decodedText, encoding);
        const isCorrupted = this.isCorruptedText(decodedText);

        results.push({
          decodedText,
          encoding,
          confidence: isCorrupted ? 0 : confidence,
          success: !isCorrupted && confidence > 0.5,
          originalBytes: buffer
        });

        console.log(`🔍 ${description} 인코딩 시도: 신뢰도 ${confidence.toFixed(2)}, 손상됨: ${isCorrupted}`);

      } catch (error) {
        console.warn(`❌ ${description} 인코딩 실패:`, error);
        results.push({
          decodedText: '',
          encoding,
          confidence: 0,
          success: false,
          originalBytes: buffer
        });
      }
    }

    // 가장 높은 신뢰도를 가진 결과 반환
    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    console.log(`✅ 최적 인코딩 선택: ${bestResult.encoding} (신뢰도: ${bestResult.confidence.toFixed(2)})`);
    return bestResult;
  }

  /**
   * 인코딩 신뢰도 계산
   */
  private static calculateConfidence(text: string, encoding: string): number {
    if (!text || text.length === 0) return 0;

    let score = 0.5; // 기본 점수

    // 한글 문자 비율 (한국어 텍스트일 가능성)
    const koreanChars = text.match(/[가-힣]/g);
    const koreanRatio = koreanChars ? koreanChars.length / text.length : 0;

    // 영문/숫자 문자 비율
    const englishChars = text.match(/[a-zA-Z0-9\s]/g);
    const englishRatio = englishChars ? englishChars.length / text.length : 0;

    // 인코딩별 가중치 적용
    switch (encoding) {
      case 'utf8':
        score += koreanRatio * 0.4 + englishRatio * 0.2;
        break;
      case 'euc-kr':
      case 'cp949':
        score += koreanRatio * 0.5; // 한글이 많을수록 높은 점수
        break;
      case 'ascii':
        score += englishRatio * 0.3;
        break;
    }

    // 특수 문자 패널티
    const specialChars = text.match(/[^\w\s가-힣]/g);
    const specialRatio = specialChars ? specialChars.length / text.length : 0;
    if (specialRatio > 0.3) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 메인 인코딩 처리 함수
   */
  static processText(input: string): EncodingResult {
    console.log(`🔧 인코딩 처리 시작: "${input.substring(0, 50)}..."`);

    // 1. 이미 올바른 텍스트인지 확인
    if (!this.isCorruptedText(input)) {
      console.log('✅ 텍스트가 이미 올바른 인코딩입니다.');
      return {
        decodedText: input,
        encoding: 'utf8',
        confidence: 1.0,
        success: true
      };
    }

    console.log('🔍 인코딩 문제 감지, 바이너리 재조합 시작...');

    // 2. 바이너리로 변환 (2.0 시스템 방식)
    const buffer = this.textToBuffer(input);
    console.log(`📦 바이너리 변환 완료: ${buffer.length} bytes`);

    // 3. 다중 인코딩으로 재조합 시도
    const result = this.attemptMultipleEncodings(buffer);

    console.log(`🎯 인코딩 처리 완료: ${result.success ? '성공' : '실패'} (${result.encoding})`);
    return result;
  }

  /**
   * 간편한 텍스트 복구 함수
   */
  static recoverText(corruptedText: string): string {
    const result = this.processText(corruptedText);
    return result.success ? result.decodedText : corruptedText;
  }
}