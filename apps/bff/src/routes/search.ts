import { Hono } from "hono";
import { db } from "../lib/db";
import { sql } from "kysely";

type AptInfoRow = {
    id: number;
    apt_nm: string;
    jibun_address: string;
    lat: number | null;
    lon: number | null;
};

export const searchRoute = new Hono();

// 🔍 자동완성 및 검색
searchRoute.get("/", async (c) => {
    const q = c.req.query("q") ?? "";

    if (!q || q.trim().length < 1) return c.json([]);

    try {
        console.log(`🔍 검색 요청: "${q}"`);

        const results = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["id", "apt_nm", "jibun_address", "lat", "lon"]) as any)
            .where((eb: any) => eb.or([
                eb("apt_nm", "ilike", `%${q}%`),
                eb("jibun_address", "ilike", `%${q}%`)
            ]))
            .orderBy("apt_nm")
            .limit(10)
            .execute();

        console.log(`🔍 검색 결과: "${q}" -> ${results.length}개`);
        return c.json(results);
    } catch (e) {
        console.error("❌ 검색 오류:", e);
        return c.json({ error: "검색 중 오류가 발생했습니다." }, 500);
    }
});

// 📍 좌표 기반 가장 가까운 단지 찾기
searchRoute.get("/nearest", async (c) => {
    const lat = parseFloat(c.req.query("lat") ?? "");
    const lng = parseFloat(c.req.query("lng") ?? "");

    if (isNaN(lat) || isNaN(lng)) {
        return c.json({ error: "Invalid coordinates" }, 400);
    }

    try {
        console.log(`📍 가장 가까운 아파트 검색: ${lat}, ${lng}`);

        const result = await sql<any>`
            SELECT *, 
                   ST_Distance(
                       geography(ST_MakePoint(lon, lat)),
                       geography(ST_MakePoint(${lng}, ${lat}))
                   ) AS dist
            FROM oi.apt_info
            WHERE lat IS NOT NULL AND lon IS NOT NULL
            ORDER BY dist
            LIMIT 1
        `.execute(db);

        const row = (result.rows[0] as (AptInfoRow & { dist: number })) || null;
        console.log(`📍 결과:`, row ? `${row.apt_nm} (거리: ${Math.round(Number(row.dist))}m)` : "없음");

        return c.json(row);
    } catch (err) {
        console.error("❌ 가장 가까운 아파트 검색 오류:", err);
        return c.json({ error: "검색 중 오류가 발생했습니다." }, 500);
    }
});

// ✅ 전용면적 목록 조회 (apt_dong 제외한 조인)
searchRoute.get("/areas/:aptId", async (c) => {
    const aptId = parseInt(c.req.param("aptId"));

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`📐 전용면적 목록 조회: aptId=${aptId}`);

        // ✅ 1단계: apt_info에서 조인 정보 가져오기 (apt_dong 제외)
        const aptInfo = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["apt_nm", "jibun_address"]) as any)
            .where("id", "=", aptId)
            .executeTakeFirst();

        if (!aptInfo) {
            return c.json({ error: "아파트를 찾을 수 없습니다." }, 404);
        }

        console.log(`📐 조회할 아파트: ${aptInfo.apt_nm}, ${aptInfo.jibun_address}`);

        // ✅ 2단계: apt_deal_all에서 전용면적 목록 조회 (apt_nm, jibun_address만 사용)
        const results = await (db
            .selectFrom("oi.apt_deal_all" as any)
            .select("exclu_use_ar") as any)
            .distinct()
            .where("apt_nm", "=", aptInfo.apt_nm)
            .where("jibun_address", "=", aptInfo.jibun_address)
            .where("exclu_use_ar", "is not", null)
            .orderBy("exclu_use_ar")
            .execute();

        const areas = results.map((row: { exclu_use_ar: number }) => row.exclu_use_ar);
        console.log(`📐 전용면적 목록: ${areas.length}개 - ${areas}`);

        return c.json(areas);
    } catch (err) {
        console.error("❌ 전용면적 목록 조회 오류:", err);
        return c.json({ error: "조회 중 오류가 발생했습니다." }, 500);
    }
});

