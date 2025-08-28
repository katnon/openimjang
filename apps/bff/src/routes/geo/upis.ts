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

        // 간단한 화이트리스트/정규식 검증
        if (!/^([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableParam) || !tableParam.toLowerCase().startsWith('public.upis_')) {
            return c.json({ error: 'invalid table' }, 400);
        }

        const table = tableParam;
        const hasBbox = !!bbox && bbox.split(',').length === 4;
        const maxLimit = 20000;
        const defaultLimit = hasBbox ? 5000 : 2000;
        const limit = Math.min(isNaN(limitParam) ? defaultLimit : limitParam, maxLimit);

        // 줌 기반 simplify 허용 (대략값)
        let tol = 0.0;
        if (!isNaN(zoomParam)) {
            if (zoomParam <= 10) tol = 0.0006; // 저배율: 많이 단순화
            else if (zoomParam <= 12) tol = 0.00025;
            else if (zoomParam <= 14) tol = 0.00012;
            else tol = 0.00005; // 고배율: 미세 단순화
        } else {
            tol = hasBbox ? 0.00025 : 0.0006;
        }

        // 동적 where 절 조립
        let whereClause = '';
        let params: any[] = [];
        if (hasBbox) {
            const [xmin, ymin, xmax, ymax] = bbox!.split(',').map(Number);
            whereClause = `WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
            params = [xmin, ymin, xmax, ymax];
        }

        // 안전을 위해 identifier는 템플릿 문자열로만 삽입, 값은 파라미터 바인딩
        const query = `
            SELECT to_jsonb(t) - 'geom' AS properties,
                   ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geom, ${tol}))::json AS geometry
            FROM (
              SELECT * FROM ${table}
              ${whereClause}
              LIMIT ${limit}
            ) t
        `;

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


