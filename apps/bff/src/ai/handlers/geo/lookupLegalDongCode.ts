import { lookupLegalDongCode } from '../../repo/geoRepo';

interface LookupLegalDongCodeParams {
  address?: string;
  longitude?: number;
  latitude?: number;
  coordSystem?: string;
}

/**
 * 법정동 코드를 조회하는 함수
 */
export async function lookupLegalDongCode(args: LookupLegalDongCodeParams): Promise<any> {
  const { 
    address, 
    longitude, 
    latitude, 
    coordSystem = 'EPSG:4326' 
  } = args;

  try {
    console.log('📋 법정동 코드 조회 요청:', { address, longitude, latitude, coordSystem });

    // 입력 파라미터 유효성 검사
    if (!address && (!longitude || !latitude)) {
      return {
        success: false,
        error: '주소 또는 좌표 중 하나는 반드시 제공되어야 합니다.',
        suggestions: [
          '주소로 조회: address 파라미터에 "서울특별시 강남구 역삼동" 같은 주소 입력',
          '좌표로 조회: longitude, latitude 파라미터에 좌표값 입력'
        ]
      };
    }

    if (address && address.trim().length === 0) {
      return {
        success: false,
        error: '빈 주소는 조회할 수 없습니다.'
      };
    }

    if (longitude !== undefined && latitude !== undefined) {
      // 좌표 범위 검사 (WGS84 기준)
      if (coordSystem === 'EPSG:4326' || coordSystem === 'WGS84') {
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          return {
            success: false,
            error: 'WGS84 좌표계의 유효 범위를 벗어났습니다. (경도: -180~180, 위도: -90~90)'
          };
        }
      }
    }

    // geoRepo를 통해 법정동 코드 조회
    const result = await lookupLegalDongCode(address, longitude, latitude, coordSystem);

    return {
      success: true,
      searchConditions: {
        inputType: address ? 'address' : 'coordinates',
        address,
        coordinates: longitude && latitude ? {
          longitude,
          latitude,
          coordSystem
        } : undefined
      },
      legalDongInfo: {
        code: result.code,
        name: result.name,
        address: result.address,
        level: result.level
      },
      metadata: {
        note: '법정동 코드는 행정안전부 표준 코드',
        codeFormat: '시도(2자리) + 시군구(3자리) + 읍면동(3자리) + 리(2자리) + 예비(2자리)',
        example: '1168010100 = 서울특별시(11) + 강남구(680) + 역삼1동(101) + 전체리(00) + 예비(00)'
      },
      dataSchema: {
        code: '법정동 코드 (12자리)',
        name: '법정동명',
        address: '상세 주소',
        level: '행정 단계 (시군구/읍면동/리)',
        note: '법정동 = 「지방자치법」상 법정 행정구역'
      }
    };

  } catch (error: any) {
    console.error('❌ lookupLegalDongCode 오류:', error);
    return {
      success: false,
      error: error.message || '법정동 코드 조회 중 오류가 발생했습니다.',
      searchConditions: {
        inputType: address ? 'address' : 'coordinates',
        address,
        coordinates: longitude && latitude ? {
          longitude,
          latitude,
          coordSystem
        } : undefined
      },
      suggestions: [
        '정확한 행정구역명을 입력해보세요 (예: 서울특별시 강남구 역삼동)',
        '시/도 + 시/군/구 + 읍/면/동 형태로 입력해보세요',
        '좌표로 조회하는 경우 대한민국 영역 내의 좌표인지 확인해보세요',
        '구 주소나 통폐합된 행정구역은 조회되지 않을 수 있습니다'
      ]
    };
  }
}