interface SearchNearbyPOIParams {
  lat?: number;
  lng?: number;
  poiType?: string;  // "학교", "병원", "마트", "지하철", "버스정류장", "공원", "편의점", "은행", "전체"
  radius?: number;   // 검색 반경 (m)
  contextAptData?: any; // 아파트 문맥 데이터
}

// POI 검색 결과 캐시 (메모리 기반, 5분 TTL)
const poiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 특정 위치 주변의 POI(관심지점)를 검색합니다.
 * 카카오 Local API를 사용하여 외부 데이터를 검색합니다.
 * 중복 요청 방지를 위한 캐시 시스템 포함
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

  // 캐시 키 생성 (좌표, POI 타입, 반경 기준)
  const cacheKey = `${targetLat.toFixed(4)}_${targetLng.toFixed(4)}_${poiType || 'all'}_${radius}`;
  
  // 캐시된 결과 확인
  const cached = poiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`✅ POI 검색 캐시 히트: ${cacheKey}`);
    return { ...cached.data, fromCache: true };
  }

  try {
    console.log(`🗺️ POI 검색: lat=${targetLat}, lng=${targetLng}, type=${poiType || '전체'}, radius=${radius}m`);
    
    // POI 타입에 따른 카테고리 매핑 (임장 핵심 요소)
    const categoryMap: { [key: string]: string[] } = {
        "대중교통": ["SW8"], // 지하철역 (최우선)
        "마트": ["MT1"], // 대형마트 (생활편의)
        "병원": ["HP8"], // 병원 (응급상황)
        "학교": ["SC4"] // 학교 (치안 참고용)
    };

    // 검색할 카테고리 결정
    let categories: string[] = [];
    if (!poiType || poiType === "전체") {
        // 전체 검색시: 대중교통 최우선, 학교는 치안 참고용으로만
        categories = ["SW8", "MT1", "HP8", "SC4"];
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
    const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
    
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
    
    // 결과 정리 및 포맷팅 (핵심만)
    let allPOIs: any[] = [];
    const categoryNames: { [key: string]: string } = {
        "SW8": "지하철역",
        "MT1": "대형마트", 
        "HP8": "병원",
        "SC4": "학교"
    };

    // 카테고리별 우선순위 (임장 핵심)
    const categoryPriority: { [key: string]: number } = {
        "지하철역": 1, // 최우선
        "대형마트": 2, // 생활편의
        "병원": 3, // 응급상황
        "학교": 4  // 치안 참고용 (낮은 우선순위)
    };

    results.forEach(({ category, documents }) => {
        documents.forEach((poi: any) => {
            allPOIs.push({
                name: poi.place_name,
                category: categoryNames[category] || category,
                distance: parseInt(poi.distance || 0),
                priority: categoryPriority[categoryNames[category]] || 99,
                // 간소화: 전화번호, 상세주소, URL 제거
                _compact: true
            });
        });
    });

    // 임장 우선순위 + 거리 기준 정렬 (대중교통 최우선)
    allPOIs.sort((a, b) => {
        // 1순위: 카테고리 우선순위 (대중교통 > 학교 > 기타)
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        // 2순위: 거리 (같은 카테고리 내에서)
        return a.distance - b.distance;
    });
    
    // 카테고리별 통계 (간소화)
    const categoryStats: { [key: string]: number } = {};
    allPOIs.forEach(poi => {
        categoryStats[poi.category] = (categoryStats[poi.category] || 0) + 1;
    });

    // 대중교통 정보 별도 추출 (최우선 표시용)
    const transportation = allPOIs.filter(poi => poi.category === '지하철역').slice(0, 3);

    const result = {
        success: true,
        searchConditions: {
          location: { lat: targetLat, lng: targetLng },
          radius,
          poiType: poiType || "전체"
        },
        totalCount: allPOIs.length,
        categoryStats,
        transportation, // 대중교통 별도 표시용
        pois: allPOIs.slice(0, 20), // 최대 20개로 축소 (컴팩트)
        dataSchema: {
          name: 'POI 명칭',
          category: 'POI 분류 (대중교통 우선)',
          distance: '거리 (m)',
          priority: '임장 우선순위',
          note: '컴팩트 버전 - 전화번호, 상세주소 생략'
        }
    };

    // 결과를 캐시에 저장
    poiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`💾 POI 검색 결과 캐시 저장: ${cacheKey}`);
    
    // 캐시 정리 (100개 이상이면 오래된 것부터 삭제)
    if (poiCache.size > 100) {
        const oldestKeys = Array.from(poiCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, 20)
            .map(entry => entry[0]);
        
        oldestKeys.forEach(key => poiCache.delete(key));
        console.log(`🧹 POI 캐시 정리: ${oldestKeys.length}개 항목 삭제`);
    }

    return result;

  } catch (error: any) {
      console.error("❌ POI 검색 오류:", error);
      return {
        success: false,
        error: error.message || "POI 검색 중 오류가 발생했습니다."
      };
  }
}