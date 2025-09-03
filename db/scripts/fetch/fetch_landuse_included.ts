// 용도지역·지구 코드를 정리하여 전용 테이블로 저장하는 스크립트
//
// - flag=1(포함) 코드만 남기고, 중복 제거 후 최초 등장 순서대로 합칩니다.
// - PNU(19자리)는 5-5-1-4-4로 분리하여 별도 컬럼에 저장합니다.
// - 테이블이 이미 있으면 TRUNCATE+INSERT로 재적재, 없으면 CREATE 후 INSERT 합니다.

import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL, {
  max: 5,
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 10,
});

async function run() {
  console.log('[INFO] landuse_included fetch started');
  await sql`SELECT 1`;

  // 테이블 존재 여부 확인
  const exists = await sql`
    SELECT to_regclass('oi.landuse_included') IS NOT NULL AS exists
  `;
  const tableExists = exists[0].exists as boolean;

  if (!tableExists) {
    console.log('[INFO] creating table oi.landuse_included');
    await sql`CREATE SCHEMA IF NOT EXISTS oi`;
    await sql`CREATE TABLE oi.landuse_included (
      gid integer,
      geom geometry(MultiPolygon, 5186),
      code text,
      pnu text,
      pnu_sgg text,     -- 시군구 코드 (앞 5자리)
      pnu_umd text,     -- 읍면동 코드 (다음 5자리)
      pnu_landcd text,  -- 지번 구분 (1자리, 0=대지, 1=산)
      pnu_bonbun text,  -- 본번 (4자리)
      pnu_bubun text    -- 부번 (4자리)
    )`;
  } else {
    console.log('[INFO] table exists, truncating for reload');
    await sql`TRUNCATE oi.landuse_included`;
  }

  // 데이터 적재
  console.log('[INFO] inserting aggregated data');
  await sql`
    INSERT INTO oi.landuse_included
      (gid, geom, code, pnu, pnu_sgg, pnu_umd, pnu_landcd, pnu_bonbun, pnu_bubun)
    WITH src AS (
      SELECT
        gid,
        geom,
        a0::text AS pnu,
        string_to_array(regexp_replace(a7, '\\s+', '', 'g'), ',') AS codes,
        string_to_array(regexp_replace(a9, '\\s+', '', 'g'), ',') AS flags
      FROM public.al_d154_11_20250830
    ),
    exploded AS (
      SELECT
        s.gid, s.geom, s.pnu,
        t.code, t.flag, t.idx
      FROM src s
      CROSS JOIN LATERAL unnest(s.codes, s.flags) WITH ORDINALITY AS t(code, flag, idx)
      WHERE t.flag = '1' AND t.code IS NOT NULL AND t.code <> ''
    ),
    dedup AS (
      SELECT gid, geom, pnu, code, MIN(idx) AS first_idx
      FROM exploded
      GROUP BY gid, geom, pnu, code
    )
    SELECT
      gid,
      geom,
      string_agg(code, ',' ORDER BY first_idx) AS code,
      pnu,
      substring(pnu, 1, 5)  AS pnu_sgg,
      substring(pnu, 6, 5)  AS pnu_umd,
      substring(pnu, 11, 1) AS pnu_landcd,
      substring(pnu, 12, 4) AS pnu_bonbun,
      substring(pnu, 16, 4) AS pnu_bubun
    FROM dedup
    GROUP BY gid, geom, pnu
  `;

  // 인덱스는 최초 생성시에만
  if (!tableExists) {
    console.log('[INFO] creating indexes');
    await sql`CREATE INDEX landuse_included_gix ON oi.landuse_included USING gist (geom)`;
    await sql`CREATE INDEX landuse_included_code_idx ON oi.landuse_included (code)`;
    await sql`CREATE INDEX landuse_included_pnu_idx ON oi.landuse_included (pnu)`;
    await sql`CREATE INDEX landuse_included_sgg_idx ON oi.landuse_included (pnu_sgg)`;
    await sql`CREATE INDEX landuse_included_umd_idx ON oi.landuse_included (pnu_umd)`;
  }

  console.log('[INFO] landuse_included table load completed');
  await sql.end();
}

run().catch((e) => {
  console.error('[FATAL] landuse_included fetch failed:', e);
  return sql.end();
});
