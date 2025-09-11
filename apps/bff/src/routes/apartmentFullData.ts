// apps/bff/src/routes/apartmentFullData.ts
// 아파트 전체 정보를 일괄 로드하는 API

import { Hono } from 'hono';
import { db } from '../lib/db';
import { sql } from 'kysely';

const apartmentFullDataRoute = new Hono();

/**
 * 아파트의 모든 정보를 한 번에 조회
 * GET /api/apartment/apartment-full-data/:aptId
 */
apartmentFullDataRoute.get('/apartment-full-data/:aptId', async (c) => {
    try {
        const aptId = parseInt(c.req.param('aptId'));
        
        if (!aptId || isNaN(aptId)) {
            return c.json({ error: '유효하지 않은 아파트 ID입니다.' }, 400);
        }

        console.log(`🏢 아파트 전체 정보 조회 시작: aptId=${aptId}`);

        // 병렬로 모든 정보 조회
        const [
            apartmentInfo,
            realEstateDeals,
            areas,
            buildingInfo,
            landuseInfo,
            pnuInfo,
            poiInfo
        ] = await Promise.allSettled([
            // 1. 아파트 기본 정보
            getApartmentInfo(aptId),
            
            // 2. 실거래가 (최근 1년, 전체 거래유형)
            getRealEstateDeals(aptId),
            
            // 3. 전용면적 목록
            getApartmentAreas(aptId),
            
            // 4. 건물 정보
            getBuildingInfo(aptId),
            
            // 5. 토지이용계획 정보
            getLanduseInfo(aptId),
            
            // 6. PNU 정보
            getPnuInfo(aptId),
            
            // 7. 주변 POI 정보 (1km 반경, 전체 시설)
            getPoiInfo(aptId)
        ]);

        // 결과 조합
        const result = {
            success: true,
            apartmentId: aptId,
            loadedAt: new Date().toISOString(),
            data: {
                apartmentInfo: apartmentInfo.status === 'fulfilled' ? apartmentInfo.value : null,
                realEstateDeals: realEstateDeals.status === 'fulfilled' ? realEstateDeals.value : null,
                areas: areas.status === 'fulfilled' ? areas.value : [],
                buildingInfo: buildingInfo.status === 'fulfilled' ? buildingInfo.value : null,
                landuseInfo: landuseInfo.status === 'fulfilled' ? landuseInfo.value : null,
                pnuInfo: pnuInfo.status === 'fulfilled' ? pnuInfo.value : null,
                poiInfo: poiInfo.status === 'fulfilled' ? poiInfo.value : null
            },
            errors: {
                apartmentInfo: apartmentInfo.status === 'rejected' ? apartmentInfo.reason?.message : null,
                realEstateDeals: realEstateDeals.status === 'rejected' ? realEstateDeals.reason?.message : null,
                areas: areas.status === 'rejected' ? areas.reason?.message : null,
                buildingInfo: buildingInfo.status === 'rejected' ? buildingInfo.reason?.message : null,
                landuseInfo: landuseInfo.status === 'rejected' ? landuseInfo.reason?.message : null,
                pnuInfo: pnuInfo.status === 'rejected' ? pnuInfo.reason?.message : null,
                poiInfo: poiInfo.status === 'rejected' ? poiInfo.reason?.message : null
            }
        };

        console.log(`✅ 아파트 전체 정보 조회 완료: aptId=${aptId}`, {
            apartmentInfo: !!result.data.apartmentInfo,
            realEstateDeals: result.data.realEstateDeals?.deals?.length || 0,
            areas: result.data.areas?.length || 0,
            buildingInfo: !!result.data.buildingInfo,
            landuseInfo: result.data.landuseInfo?.landuse_zones?.length || 0,
            poiInfo: result.data.poiInfo?.pois?.length || 0
        });

        return c.json(result);

    } catch (error: any) {
        console.error('❌ 아파트 전체 정보 조회 오류:', error);
        return c.json({
            success: false,
            error: error.message || '아파트 정보 조회 중 오류가 발생했습니다.'
        }, 500);
    }
});

/**
 * 아파트 기본 정보 조회
 */
