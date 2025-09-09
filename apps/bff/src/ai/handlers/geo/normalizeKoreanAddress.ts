import { geocode, reverseGeocode } from '../../repo/geoRepo';

interface NormalizeKoreanAddressParams {
  rawAddress: string;
  prefer?: 'road' | 'jibun' | 'both';
}

/**
 * 한국 주소 정규화 및 표준화 함수
 */
export async function normalizeKoreanAddress(args: NormalizeKoreanAddressParams): Promise<any> {
  const { rawAddress, prefer = 'both' } = args;

  try {
    console.log('📝 한국 주소 정규화 요청:', { rawAddress, prefer });

    if (!rawAddress || rawAddress.trim().length === 0) {
      return {
        success: false,
        error: '정규화할 주소가 제공되지 않았습니다.'
      };
    }

    const cleanedAddress = rawAddress.trim();

    // 1단계: 기본 주소 정제
    const preprocessed = preprocessAddress(cleanedAddress);

    // 2단계: 지오코딩을 통한 표준 주소 확인
    let standardizedAddress = null;
    let coordinates = null;
    
    try {
      const geocodeResult = await geocode(preprocessed.cleaned);
      coordinates = {
        longitude: geocodeResult.longitude,
        latitude: geocodeResult.latitude
      };

      // 3단계: 역지오코딩으로 표준 주소 획득
      const reverseResult = await reverseGeocode(
        geocodeResult.longitude,
        geocodeResult.latitude,
        'EPSG:4326',
        'both'
      );

      standardizedAddress = {
        roadAddress: reverseResult.roadAddress,
        jibunAddress: reverseResult.jibunAddress,
        administrativeArea: reverseResult.administrativeArea
      };

    } catch (error) {
      console.warn('지오코딩을 통한 표준화 실패:', error);
      // 지오코딩 실패시에도 전처리된 결과는 반환
    }

    // 4단계: 주소 컴포넌트 분석
    const components = analyzeAddressComponents(preprocessed.cleaned);

    // 5단계: 선호 형식에 따른 결과 구성
    const preferredAddress = getPreferredAddress(standardizedAddress, prefer);

    return {
      success: true,
      input: {
        rawAddress,
        prefer
      },
      preprocessing: {
        cleaned: preprocessed.cleaned,
        changes: preprocessed.changes,
        issues: preprocessed.issues
      },
      standardized: standardizedAddress ? {
        roadAddress: standardizedAddress.roadAddress,
        jibunAddress: standardizedAddress.jibunAddress,
        administrativeArea: standardizedAddress.administrativeArea,
        coordinates
      } : null,
      components,
      result: {
        preferred: preferredAddress,
        confidence: calculateConfidence(standardizedAddress, components),
        isStandardized: !!standardizedAddress,
        note: standardizedAddress 
          ? '지오코딩을 통해 표준화된 주소'
          : '패턴 분석을 통해 정제된 주소'
      },
      dataSchema: {
        roadAddress: '도로명 주소 (새주소)',
        jibunAddress: '지번 주소 (구주소)',
        components: '주소 구성요소 (시도/시군구/읍면동/번지 등)',
        confidence: '정규화 신뢰도 (0~1)',
        note: '표준화 = 공식 주소 DB 확인, 정제 = 형식 통일'
      },
      suggestions: standardizedAddress ? [] : [
        '정확한 시도명을 포함해 주세요 (서울특별시, 경기도 등)',
        '상세 주소 정보를 추가해 주세요 (구, 동, 번지)',
        '도로명 주소로 다시 입력해 보세요',
        '건물명이나 아파트명을 제거하고 기본 주소만 입력해 보세요'
      ]
    };

  } catch (error: any) {
    console.error('❌ normalizeKoreanAddress 오류:', error);
    return {
      success: false,
      error: error.message || '주소 정규화 중 오류가 발생했습니다.',
      input: { rawAddress, prefer },
      suggestions: [
        '주소 형식을 확인해 주세요 (예: 서울특별시 강남구 테헤란로 123)',
        '줄임말이나 별칭 대신 정식 주소명을 사용해 주세요',
        '특수문자나 불필요한 공백을 제거해 주세요'
      ]
    };
  }
}

/**
 * 주소 전처리 함수
 */
