import { Hono } from 'hono';
import { db } from '../../lib/db';
import { sql } from 'kysely';

const buildings = new Hono();

// GET /api/eqb?lat=..&lon=..
// - 데이터 SRID: 5179 (Korea 2000 / Unified CS)
// - 입력 좌표: 4326 (위경도)
// - 반환: FeatureCollection (단일 Feature 혹은 빈 배열)
buildings.get('/eqb', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '');
  const lon = parseFloat(c.req.query('lon') || '');

  if (!isFinite(lat) || !isFinite(lon)) {
    return c.json({ error: 'lat/lon are required as numbers' }, 400);
  }

  try {
    // ST_Transform 문자열 파싱 오류 방지: 직접 숫자 삽입
    const rows = await sql`
            WITH picked AS (
                SELECT *
                FROM public.tl_spbd_eqb_11_202508 t
                WHERE ST_Contains(
                    t.geom,
                    ST_Transform(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326), 5179)
                )
                ORDER BY ST_Area(t.geom) DESC
                LIMIT 1
            )
            SELECT
                to_jsonb(picked) - 'geom' AS properties,
                ST_AsGeoJSON(ST_Transform(picked.geom, 4326), 7)::json AS geometry
            FROM picked
        `.execute(db) as any;

    const features = rows.rows.map((r: any) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: r.properties,
    }));

    return c.json({ type: 'FeatureCollection', features });
  } catch (e) {
    console.error('❌ /api/eqb error', e);
    return c.json({ error: 'failed to fetch apartment boundary' }, 500);
  }
});

export default buildings;