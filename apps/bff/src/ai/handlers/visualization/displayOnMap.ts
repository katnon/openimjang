// 지도 시각화 핸들러
interface DisplayOnMapArgs {
  location: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  analysisData: {
    title: string;
    value: string;
    description?: string;
  };
}

export async function displayOnMap(args: DisplayOnMapArgs) {
  try {
    const { location, coordinates, analysisData } = args;
    
    console.log('🗺️ 지도 시각화 요청:', { 
      location, 
      coordinates, 
      title: analysisData.title 
    });
    
    // 1) 좌표 유효성 검증
    const { lat, lon } = coordinates;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return {
        success: false,
        error: '유효하지 않은 좌표입니다.',
        mapData: null
      };
    }
    
    // 2) 지도 마커 데이터 구성
    const markerData = {
      id: `marker_${Date.now()}`,
      position: {
        lat,
        lng: lon // Kakao Maps에서는 lng 사용
      },
      content: {
        title: analysisData.title,
        value: analysisData.value,
        description: analysisData.description || '',
        location: location
      },
      infoWindow: {
        content: `
          <div class="custom-info-window" style="padding: 10px; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">${location}</h4>
            <div style="margin: 4px 0;">
              <strong>${analysisData.title}:</strong> ${analysisData.value}
            </div>
            ${analysisData.description ? `<div style="margin: 4px 0; color: #666; font-size: 0.9em;">${analysisData.description}</div>` : ''}
          </div>
        `
      }
    };
    
    // 3) 지도 설정 구성
    const mapConfig = {
      center: {
        lat,
        lng: lon
      },
      level: 3, // 적절한 확대 레벨
      markers: [markerData],
      bounds: {
        // 마커 주변 영역을 포함하는 bounds 계산
        sw: { lat: lat - 0.005, lng: lon - 0.005 },
        ne: { lat: lat + 0.005, lng: lon + 0.005 }
      }
    };
    
    console.log('✅ 지도 마커 데이터 생성 완료:', { 
      markerId: markerData.id,
      position: markerData.position 
    });
    
    // 4) 프론트엔드에서 사용할 수 있는 형태로 응답
    return {
      success: true,
      mapData: mapConfig,
      message: `${location}의 ${analysisData.title} 정보를 지도에 표시했습니다.`,
      displayInfo: {
        location,
        coordinates: { lat, lon },
        title: analysisData.title,
        value: analysisData.value,
        description: analysisData.description
      }
    };
    
  } catch (error: any) {
    console.error('❌ 지도 시각화 오류:', error);
    return {
      success: false,
      error: error.message || '지도 시각화 중 오류가 발생했습니다.',
      mapData: null
    };
  }
}