import { Hono } from 'hono';
import { db } from '../../lib/db';
import { sql } from 'kysely';

const buildings = new Hono();

// GET /api/geo/eqb?lat=..&lon=..
// - 데이터 SRID 가정: 5179 (Korea 2000 / Unified CS)
// - 입력 좌표: 4326 (위경도)
// - 반환: FeatureCollection (단일 Feature 혹은 빈 배열)
buildings.get('/eqb', async (c) => {
    const lat = parseFloat(c.req.query('lat') || '');
    const lon = parseFloat(c.req.query('lon') || '');

    if (!isFinite(lat) || !isFinite(lon)) {
        return c.json({ error: 'lat/lon are required as numbers' }, 400);
    }

    try {
        const rows = await sql<{
            properties: any;
            geometry: any;
        }>`
      SELECT
        to_jsonb(t) - 'geom' AS properties,
        ST_AsGeoJSON(
          ST_Transform(t.geom, 4326),
          7
        )::json AS geometry
      FROM public."TL_SPBD_EQB_11_202508" t
      WHERE ST_Contains(
        t.geom,
        ST_Transform(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326), 5179)
      )
      ORDER BY ST_Area(t.geom) DESC
      LIMIT 1
    `.execute(db);

        const features = rows.rows.map((r) => ({
            type: 'Feature',
            geometry: r.geometry,
            properties: r.properties,
        }));

        return c.json({ type: 'FeatureCollection', features });
    } catch (e) {
        console.error('❌ /geo/eqb error', e);
        return c.json({ error: 'failed to fetch apartment boundary' }, 500);
    }
});

export default buildings;


