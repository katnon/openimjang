import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
});

function toInt(v: any, def = 0) {
    if (v == null || v === '') return def;
    const s = String(v).replace(/,/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : def;
}
function toFloat(v: any, def = 0) {
    if (v == null || v === '') return def;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : def;
}

async function run() {
    await sql`SELECT 1`;
    console.log('[DEBUG] DB 연결 성공');

    let inserted = 0;

    // 1️⃣ 매매 실거래가 → deal_amount
    const trades = await sql`SELECT * FROM oi.apt_deal_trade_raw`;
    for (const d of trades) {
        const jibunAddress = d.umdnm && d.jibun ? `서울 ${d.umdnm} ${d.jibun}` : null;

        try {
            await sql`
        INSERT INTO oi.apt_deal_all (
          apt_nm, apt_dong, jibun_address,
          exclu_use_ar, floor,
          deal_year, deal_month, deal_day,
          deal_amount
        ) VALUES (
          ${d.aptnm ?? null}, ${d.aptdong ?? null}, ${jibunAddress},
          ${toFloat(d.excluusear)}, ${toInt(d.floor)},
          ${toInt(d.dealyear)}, ${toInt(d.dealmonth)}, ${toInt(d.dealday)},
          ${toInt(d.dealamount)}
        )
        --ON CONFLICT DO NOTHING
      `;
            inserted++;
        } catch (e) {
            console.error('[ERROR] INSERT(trade) 실패:', e);
        }
    }

    // 2️⃣ 전월세 실거래가 → deposit / monthly_rent
    const rents = await sql`SELECT * FROM oi.apt_deal_rent_raw`;
    for (const d of rents) {
        const jibunAddress = d.umdnm && d.jibun ? `서울 ${d.umdnm} ${d.jibun}` : null;

        try {
            await sql`
        INSERT INTO oi.apt_deal_all (
          apt_nm, apt_dong, jibun_address,
          exclu_use_ar, floor,
          deal_year, deal_month, deal_day,
          deposit, monthly_rent
        ) VALUES (
          ${d.aptnm ?? null}, null, ${jibunAddress},
          ${toFloat(d.excluusear)}, ${toInt(d.floor)},
          ${toInt(d.dealyear)}, ${toInt(d.dealmonth)}, ${toInt(d.dealday)},
          ${toInt(d.deposit)}, ${toInt(d.monthlyrent)}
        )
        --ON CONFLICT DO NOTHING
      `;
            inserted++;
        } catch (e) {
            console.error('[ERROR] INSERT(rent) 실패:', e);
        }
    }

    console.log(`[INFO] 총 ${inserted}건 삽입 완료`);
    await sql.end();
}

run().catch((e) => {
    console.error('[FATAL] 스크립트 실패:', e);
});