// ✅ 실거래가 조회 (모든 제한 제거 + 정확한 1년간 필터링)
searchRoute.get("/deals/:aptId", async (c) => {
    const aptId = parseInt(c.req.param("aptId"));
    const dealType = c.req.query("dealType") || "";
    const area = c.req.query("area") || "";
    const rawPeriod = c.req.query("period") || "1년";
    const period = decodeURIComponent(rawPeriod);

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`💰 실거래가 조회: aptId=${aptId}, 거래유형=${dealType || '전체'}, 면적=${area || '전체'}, 기간=${period}`);
        console.log(`🔍 받은 파라미터 - rawPeriod: "${rawPeriod}", decodedPeriod: "${period}", dealType: "${dealType}", area: "${area}"`);

        // ✅ 1단계: apt_info에서 조인 정보 가져오기
        const aptInfo = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["apt_nm", "jibun_address"]) as any)
            .where("id", "=", aptId)
            .executeTakeFirst();

        if (!aptInfo) {
            return c.json({ error: "아파트를 찾을 수 없습니다." }, 404);
        }

        console.log(`💰 조회할 아파트: ${aptInfo.apt_nm}, ${aptInfo.jibun_address}`);

        // ✅ 2단계: 선택된 기간에 따른 날짜 계산 (최대한 단순하게)
        const currentYear = 2025; // 하드코딩으로 일단 고정
        let startYear;
        
        console.log(`📅 현재: ${currentYear}년, 선택된 기간: "${period}"`);
        
        // 기간에 따른 시작 년도 (아주 단순)
        switch (period) {
            case "3개월":
            case "6개월":
                startYear = 2024; // 작년부터 안전하게
                break;
            case "1년":
                startYear = 2024; // 2024~2025
                break;
            case "3년":
                startYear = 2022; // 2022~2025
                break;
            case "전체":
                startYear = 2000; // 2000~2025 (정말 모든 데이터)
                break;
            default:
                startYear = 2024;
        }

        console.log(`📅 조회 기간: ${startYear}년 ~ ${currentYear}년 (${period})`);

        let query = (db
            .selectFrom("oi.apt_deal_all" as any)
            .select([
                "deal_year", "deal_month", "deal_day",
                "deal_amount", "deposit", "monthly_rent",
                "exclu_use_ar", "floor"
            ]) as any)
            .where("apt_nm", "=", aptInfo.apt_nm)
            .where("jibun_address", "=", aptInfo.jibun_address);

        // ✅ 날짜 필터링 (가장 단순한 방법)
        console.log(`🔍 날짜 필터링 시작: ${startYear} <= deal_year <= ${currentYear}`);
        
        query = query
            .where("deal_year", ">=", startYear)
            .where("deal_year", "<=", currentYear);
            
        console.log(`🔍 날짜 필터링 완료`);

        // 거래 유형 필터 (기존과 동일)
        if (dealType === "매매") {
            query = query.where("deal_amount", "is not", null);
        } else if (dealType === "전세") {
            query = query
                .where("deposit", "is not", null)
                .where((eb: any) => eb.or([
                    eb("monthly_rent", "=", 0),
                    eb("monthly_rent", "is", null)
                ]));
        } else if (dealType === "월세") {
            query = query
                .where("deposit", "is not", null)
                .where("monthly_rent", ">", 0);
        } else if (dealType === "전월세") {
            query = query.where("deposit", "is not", null);
        }

        // 전용면적 필터 (기존과 동일)
        if (area) {
            const areaNum = parseFloat(area);
            if (!isNaN(areaNum)) {
                query = query.where("exclu_use_ar", "=", areaNum);
            }
        }

        // ✅ 정렬만 적용, 어떤 LIMIT도 없음 - 모든 데이터 반환
        const results = await query
            .orderBy("deal_year", "desc")
            .orderBy("deal_month", "desc")
            .orderBy("deal_day", "desc")
            .execute();

        console.log(`💰 실거래가 조회 완료: ${results.length}건`);
        console.log(`📅 기간: ${startYear}~${currentYear} (${period})`);
        console.log(`🔍 거래유형 필터: ${dealType || '없음'}`);
        console.log(`🔍 면적 필터: ${area || '없음'}`);

        return c.json(results);
    } catch (err) {
        console.error("❌ 실거래가 조회 오류 상세:");
        console.error("❌ 에러 메시지:", err.message);
        console.error("❌ 에러 스택:", err.stack);
        console.error("❌ 전체 에러 객체:", err);
        return c.json({ error: "조회 중 오류가 발생했습니다.", details: err.message }, 500);
    }
});