async function getApartmentInfo(aptId: number) {
    const result = await sql<any>`
        SELECT id, apt_nm, jibun_address, road_address, lat, lon, dong, bjd_code, build_year
        FROM oi.apt_info 
        WHERE id = ${aptId}
    `.execute(db);
    
    return result.rows[0] || null;
}

/**
 * 실거래가 정보 조회 (최근 1년)
 */
async function getRealEstateDeals(aptId: number) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const result = await sql<any>`
        SELECT deal_year, deal_month, deal_day, deal_amount, deposit, monthly_rent, exclu_use_ar, floor
        FROM oi.trade_raw
        WHERE apt_id = ${aptId}
          AND deal_date >= ${oneYearAgo.toISOString().split('T')[0]}
        ORDER BY deal_date DESC, deal_amount DESC
        LIMIT 500
    `.execute(db);
    
    return {
        deals: result.rows,
        loadedAt: new Date(),
        params: {
            period: '1년',
            dealTypes: ['매매', '전세', '월세']
        }
    };
}

/**
 * 전용면적 목록 조회
 */
async function getApartmentAreas(aptId: number) {
    const result = await sql<any>`
        SELECT DISTINCT exclu_use_ar as area
        FROM oi.trade_raw
        WHERE apt_id = ${aptId}
          AND exclu_use_ar IS NOT NULL
        ORDER BY exclu_use_ar
    `.execute(db);
    
    return result.rows.map(row => row.area);
}

/**
 * 건물 정보 조회
 */
async function getBuildingInfo(aptId: number) {
    // 실제 건물 정보 API 호출 로직은 기존 구현을 참고
    // 여기서는 placeholder로 구현
    try {
        const res = await fetch(`http://localhost:8787/api/search/building-info/${aptId}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (error) {
        console.warn('건물 정보 조회 실패:', error);
    }
    
    return {
        recap_info: null,
        title_infos: [],
        total_count: 0
    };
}

/**
 * 토지이용계획 정보 조회
 */
async function getLanduseInfo(aptId: number) {
    // 실제 토지이용계획 API 호출 로직은 기존 구현을 참고
    try {
        const res = await fetch(`http://localhost:8787/api/search/landuse/${aptId}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (error) {
        console.warn('토지이용계획 조회 실패:', error);
    }
    
    return { landuse_zones: [] };
}

/**
 * PNU 정보 조회
 */
async function getPnuInfo(aptId: number) {
    try {
        const res = await fetch(`http://localhost:8787/api/search/pnu/${aptId}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (error) {
        console.warn('PNU 조회 실패:', error);
    }
    
    return { pnu: null };
}

/**
 * 주변 POI 정보 조회
 */
async function getPoiInfo(aptId: number) {
    try {
        // 아파트 좌표 조회
        const aptInfo = await getApartmentInfo(aptId);
        if (!aptInfo?.lat || !aptInfo?.lon) {
            throw new Error('아파트 좌표 정보 없음');
        }

        // POI 검색 핸들러 동적 import
        const { searchNearbyPOI } = await import('../ai/handlers/searchNearbyPOI');
        
        const poiResult = await searchNearbyPOI({
            lat: aptInfo.lat,
            lng: aptInfo.lon,
            poiType: '전체',
            radius: 1000,
            contextAptData: {
                lat: aptInfo.lat,
                lon: aptInfo.lon,
                name: aptInfo.apt_nm,
                address: aptInfo.jibun_address
            }
        });

        if (poiResult.success) {
            return {
                pois: poiResult.pois || [],
                searchConditions: poiResult.searchConditions || {},
                categoryStats: poiResult.categoryStats || {},
                totalCount: poiResult.totalCount || 0,
                loadedAt: new Date()
            };
        }
    } catch (error) {
        console.warn('POI 조회 실패:', error);
    }
    
    return {
        pois: [],
        searchConditions: { location: { lat: 0, lng: 0 }, radius: 1000, poiType: '전체' },
        categoryStats: {},
        totalCount: 0,
        loadedAt: new Date()
    };
}

export default apartmentFullDataRoute;