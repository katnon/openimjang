import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
    // trade_raw에서 아파트 정보 추출
    const rows = await sql`
    SELECT DISTINCT
      aptnm AS apt_nm,
      umdnm AS umd_nm,
      jibun
    FROM oi.apt_deal_trade_raw
    WHERE aptnm IS NOT NULL AND umdnm IS NOT NULL
  `;

    for (const row of rows) {
        const aptNm = row.apt_nm?.trim();
        const jibunAddress = `서울 ${row.umd_nm?.trim()} ${row.jibun?.trim()}`;

        if (!aptNm || !jibunAddress) continue;

        // 중복 체크 (apt_nm + jibun_address)
        const exists = await sql`
      SELECT id FROM oi.apt_info
      WHERE apt_nm = ${aptNm} AND jibun_address = ${jibunAddress}
      LIMIT 1
    `;
        if (exists.length > 0) continue;

        // insert
        await sql`
      INSERT INTO oi.apt_info (apt_nm, jibun_address)
      VALUES (${aptNm}, ${jibunAddress})
    `;
    }

    console.log("populate_apt_info_from_trade_raw 완료");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(() => sql.end());   // ✅ 연결 종료