interface SearchNearbyPOIParams {
  lat?: number;
  lng?: number;
  poiType?: string;  // "학교", "병원", "마트", "지하철", "버스정류장", "공원", "편의점", "은행", "전체"
  radius?: number;   // 검색 반경 (m)
  contextAptData?: any; // 아파트 문맥 데이터
}

/**
 * 특정 위치 주변의 POI(관심지점)를 검색합니다.
 * 카카오 Local API를 사용하여 외부 데이터를 검색합니다.
 */
export async function searchNearbyPOI(args: SearchNearbyPOIParams): Promise<any> {
  const { lat: requestedLat, lng: requestedLng, poiType, radius = 1000, contextAptData } = args;
  
  // 위치 정보 결정 (요청된 좌표 또는 컨텍스트의 아파트 위치)
  const targetLat = requestedLat || contextAptData?.lat;
  const targetLng = requestedLng || contextAptData?.lon;
  
  if (!targetLat || !targetLng) {
    return {
      success: false,
      error: '위치 정보(위도/경도)가 필요합니다.',
      dataSchema: {
        name: 'POI 명칭',
        category: 'POI 분류',
        address: '주소',
        distance: '거리 (m)',
        note: '카카오 Local API 기반 검색 결과'
      }
    };
  }

  try {
    console.log(`🗺️ POI 검색: lat=${targetLat}, lng=${targetLng}, type=${poiType || '전체'}, radius=${radius}m`);
    
    // POI 타입에 따른 카테고리 매핑 (카카오맵 API 카테고리 코드 기준)
    const categoryMap: { [key: string]: string[] } = {
        "학교": ["SC4", "AC5"], // 학교, 학원
        "병원": ["HP8"], // 병원
        "마트": ["MT1"], // 대형마트
        "지하철": ["SW8"], // 지하철역
        "버스정류장": ["BK9"], // 은행 (버스정류장은 별도 API 필요)
        "공원": ["PK6"], // 공원
        "편의점": ["CS2"], // 편의점
        "은행": ["BK9"] // 은행
    };

    // 검색할 카테고리 결정
    let categories: string[] = [];
    if (!poiType || poiType === "전체") {
        // 전체 검색시 주요 카테고리들
        categories = ["SC4", "HP8", "MT1", "SW8", "PK6", "CS2", "BK9"];
    } else if (categoryMap[poiType]) {
        categories = categoryMap[poiType];
    } else {
        return {
          success: false,
          error: `지원하지 않는 POI 유형입니다: ${poiType}`,
          supportedTypes: Object.keys(categoryMap).concat(['전체'])
        };
    }

    // 카카오 Local API를 사용하여 POI 검색
    const KAKAO_REST_KEY = process.env.VITE_KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
    
    if (!KAKAO_REST_KEY) {
        return {
          success: false,
          error: '카카오 REST API 키가 설정되지 않았습니다.'
        };
    }

    const searchPromises = categories.map(async (category) => {
        try {
            const response = await fetch(
                `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${category}&x=${targetLng}&y=${targetLat}&radius=${radius}&size=15`,
                {
                    headers: {
                        'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
                    }
                }
            );
            
            if (!response.ok) {
                console.error(`카카오 API 오류 (${category}):`, response.status, response.statusText);
                return { category, documents: [] };
            }
            
            const data = await response.json();
            return { category, documents: data.documents || [] };
        } catch (error) {
            console.error(`POI 검색 오류 (${category}):`, error);
            return { category, documents: [] };
        }
    });

    const results = await Promise.all(searchPromises);
    
    // 결과 정리 및 포맷팅
    let allPOIs: any[] = [];
    const categoryNames: { [key: string]: string } = {
        "SC4": "학교",
        "AC5": "학원", 
        "HP8": "병원",
        "MT1": "대형마트",
        "SW8": "지하철역",
        "BK9": "은행",
        "PK6": "공원",
        "CS2": "편의점"
    };

    results.forEach(({ category, documents }) => {
        documents.forEach((poi: any) => {
            allPOIs.push({
                name: poi.place_name,
                category: categoryNames[category] || category,
                address: poi.address_name,
                roadAddress: poi.road_address_name,
                distance: parseInt(poi.distance || 0),
                x: parseFloat(poi.x),
                y: parseFloat(poi.y),
                phone: poi.phone || null,
                url: poi.place_url || null,
                _raw: poi
            });
        });
    });

    // 거리순 정렬
    allPOIs.sort((a, b) => a.distance - b.distance);
    
    // 카테고리별 통계
    const categoryStats: { [key: string]: number } = {};
    allPOIs.forEach(poi => {
        categoryStats[poi.category] = (categoryStats[poi.category] || 0) + 1;
    });

    return {
        success: true,
        searchConditions: {
          location: { lat: targetLat, lng: targetLng },
          radius,
          poiType: poiType || "전체"
        },
        totalCount: allPOIs.length,
        categoryStats,
        pois: allPOIs.slice(0, 30), // 최대 30개 결과만 반환
        dataSchema: {
          name: 'POI 명칭',
          category: 'POI 분류',
          address: '주소',
          roadAddress: '도로명 주소',
          distance: '거리 (m)',
          x: '경도',
          y: '위도',
          phone: '전화번호',
          url: '상세 URL',
          note: '카카오 Local API 기반 검색 결과'
        }
    };

  } catch (error: any) {
      console.error("❌ POI 검색 오류:", error);
      return {
        success: false,
        error: error.message || "POI 검색 중 오류가 발생했습니다."
      };
  }
}