function preprocessAddress(address: string): {
  cleaned: string;
  changes: string[];
  issues: string[];
} {
  let cleaned = address;
  const changes: string[] = [];
  const issues: string[] = [];

  // 공백 정리
  if (cleaned !== cleaned.trim()) {
    changes.push('앞뒤 공백 제거');
    cleaned = cleaned.trim();
  }

  // 연속된 공백을 단일 공백으로
  if (/\s{2,}/.test(cleaned)) {
    changes.push('연속 공백을 단일 공백으로 변경');
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  // 특수문자 정리
  const specialChars = /[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ0-9\-\.]/g;
  if (specialChars.test(cleaned)) {
    changes.push('특수문자 제거');
    cleaned = cleaned.replace(specialChars, '');
  }

  // 자주 사용되는 줄임말 확장
  const abbreviations = {
    '서울': '서울특별시',
    '부산': '부산광역시', 
    '대구': '대구광역시',
    '인천': '인천광역시',
    '광주': '광주광역시',
    '대전': '대전광역시',
    '울산': '울산광역시',
    '경기': '경기도',
    '강원': '강원도',
    '충북': '충청북도',
    '충남': '충청남도',
    '전북': '전라북도',
    '전남': '전라남도',
    '경북': '경상북도',
    '경남': '경상남도',
    '제주': '제주특별자치도'
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    if (cleaned.startsWith(abbr + ' ')) {
      changes.push(`"${abbr}" → "${full}"`);
      cleaned = cleaned.replace(abbr + ' ', full + ' ');
      break;
    }
  }

  // 잠재적 문제 탐지
  if (cleaned.length < 10) {
    issues.push('주소가 너무 짧습니다. 상세 정보를 추가해 주세요.');
  }

  if (!/특별시|광역시|도/.test(cleaned)) {
    issues.push('시도 정보가 명확하지 않습니다.');
  }

  if (!/구|군|시/.test(cleaned)) {
    issues.push('시군구 정보가 명확하지 않습니다.');
  }

  return { cleaned, changes, issues };
}

/**
 * 주소 구성요소 분석
 */
function analyzeAddressComponents(address: string): any {
  const components: any = {};

  // 시도 추출
  const sidoPattern = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)/;
  const sidoMatch = address.match(sidoPattern);
  if (sidoMatch) {
    components.sido = sidoMatch[1];
  }

  // 시군구 추출 (대략적 패턴)
  const sigunguPattern = /([가-힣]+구|[가-힣]+군|[가-힣]+시)/;
  const sigunguMatch = address.replace(components.sido || '', '').match(sigunguPattern);
  if (sigunguMatch) {
    components.sigungu = sigunguMatch[1];
  }

  // 읍면동 추출 (대략적 패턴)
  const dongPattern = /([가-힣0-9]+동|[가-힣]+읍|[가-힣]+면)/;
  const dongMatch = address.replace((components.sido || '') + ' ' + (components.sigungu || ''), '').match(dongPattern);
  if (dongMatch) {
    components.dong = dongMatch[1];
  }

  // 도로명/지번 추출 (대략적 패턴)
  const roadPattern = /([가-힣0-9]+로|[가-힣0-9]+길)/;
  const roadMatch = address.match(roadPattern);
  if (roadMatch) {
    components.road = roadMatch[1];
    components.type = 'road';
  } else if (/\d+(-\d+)?/.test(address)) {
    components.type = 'jibun';
    const jibunMatch = address.match(/(\d+(-\d+)?)/);
    if (jibunMatch) {
      components.jibun = jibunMatch[1];
    }
  }

  return components;
}

/**
 * 선호 주소 형식 반환
 */
function getPreferredAddress(standardized: any, prefer: string): string | null {
  if (!standardized) return null;

  switch (prefer) {
    case 'road':
      return standardized.roadAddress;
    case 'jibun':
      return standardized.jibunAddress;
    case 'both':
    default:
      return standardized.roadAddress || standardized.jibunAddress;
  }
}

/**
 * 정규화 신뢰도 계산
 */
function calculateConfidence(standardized: any, components: any): number {
  let score = 0;

  // 표준화 성공시 기본 점수
  if (standardized) {
    score += 0.6;
  }

  // 구성요소 완성도
  if (components.sido) score += 0.1;
  if (components.sigungu) score += 0.1;
  if (components.dong) score += 0.1;
  if (components.road || components.jibun) score += 0.1;

  return Math.min(score, 1.0);
}