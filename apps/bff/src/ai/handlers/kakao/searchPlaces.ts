// apps/bff/src/ai/handlers/kakao/searchPlaces.ts
import { SearchPlacesInput } from '../../schemas/kakao/searchPlaces.schema';

/**
 * 카카오 로컬 API를 사용하여 장소를 검색합니다.
 * 
 * 아파트 주변의 편의시설, 상가, 학교, 병원 등을 찾아서
 * 임장 분석 시 생활 인프라 정보를 제공합니다.
 */
export async function searchPlaces(params: SearchPlacesInput) {
    try {
        const { query, x, y, radius = 20000, category } = params;
        
        const kakaoApiKey = process.env.KAKAO_REST_KEY;
        if (!kakaoApiKey) {
            throw new Error('Kakao API key not configured');
        }

        // 카카오 로컬 API 키워드 검색 URL 구성
        let apiUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`;
        
        if (x && y) {
            apiUrl += `&x=${x}&y=${y}`;
        }
        
        if (radius) {
            apiUrl += `&radius=${Math.min(radius, 20000)}`; // 최대 20km
        }
        
        if (category) {
            apiUrl += `&category_group_code=${category}`;
        }

        console.log(`🔍 카카오 장소 검색: ${query} (${x}, ${y})`);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `KakaoAK ${kakaoApiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Kakao API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // 결과 데이터 정규화
        const places = data.documents?.map((place: any) => ({
            id: place.id,
            placeName: place.place_name,
            categoryName: place.category_name,
            categoryGroupCode: place.category_group_code,
            categoryGroupName: place.category_group_name,
            phone: place.phone,
            addressName: place.address_name,
            roadAddressName: place.road_address_name,
            x: parseFloat(place.x), // 경도
            y: parseFloat(place.y), // 위도
            placeUrl: place.place_url,
            distance: place.distance ? parseInt(place.distance) : null
        })) || [];

        // 카테고리별 통계
        const categoryStats = places.reduce((stats: any, place: any) => {
            const category = place.categoryGroupName || '기타';
            stats[category] = (stats[category] || 0) + 1;
            return stats;
        }, {});

        return {
            success: true,
            data: {
                searchQuery: query,
                centerCoords: x && y ? { x, y } : null,
                radius,
                categoryFilter: category,
                places,
                totalCount: places.length,
                categoryStats,
                summary: {
                    nearestPlace: places.length > 0 ? places[0] : null,
                    avgDistance: places.length > 0 
                        ? Math.round(places.filter((p: any) => p.distance).reduce((sum: number, p: any) => sum + p.distance, 0) / places.filter((p: any) => p.distance).length)
                        : null,
                    topCategories: Object.entries(categoryStats)
                        .sort(([,a]: any, [,b]: any) => b - a)
                        .slice(0, 3)
                        .map(([name, count]) => ({ name, count }))
                }
            },
            metadata: {
                source: "kakao_local_api",
                timestamp: new Date().toISOString(),
                apiVersion: "v2",
                dataSchema: {
                    place: {
                        id: "카카오 장소 고유 ID",
                        placeName: "장소명",
                        categoryName: "상세 카테고리",
                        categoryGroupCode: "카테고리 그룹 코드",
                        categoryGroupName: "카테고리 그룹명",
                        phone: "전화번호",
                        addressName: "지번 주소",
                        roadAddressName: "도로명 주소",
                        x: "경도",
                        y: "위도",
                        placeUrl: "카카오맵 상세 페이지 URL",
                        distance: "중심점으로부터의 거리 (미터)"
                    }
                }
            }
        };

    } catch (error) {
        console.error('❌ 카카오 장소 검색 실패:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            data: null
        };
    }
}