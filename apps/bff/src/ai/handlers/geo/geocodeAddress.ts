import { geocode } from '../../repo/geoRepo';

interface GeocodeAddressParams {
  address: string;
  coordinateSystem?: string;
  addressType?: string;
}

/**
 * 주소를 좌표로 변환하는 지오코딩 함수
 */
export async function geocodeAddress(args: GeocodeAddressParams): Promise<any> {
  const { 
    address, 
    coordinateSystem = 'EPSG:4326', 
    addressType = 'road' 
  } = args;

  try {
    console.log('🌍 주소→좌표 변환 요청:', { address, coordinateSystem, addressType });

    if (!address || address.trim().length === 0) {
      return {
        success: false,
        error: '주소가 제공되지 않았습니다.'
      };
    }

    // geoRepo를 통해 지오코딩 수행
    const result = await geocode(address, coordinateSystem);

    return {
      success: true,
      searchConditions: {
        address,
        coordinateSystem,
        addressType
      },
      coordinates: {
        longitude: result.longitude,
        latitude: result.latitude,
        coordSystem: result.coordSystem
      },
      metadata: {
        originalAddress: result.address,
        confidence: result.confidence,
        source: result.source,
        note: `${coordinateSystem} 좌표계로 변환됨`
      },
      dataSchema: {
        longitude: '경도 (X 좌표)',
        latitude: '위도 (Y 좌표)', 
        coordSystem: '좌표계 (EPSG 코드)',
        confidence: '정확도 (0~1)',
        note: 'WGS84는 일반적인 GPS 좌표계'
      }
    };

  } catch (error: any) {
    console.error('❌ geocodeAddress 오류:', error);
    return {
      success: false,
      error: error.message || '주소를 좌표로 변환하는 중 오류가 발생했습니다.',
      searchConditions: {
        address,
        coordinateSystem,
        addressType
      },
      suggestions: [
        '정확한 도로명 주소를 입력해보세요 (예: 서울특별시 강남구 테헤란로 123)',
        '지번 주소로 시도해보세요 (예: 서울특별시 강남구 역삼동 123-45)',
        '시/도, 시/군/구 정보를 포함해서 입력해보세요'
      ]
    };
  }
}