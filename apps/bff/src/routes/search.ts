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

    if (isNaN(aptId)) {
        return c.json({ error: "Invalid apartment ID" }, 400);
    }

    try {
        console.log(`💰 실거래가 조회: aptId=${aptId}, 거래유형=${dealType || '전체'}, 면적=${area || '전체'}`);

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

        // ✅ 2단계: 최근 1년간 정확한 날짜 계산
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 0-based이므로 +1
        const lastYear = oneYearAgo.getFullYear();
        const lastYearMonth = oneYearAgo.getMonth() + 1;

        console.log(`📅 조회 기간: ${lastYear}.${lastYearMonth} ~ ${currentYear}.${currentMonth}`);

        let query = (db
            .selectFrom("oi.apt_deal_all" as any)
            .select([
                "deal_year", "deal_month", "deal_day",
                "deal_amount", "deposit", "monthly_rent",
                "exclu_use_ar", "floor"
            ]) as any)
            .where("apt_nm", "=", aptInfo.apt_nm)
            .where("jibun_address", "=", aptInfo.jibun_address);

        // ✅ 정확한 1년간 날짜 필터링
        if (currentYear === lastYear) {
            // 같은 해인 경우 (거의 없겠지만)
            query = query
                .where("deal_year", "=", currentYear)
                .where("deal_month", ">=", lastYearMonth)
                .where("deal_month", "<=", currentMonth);
        } else {
            // 다른 해인 경우 (일반적)
            query = query.where((eb: any) => eb.or([
                // 작년 데이터: lastYearMonth 이후
                eb.and([
                    eb("deal_year", "=", lastYear),
                    eb("deal_month", ">=", lastYearMonth)
                ]),
                // 올해 데이터: currentMonth 이전
                eb.and([
                    eb("deal_year", "=", currentYear),
                    eb("deal_month", "<=", currentMonth)
                ])
            ]));
        }

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

        console.log(`💰 실거래가 조회 완료: ${results.length}건 (최근 1년간, 제한 없음)`);

        return c.json(results);
    } catch (err) {
        console.error("❌ 실거래가 조회 오류:", err);
        return c.json({ error: "조회 중 오류가 발생했습니다." }, 500);
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

// 📍 주변 정보 조회 (POI)
searchRoute.get("/nearby", async (c) => {
    const lat = parseFloat(c.req.query("lat") ?? "");
    const lon = parseFloat(c.req.query("lon") ?? "");
    const radius = parseInt(c.req.query("radius") ?? "1000");

    if (isNaN(lat) || isNaN(lon)) {
        return c.json({ error: "Invalid coordinates" }, 400);
    }

    try {
        console.log(`📍 주변 정보 조회: 중심=(${lat}, ${lon}), 반경=${radius}m`);

        // 임시 주변 정보 데이터 (실제로는 POI 데이터베이스나 외부 API 사용)
        const mockPOIs = [
            { id: 1, category: "교육", name: "○○초등학교", distance: 350, x: lon + 0.003, y: lat + 0.002, place_name: "○○초등학교" },
            { id: 2, category: "교통", name: "○○역", distance: 800, x: lon - 0.007, y: lat + 0.005, place_name: "○○역" },
            { id: 3, category: "생활", name: "이마트", distance: 1200, x: lon + 0.01, y: lat - 0.008, place_name: "이마트" },
            { id: 4, category: "의료", name: "○○병원", distance: 600, x: lon - 0.005, y: lat - 0.004, place_name: "○○병원" }
        ];

        const nearbyPOIs = mockPOIs.filter(poi => poi.distance <= radius);

        console.log(`📍 주변 정보 결과: ${nearbyPOIs.length}개`);

        return c.json({
            center: { lat, lon },
            radius,
            pois: nearbyPOIs,
            total: nearbyPOIs.length
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
