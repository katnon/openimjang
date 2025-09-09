import { transformCoordinates } from '../../repo/geoRepo';

interface TransformCoordinatesParams {
  fromCrs: string;
  toCrs: string;
  points: Array<{ longitude: number; latitude: number }>;
}

/**
 * 좌표계 변환 함수
 */
export async function transformCoordinates(args: TransformCoordinatesParams): Promise<any> {
  const { fromCrs, toCrs, points } = args;

  try {
    console.log('🔄 좌표계 변환 요청:', { fromCrs, toCrs, pointCount: points?.length });

    if (!fromCrs || !toCrs) {
      return {
        success: false,
        error: 'fromCrs와 toCrs 파라미터가 필요합니다.',
        supportedCrs: [
          'EPSG:4326 (WGS84)',
          'EPSG:3857 (Web Mercator)', 
          'EPSG:5179 (Korean 2000)',
          'EPSG:5174 (Korean 1985)',
          'KATECH (Korean TM)'
        ]
      };
    }

    if (!points || !Array.isArray(points) || points.length === 0) {
      return {
        success: false,
        error: '변환할 좌표 배열이 제공되지 않았습니다.',
        example: {
          points: [
            { longitude: 127.123456, latitude: 37.654321 },
            { longitude: 127.987654, latitude: 37.123456 }
          ]
        }
      };
    }

    if (points.length > 1000) {
      return {
        success: false,
        error: '한 번에 변환할 수 있는 최대 좌표 개수는 1000개입니다.',
        currentCount: points.length
      };
    }

    // 각 좌표점 유효성 검사
    const invalidPoints = [];
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point || typeof point.longitude !== 'number' || typeof point.latitude !== 'number') {
        invalidPoints.push(i);
      }
    }

    if (invalidPoints.length > 0) {
      return {
        success: false,
        error: `유효하지 않은 좌표점이 있습니다.`,
        invalidIndices: invalidPoints,
        note: '각 좌표점은 { longitude: number, latitude: number } 형태여야 합니다.'
      };
    }

    // 좌표계 변환 수행
    const transformedPoints = [];
    const errors = [];

    for (let i = 0; i < points.length; i++) {
      try {
        const point = points[i];
        const transformed = transformCoordinates(
          point.longitude, 
          point.latitude, 
          fromCrs, 
          toCrs
        );
        
        transformedPoints.push({
          original: point,
          transformed: {
            longitude: transformed.longitude,
            latitude: transformed.latitude
          },
          index: i
        });
      } catch (error: any) {
        errors.push({
          index: i,
          point: points[i],
          error: error.message
        });
      }
    }

    const result = {
      success: true,
      transformation: {
        fromCrs,
        toCrs,
        totalPoints: points.length,
        successCount: transformedPoints.length,
        errorCount: errors.length
      },
      results: transformedPoints,
      summary: {
        successRate: `${Math.round((transformedPoints.length / points.length) * 100)}%`,
        averageShift: calculateAverageShift(points, transformedPoints),
        note: `${fromCrs} → ${toCrs} 좌표계 변환 완료`
      },
      dataSchema: {
        longitude: '경도 (X 좌표)',
        latitude: '위도 (Y 좌표)',
        note: '변환된 좌표는 대상 좌표계의 단위를 따름 (도 또는 미터)'
      }
    };

    if (errors.length > 0) {
      result.errors = errors;
      result.suggestions = [
        '실패한 좌표점들이 입력 좌표계의 유효 범위 내에 있는지 확인해보세요',
        '좌표계 코드가 정확한지 확인해보세요 (예: EPSG:4326)',
        '좌표값이 해당 좌표계의 예상 범위에 있는지 확인해보세요'
      ];
    }

    return result;

  } catch (error: any) {
    console.error('❌ transformCoordinates 오류:', error);
    return {
      success: false,
      error: error.message || '좌표계 변환 중 오류가 발생했습니다.',
      suggestions: [
        '지원하는 좌표계 코드를 사용하고 있는지 확인해보세요',
        '입력 좌표가 해당 좌표계의 유효 범위 내에 있는지 확인해보세요',
        'proj4 라이브러리가 해당 좌표계를 지원하는지 확인해보세요'
      ],
      supportedCrs: [
        'EPSG:4326 - WGS84 (GPS 좌표계)',
        'EPSG:3857 - Web Mercator (웹 지도)',
        'EPSG:5179 - Korean 2000 (한국 측지계 2000)',
        'EPSG:5174 - Korean 1985 (한국 측지계 1985)',
        'KATECH - Korean TM (한국 TM 좌표계)'
      ]
    };
  }
}

/**
 * 변환 전후 좌표의 평균 이동거리 계산 (대략적)
 */
function calculateAverageShift(original: any[], transformed: any[]): string {
  if (transformed.length === 0) return '0';

  // WGS84 기준 대략적 계산
  let totalShift = 0;
  for (const t of transformed) {
    const orig = t.original;
    const trans = t.transformed;
    
    // 간단한 유클리드 거리 (실제로는 더 정확한 지구 표면 거리 계산 필요)
    const deltaLon = trans.longitude - orig.longitude;
    const deltaLat = trans.latitude - orig.latitude;
    const shift = Math.sqrt(deltaLon * deltaLon + deltaLat * deltaLat);
    totalShift += shift;
  }

  const avgShift = totalShift / transformed.length;
  
  if (avgShift < 0.01) {
    return `${(avgShift * 1000).toFixed(0)}m`; // 미터 단위
  } else if (avgShift < 1) {
    return `${(avgShift * 111.32).toFixed(1)}km`; // 대략적 km 변환
  } else {
    return `좌표계 차이 큼`; // 다른 단위 시스템일 가능성
  }
}