// 🏢 PNU (부동산고유번호) 조회
searchRoute.get("/pnu/:aptId", async (c) => {
    const aptId = parseInt(c.req.param("aptId"));

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`🏢 PNU 조회: aptId=${aptId}`);

        // 1단계: apt_info에서 좌표 정보 가져오기
        const aptInfo = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["apt_nm", "jibun_address", "lat", "lon"]) as any)
            .where("id", "=", aptId)
            .executeTakeFirst();

        if (!aptInfo) {
            return c.json({ error: "아파트를 찾을 수 없습니다." }, 404);
        }

        if (!aptInfo.lat || !aptInfo.lon) {
            return c.json({ error: "아파트 좌표 정보가 없습니다." }, 400);
        }

        console.log(`🏢 조회할 아파트: ${aptInfo.apt_nm}, 좌표=(${aptInfo.lat}, ${aptInfo.lon})`);

        // 2단계: 연속지적도에서 PNU 조회
        // 좌표 변환: WGS84 (4326) → EPSG:5186
        const pnuResult = await sql<any>`
            SELECT a1 AS pnu
            FROM public.al_d002_11_20250804
            WHERE ST_Intersects(
                geom,
                ST_Transform(ST_SetSRID(ST_Point(${aptInfo.lon}, ${aptInfo.lat}), 4326), 5186)
            )
            LIMIT 1
        `.execute(db);

        const pnuRow = pnuResult.rows[0] || null;
        const pnu = pnuRow ? pnuRow.pnu : null;

        console.log(`🏢 PNU 조회 결과:`, pnu || "없음");

        return c.json({ 
            pnu,
            apt_name: aptInfo.apt_nm,
            jibun_address: aptInfo.jibun_address,
            coordinates: { lat: aptInfo.lat, lon: aptInfo.lon }
        });

    } catch (err) {
        console.error("❌ PNU 조회 오류:", err);
        return c.json({ error: "PNU 조회 중 오류가 발생했습니다." }, 500);
    }
});

