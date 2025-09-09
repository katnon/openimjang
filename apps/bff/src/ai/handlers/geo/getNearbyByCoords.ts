import { getNearby } from '../../repo/geoRepo';

interface GetNearbyByCoordsParams {
  longitude: number;
  latitude: number;
  coordSystem?: string;
  radiusKm?: number;
  target?: string;
  limit?: number;
  sortBy?: string;
}

/**
 * 좌표 주변의 POI/아파트 검색 함수
 */
export async function getNearbyByCoords(args: GetNearbyByCoordsParams): Promise<any> {
  const { 
    longitude, 
    latitude, 
    coordSystem = 'EPSG:4326', 
    radiusKm = 1.0,
    target = 'apartment',
    limit = 10,
    sortBy = 'distance'
  } = args;

  try {
    console.log('🔍 주변 검색 요청:', { longitude, latitude, coordSystem, radiusKm, target, limit, sortBy });

    if (!longitude || !latitude) {
      return {
        success: false,
        error: '좌표 정보가 누락되었습니다. 경도와 위도를 모두 제공해주세요.'
      };
    }

    // 좌표 유효성 검사
    if (coordSystem === 'EPSG:4326' || coordSystem === 'WGS84') {
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return {
          success: false,
          error: 'WGS84 좌표계의 유효 범위를 벗어났습니다. (경도: -180~180, 위도: -90~90)'
        };
      }
    }

    // 검색 반경 유효성 검사
    if (radiusKm <= 0 || radiusKm > 50) {
      return {
        success: false,
        error: '검색 반경은 0km 초과 50km 이하여야 합니다.',
        suggestions: ['일반적으로 1-5km 반경이 적절합니다.']
      };
    }

    // 결과 개수 유효성 검사
    if (limit <= 0 || limit > 50) {
      return {
        success: false,
        error: '결과 개수는 1개 이상 50개 이하여야 합니다.'
      };
    }

    // geoRepo를 통해 주변 검색 수행
    const results = await getNearby(longitude, latitude, coordSystem, radiusKm, target, limit);

    // sortBy에 따른 정렬
    const sortedResults = sortResults(results, sortBy);

    return {
      success: true,
      searchConditions: {
        center: {
          longitude,
          latitude,
          coordSystem
        },
        radiusKm,
        target,
        limit,
        sortBy
      },
      results: sortedResults.map((item, index) => ({
        rank: index + 1,
        name: item.name,
        code: item.code,
        location: {
          longitude: item.longitude,
          latitude: item.latitude
        },
        distance: {
          km: item.distance,
          formatted: `${item.distance.toFixed(2)}km`
        },
        category: item.category,
        address: item.address,
        extraInfo: item.extraInfo
      })),
      summary: {
        totalCount: sortedResults.length,
        averageDistance: sortedResults.length > 0 
          ? (sortedResults.reduce((sum, r) => sum + r.distance, 0) / sortedResults.length).toFixed(2)
          : '0',
        searchRadius: `${radiusKm}km`,
        targetType: getTargetTypeDescription(target)
      },
      dataSchema: {
        distance: '직선 거리 (km)',
        location: '해당 POI의 좌표 (WGS84)',
        category: '카카오맵 카테고리',
        note: '결과는 API 제공업체의 데이터 기준'
      }
    };

  } catch (error: any) {
    console.error('❌ getNearbyByCoords 오류:', error);
    return {
      success: false,
      error: error.message || '주변 검색 중 오류가 발생했습니다.',
      searchConditions: {
        center: { longitude, latitude, coordSystem },
        radiusKm,
        target,
        limit,
        sortBy
      },
      suggestions: [
        '좌표가 대한민국 영역 내에 있는지 확인해보세요',
        '검색 반경을 조정해보세요 (1-5km 권장)',
        'target을 다른 값으로 변경해보세요 (apartment, school, hospital, mart, convenience)',
        '네트워크 연결 상태를 확인해보세요'
      ]
    };
  }
}

/**
 * 결과 정렬 함수
 */
function sortResults(results: any[], sortBy: string): any[] {
  const sortedResults = [...results];
  
  switch (sortBy) {
    case 'distance':
      return sortedResults.sort((a, b) => a.distance - b.distance);
    case 'name':
      return sortedResults.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    default:
      return sortedResults;
  }
}

/**
 * 타겟 타입 설명 반환
 */
function getTargetTypeDescription(target: string): string {
  const descriptions: { [key: string]: string } = {
    'apartment': '아파트/주상복합',
    'school': '학교/교육시설', 
    'hospital': '병원/의료시설',
    'mart': '대형마트/쇼핑시설',
    'convenience': '편의점/생활시설'
  };
  
  return descriptions[target] || target;
}