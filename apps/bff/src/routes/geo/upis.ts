import { Hono } from 'hono';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);
export const upisGeoRouter = new Hono();

// ✅ UPIS GeoJSON: bbox/limit/zoom/table 지원
upisGeoRouter.get('/geo/upis', async (c) => {
    try {
        const tableParam = c.req.query('table') || 'public.upis_c_uq111';
        const bbox = c.req.query('bbox'); // xmin,ymin,xmax,ymax (lon,lat)
        const limitParam = parseInt(c.req.query('limit') || '', 10);
        const zoomParam = parseInt(c.req.query('zoom') || '', 10);
        const simplifyParam = (c.req.query('simplify') || 'true').toLowerCase();

        // 간단한 화이트리스트/정규식 검증
        if (!/^([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableParam) || !tableParam.toLowerCase().startsWith('public.upis_')) {
            return c.json({ error: 'invalid table' }, 400);
        }

        const table = tableParam;
        const hasBbox = !!bbox && bbox.split(',').length === 4;
        const maxLimit = 20000;
        const defaultLimit = hasBbox ? 5000 : 2000;
        const limit = Math.min(isNaN(limitParam) ? defaultLimit : limitParam, maxLimit);

        // 줌 기반 simplify (도 단위). 고배율에서는 간소화 미적용(0)으로 정밀 유지
        let tolDeg = 0.0;
        if (simplifyParam === 'false' || simplifyParam === '0' || simplifyParam === 'no') {
            tolDeg = 0.0;
        } else if (!isNaN(zoomParam)) {
            if (zoomParam <= 9) { tolDeg = 0.001; }
            else if (zoomParam <= 11) { tolDeg = 0.0004; }
            else if (zoomParam <= 12) { tolDeg = 0.0002; }
            else if (zoomParam <= 13) { tolDeg = 0.00008; }
            else if (zoomParam <= 14) { tolDeg = 0.00003; }
            else { tolDeg = 0.0; }
        } else {
            tolDeg = hasBbox ? 0.0002 : 0.0005;
        }

        // 동적 where 절 조립
        let whereClause = '';
        let params: any[] = [];
        if (hasBbox) {
            const [xmin, ymin, xmax, ymax] = bbox!.split(',').map(Number);
            // 좌표계 불일치 해결: 원본(예: 5174)을 4326으로 변환 후 비교
            whereClause = `WHERE ST_Intersects(ST_Transform(geom, 4326), ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
            params = [xmin, ymin, xmax, ymax];
        }

        // 안전을 위해 identifier는 템플릿 문자열로만 삽입, 값은 파라미터 바인딩
        const query = `
            WITH src AS (
              SELECT * FROM ${table} t
              ${whereClause}
              LIMIT ${limit}
            ), norm AS (
              SELECT
                to_jsonb(s) - 'geom' AS properties,
                -- 1) 폴리곤만 추출하고 유효화 (원본 SRID)
                ST_MakeValid(ST_CollectionExtract(s.geom, 3)) AS g
              FROM src s
            )
            SELECT n.properties,
                   ST_AsGeoJSON(
                     CASE WHEN ${tolDeg} > 0
                          THEN ST_SimplifyPreserveTopology(ST_Transform(n.g, 4326), ${tolDeg})
                          ELSE ST_Transform(n.g, 4326)
                     END,
                     7
                   )::json AS geometry
            FROM norm n`;

        const rows = await sql.unsafe(query, params) as Array<{ properties: any; geometry: any }>;

        return c.json({
            type: 'FeatureCollection',
            features: rows.map((row) => ({
                type: 'Feature',
                geometry: row.geometry,
                properties: row.properties,
            })),
        }, 200, {
            'Cache-Control': hasBbox ? 'public, max-age=30' : 'public, max-age=120'
        });
    } catch (e) {
        console.error('❌ /geo/upis 실패:', e);
        return c.json({ error: 'Failed to fetch UPIS geojson' }, 500);
    }
});

export default upisGeoRouter;