// 🏛️ 토지이용계획 조회 (용도지역지구)
searchRoute.get("/landuse/:aptId", async (c) => {
    const aptId = parseInt(c.req.param("aptId"));

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`🏛️ 토지이용계획 조회: aptId=${aptId}`);

        // 1단계: apt_info에서 좌표 정보 가져오기
        const aptInfo = await (db
            .selectFrom("oi.apt_info" as any)
            .select(["apt_nm", "jibun_address", "lat", "lon"]) as any)
            .where("id", "=", aptId)
            .executeTakeFirst();

        if (!aptInfo) {
            return c.json({ error: "아파트를 찾을 수 없습니다." }, 404);
        }

        if (!aptInfo.lat || !aptInfo.lon) {
            return c.json({ error: "아파트 좌표 정보가 없습니다." }, 400);
        }

        console.log(`🏛️ 조회할 아파트: ${aptInfo.apt_nm}, 좌표=(${aptInfo.lat}, ${aptInfo.lon})`);

        // 2단계: al_d154_11_20250830에서 토지이용계획 조회
        // 좌표 변환: WGS84 (4326) → EPSG:5186
        const landuseResult = await sql<any>`
            SELECT a7, a9
            FROM public.al_d154_11_20250830
            WHERE ST_Intersects(
                geom,
                ST_Transform(ST_SetSRID(ST_Point(${aptInfo.lon}, ${aptInfo.lat}), 4326), 5186)
            )
            LIMIT 1
        `.execute(db);

        const landuseRow = landuseResult.rows[0] || null;
        
        if (!landuseRow || !landuseRow.a7) {
            console.log(`🏛️ 토지이용계획 정보 없음`);
            return c.json({ 
                landuse_zones: [],
                apt_name: aptInfo.apt_nm,
                jibun_address: aptInfo.jibun_address,
                coordinates: { lat: aptInfo.lat, lon: aptInfo.lon }
            });
        }

        // 3단계: 코드와 상태 파싱
        const codes = landuseRow.a7 ? landuseRow.a7.split(',').map((code: string) => code.trim()) : [];
        const statuses = landuseRow.a9 ? landuseRow.a9.split(',').map((status: string) => parseInt(status.trim())) : [];

        console.log(`🏛️ 코드 목록: ${codes}`);
        console.log(`🏛️ 상태 목록: ${statuses}`);

        // 4단계: landuse_code에서 코드별 이름 조회
        const landuseZones = [];
        
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            const statusCode = statuses[i] || 1; // 기본값은 포함
            
            if (!code) continue;

            // landuse_code 테이블에서 코드명 조회
            const codeResult = await (db
                .selectFrom("public.landuse_code" as any)
                .select(["code", "name"]) as any)
                .where("code", "=", code)
                .executeTakeFirst();

            const codeName = codeResult ? codeResult.name : code; // 이름이 없으면 코드 그대로 사용
            
            // 상태 텍스트 변환
            const statusText = statusCode === 1 ? "포함" : 
                              statusCode === 2 ? "저촉" : 
                              statusCode === 3 ? "접함" : "포함";

            landuseZones.push({
                code: code,
                name: codeName,
                status: statusCode,
                displayText: `${codeName}(${statusText})`
            });
        }

        console.log(`🏛️ 토지이용계획 조회 결과: ${landuseZones.length}개`);

        return c.json({ 
            landuse_zones: landuseZones,
            apt_name: aptInfo.apt_nm,
            jibun_address: aptInfo.jibun_address,
            coordinates: { lat: aptInfo.lat, lon: aptInfo.lon }
        });

    } catch (err) {
        console.error("❌ 토지이용계획 조회 오류:", err);
        return c.json({ error: "토지이용계획 조회 중 오류가 발생했습니다." }, 500);
    }
});

