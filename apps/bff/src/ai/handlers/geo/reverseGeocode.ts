import { reverseGeocode } from '../../repo/geoRepo';

interface ReverseGeocodeParams {
  lat: number;
  lng: number;
  coordinateSystem?: string;
  addressFormat?: string;
}

/**
 * 좌표를 주소로 변환하는 역지오코딩 함수
 */
export async function reverseGeocode(args: ReverseGeocodeParams): Promise<any> {
  const { 
    lat, 
    lng, 
    coordinateSystem = 'WGS84', 
    addressFormat = '전체' 
  } = args;

  try {
    console.log('🔄 좌표→주소 변환 요청:', { lat, lng, coordinateSystem, addressFormat });

    if (!lat || !lng) {
      return {
        success: false,
        error: '좌표 정보가 누락되었습니다. 경도와 위도를 모두 제공해주세요.'
      };
    }

    // 좌표 유효성 검사
    if (coordinateSystem === 'WGS84') {
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return {
          success: false,
          error: 'WGS84 좌표계의 유효 범위를 벗어났습니다. (경도: -180~180, 위도: -90~90)'
        };
      }
    }

    // 좌표계를 EPSG 형식으로 변환
    const coordSystemMap: { [key: string]: string } = {
      'WGS84': 'EPSG:4326',
      'GRS80': 'EPSG:5179', 
      'KATEC': 'KATECH',
      'TM': 'EPSG:5174'
    };
    const epsgCoordSystem = coordSystemMap[coordinateSystem] || 'EPSG:4326';

    // geoRepo를 통해 역지오코딩 수행
    const result = await reverseGeocode(lng, lat, epsgCoordSystem, addressFormat);

    const addresses: any = {};
    
    if (addressFormat === '도로명' || addressFormat === '전체') {
      addresses.roadAddress = result.roadAddress;
    }
    
    if (addressFormat === '지번' || addressFormat === '전체') {
      addresses.jibunAddress = result.jibunAddress;
    }

    return {
      success: true,
      searchConditions: {
        coordinates: {
          longitude: lng,
          latitude: lat,
          coordinateSystem
        },
        addressFormat
      },
      addresses,
      administrativeInfo: {
        region: result.administrativeArea,
        confidence: result.confidence
      },
      metadata: {
        source: result.source,
        note: `${coordinateSystem} 좌표계에서 변환됨`
      },
      dataSchema: {
        roadAddress: '도로명 주소',
        jibunAddress: '지번 주소',
        region: '행정구역 (시도 시군구)',
        confidence: '정확도 (0~1)',
        note: '두 주소 형태 중 사용 가능한 것만 반환됨'
      }
    };

  } catch (error: any) {
    console.error('❌ reverseGeocode 오류:', error);
    return {
      success: false,
      error: error.message || '좌표를 주소로 변환하는 중 오류가 발생했습니다.',
      searchConditions: {
        coordinates: {
          longitude: lng,
          latitude: lat,
          coordinateSystem
        },
        addressFormat
      },
      suggestions: [
        '좌표가 대한민국 영역 내에 있는지 확인해보세요',
        '좌표계가 올바르게 설정되었는지 확인해보세요 (EPSG:4326, EPSG:3857 등)',
        '소수점 자리수를 충분히 제공해보세요 (예: 127.123456)'
      ]
    };
  }
}