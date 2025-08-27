// scripts/fetch/populate_apt_info_from_rent_raw.ts
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 10 });

async function run() {
    await sql`SELECT 1`;
    console.log('[DEBUG] DB 연결 성공');

    const rows = await sql`
    SELECT DISTINCT
      aptnm AS apt_nm,
      umdnm AS umd_nm,
      jibun
    FROM oi.apt_deal_rent_raw
    WHERE aptnm IS NOT NULL AND umdnm IS NOT NULL AND jibun IS NOT NULL
  `;

    console.log('[INFO] 추출된 건수:', rows.length);

    let inserted = 0;

    for (const r of rows) {
        const apt_nm = r.apt_nm?.trim();
        const apt_dong = null; // 전월세에는 동 정보 없음
        const jibun_address = `서울 ${r.umd_nm.trim()} ${r.jibun.trim()}`;

        const exists = await sql`
      SELECT 1 FROM oi.apt_info
      WHERE apt_nm = ${apt_nm}
      AND apt_dong IS NULL
      AND jibun_address = ${jibun_address}
      LIMIT 1
    `;

        if (exists.length > 0) continue;

        await sql`
      INSERT INTO oi.apt_info (
        apt_nm, apt_dong, jibun_address
      ) VALUES (
        ${apt_nm}, NULL, ${jibun_address}
      )
    `;
        inserted++;
    }

    console.log(`[DONE] 새로 삽입된 아파트: ${inserted}건`);
    await sql.end();
}

run().catch((e) => {
    console.error('[FATAL] 스크립트 실패:', e);
});