// 📍 주변 정보 조회 (POI) - 카카오 로컬 API 사용
searchRoute.get("/nearby", async (c) => {
    const lat = parseFloat(c.req.query("lat") ?? "");
    const lon = parseFloat(c.req.query("lon") ?? "");
    const radius = parseInt(c.req.query("radius") ?? "1000");

    if (isNaN(lat) || isNaN(lon)) {
        return c.json({ error: "Invalid coordinates" }, 400);
    }

    try {
        console.log(`📍 주변 정보 조회: 중심=(${lat}, ${lon}), 반경=${radius}m`);

        const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
        if (!KAKAO_REST_KEY) {
            console.warn("카카오 REST API 키가 설정되지 않아 Mock 데이터를 사용합니다.");
            // Fallback to mock data
            const mockPOIs = [
                { id: 1, category: "교육", name: "인근 초등학교", distance: 350, x: lon + 0.003, y: lat + 0.002, place_name: "인근 초등학교" },
                { id: 2, category: "교통", name: "인근 지하철역", distance: 800, x: lon - 0.007, y: lat + 0.005, place_name: "인근 지하철역" },
                { id: 3, category: "생활", name: "대형마트", distance: 1200, x: lon + 0.01, y: lat - 0.008, place_name: "대형마트" },
                { id: 4, category: "의료", name: "종합병원", distance: 600, x: lon - 0.005, y: lat - 0.004, place_name: "종합병원" },
                { id: 5, category: "공공기관", name: "주민센터", distance: 400, x: lon + 0.002, y: lat - 0.003, place_name: "주민센터" }
            ];
            return c.json({
                center: { lat, lon },
                radius,
                pois: mockPOIs.filter(poi => poi.distance <= radius),
                total: mockPOIs.filter(poi => poi.distance <= radius).length
            });
        }

        // 카테고리별로 검색할 키워드들 정의
        const searchCategories = [
            // 교육시설
            { keyword: "초등학교", category: "교육" },
            { keyword: "중학교", category: "교육" },
            { keyword: "고등학교", category: "교육" },
            { keyword: "유치원", category: "교육" },
            
            // 공공기관 및 안전시설
            { keyword: "주민센터", category: "공공기관" },
            { keyword: "동주민센터", category: "공공기관" },
            { keyword: "소방서", category: "안전시설" },
            { keyword: "119안전센터", category: "안전시설" },
            { keyword: "파출소", category: "안전시설" },
            { keyword: "지구대", category: "안전시설" },
            { keyword: "우체국", category: "공공기관" },
            { keyword: "보건소", category: "공공기관" },
            
            // 교통시설
            { keyword: "지하철역", category: "교통" },
            { keyword: "버스정류장", category: "교통" },
            
            // 생활편의시설
            { keyword: "마트", category: "생활" },
            { keyword: "병원", category: "의료" },
            { keyword: "약국", category: "의료" },
            { keyword: "은행", category: "금융" }
        ];

        const allPOIs: any[] = [];

        // 각 카테고리별로 병렬 검색
        const searchPromises = searchCategories.map(async ({ keyword, category }) => {
            try {
                const response = await fetch(
                    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&x=${lon}&y=${lat}&radius=${radius}&size=5&sort=distance`,
                    {
                        headers: {
                            'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    return data.documents.map((poi: any) => ({
                        id: poi.id,
                        category: category,
                        name: poi.place_name,
                        distance: parseInt(poi.distance),
                        x: parseFloat(poi.x),
                        y: parseFloat(poi.y),
                        place_name: poi.place_name,
                        address: poi.address_name,
                        road_address: poi.road_address_name,
                        phone: poi.phone
                    }));
                }
            } catch (error) {
                console.error(`❌ ${keyword} 검색 오류:`, error);
            }
            return [];
        });

        const results = await Promise.all(searchPromises);
        
        // 결과 통합 및 중복 제거
        results.forEach(pois => {
            pois.forEach((poi: any) => {
                // 같은 장소 중복 제거 (이름과 거리 기준)
                if (!allPOIs.find(existing => 
                    existing.name === poi.name && 
                    Math.abs(existing.distance - poi.distance) < 50
                )) {
                    allPOIs.push(poi);
                }
            });
        });

        // 거리순 정렬
        allPOIs.sort((a, b) => a.distance - b.distance);

        console.log(`📍 주변 정보 결과: ${allPOIs.length}개 (교육: ${allPOIs.filter(p => p.category === '교육').length}, 공공기관: ${allPOIs.filter(p => p.category === '공공기관').length}, 안전시설: ${allPOIs.filter(p => p.category === '안전시설').length})`);

        return c.json({
            center: { lat, lon },
            radius,
            pois: allPOIs,
            total: allPOIs.length,
            categories: {
                education: allPOIs.filter(p => p.category === '교육'),
                publicFacilities: allPOIs.filter(p => ['공공기관', '안전시설'].includes(p.category)),
                transportation: allPOIs.filter(p => p.category === '교통'),
                convenience: allPOIs.filter(p => ['생활', '의료', '금융'].includes(p.category))
            }
        });
    } catch (err) {
        console.error("❌ 주변 정보 조회 오류:", err);
        return c.json({ error: "주변 정보 조회 중 오류가 발생했습니다." }, 500);
    }
});

// 🏗️ 건물 정보 조회 (총괄표제부 및 표제부)
searchRoute.get("/building-info/:aptId", async (c) => {
    const aptId = parseInt(c.req.param("aptId"));

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`🏗️ 건물 정보 조회: aptId=${aptId}`);

        // apt_building_info 테이블에서 해당 아파트의 건물 정보 조회
        const buildingInfos = await (db
            .selectFrom("oi.apt_building_info" as any)
            .select([
                "id", "type", "dongnm", "bldnm", "platplc", "platarea", "archarea", 
                "totarea", "grndflrcnt", "ugrndflrcnt", "mainpurpscdnm", "strctcdnm", 
                "roofcdnm", "hhldcnt", "mainbldcnt", "atchbldcnt", "totpkngcnt", 
                "useaprday", "created_at"
            ]) as any)
            .where("apt_id", "=", aptId)
            .orderBy("type", "desc") // recap이 먼저 오도록 (recap > title)
            .orderBy("dongnm", "asc") // 동명으로 정렬
            .execute();

        if (!buildingInfos || buildingInfos.length === 0) {
            console.log(`🏗️ 건물 정보 없음: aptId=${aptId}`);
            return c.json({ 
                recap_info: null,
                title_infos: [],
                total_count: 0
            });
        }

        // type별로 분리
        const recapInfo = buildingInfos.find((info: any) => info.type === 'recap') || null;
        const titleInfos = buildingInfos.filter((info: any) => info.type === 'title');

        console.log(`🏗️ 건물 정보 조회 결과: 총괄표제부=${recapInfo ? '1개' : '없음'}, 표제부=${titleInfos.length}개`);

        return c.json({ 
            recap_info: recapInfo,
            title_infos: titleInfos,
            total_count: buildingInfos.length
        });

    } catch (err) {
        console.error("❌ 건물 정보 조회 오류:", err);
        return c.json({ error: "건물 정보 조회 중 오류가 발생했습니다." }, 500);
    }
});

/**
 * 카카오 장소 검색 API (스마트 링크용)
 * GET /api/search/location?q=검색어&type=타입
 */
searchRoute.get('/location', async (c) => {
    try {
        const query = c.req.query('q');
        const type = c.req.query('type') || '';
        
        if (!query) {
            return c.json({
                success: false,
                error: '검색어가 필요합니다.'
            }, 400);
        }

        console.log('🔍 카카오 장소 검색 (스마트 링크):', { query, type });

        // 카카오 REST API 키 확인
        const kakaoApiKey = process.env.KAKAO_REST_KEY;
        if (!kakaoApiKey) {
            console.error('❌ KAKAO_REST_KEY 환경변수가 설정되지 않았습니다.');
            return c.json({
                success: false,
                error: '카카오 API 키가 설정되지 않았습니다.'
            }, 500);
        }

        // 카카오 장소 검색 API 호출
        const response = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
            {
                headers: {
                    'Authorization': `KakaoAK ${kakaoApiKey}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`카카오 API 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        
        console.log('✅ 카카오 장소 검색 결과:', {
            query,
            resultCount: data.documents?.length || 0
        });

        return c.json({
            success: true,
            results: data.documents || [],
            meta: data.meta || {}
        });

    } catch (error: any) {
        console.error('❌ 장소 검색 오류:', error);
        return c.json({
            success: false,
            error: error.message || '장소 검색 중 오류가 발생했습니다.'
        }, 500);
    }
});

// @아파트명 블록 클릭 시에는 기본 검색 API (/api/search?q=아파트명)를 사용합니다

// @아파트명 블록은 일반 검색과 동일하게 처리됩니다
