// fetch_rent_raw.ts
// - 아파트 전월세 실거래가 수집 (서울, 2025-01 ~ 현재)
// - DB: oi.apt_deal_rent_raw
// - 실행: bun run fetch_rent_raw.ts

import 'dotenv/config';
import axios from 'axios';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import postgres from 'postgres';
import dayjs from 'dayjs';

const API_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
const SERVICE_KEY = process.env.RTMS_API_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

// ✅ 실패한 항목만 다시 시도할 수 있도록 세트로 정의
const RETRY_ONLY = new Set([
    '11620_202507',
    '11620_202508',
]);

if (!SERVICE_KEY || !DATABASE_URL) {
    console.error('❌ .env의 RTMS_API_KEY, DATABASE_URL을 확인하세요.');
    process.exit(1);
}

const sql = postgres(DATABASE_URL, {
    max: 5,
    prepare: false,
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

async function parseRtmsResponse(decoded: string) {
    const txt = decoded.trim();

    if (txt.startsWith('{') || txt.startsWith('[')) {
        try {
            const j = JSON.parse(txt);
            const code = j?.response?.header?.resultCode;
            const ok = code === '00' || code === '000';
            return {
                ok,
                msg: j?.response?.header?.resultMsg || 'JSON',
                items: j?.response?.body?.items?.item ?? null,
            };
        } catch {
            return { ok: false, msg: 'JSON parse error', items: null };
        }
    }

    if (txt.startsWith('<') || txt.startsWith('<?xml')) {
        try {
            const parsed = await xml2js.parseStringPromise(txt, { explicitArray: false });
            const code = parsed?.response?.header?.resultCode;
            const ok = code === '00' || code === '000';
            return {
                ok,
                msg: parsed?.response?.header?.resultMsg || 'XML',
                items: parsed?.response?.body?.items?.item ?? null,
            };
        } catch {
            return { ok: false, msg: 'XML parse error', items: null };
        }
    }

    return { ok: false, msg: 'Unknown format', items: null };
}

async function fetchAptRentRaw(code5: string, ym: string) {
    const params = new URLSearchParams({
        serviceKey: SERVICE_KEY,
        LAWD_CD: code5,
        DEAL_YMD: ym,
        pageNo: '1',
        numOfRows: '10000',
        type: 'xml',
    });

    console.log(`[FETCH] ${code5} / ${ym}`);

    try {
        const res = await axios.get(API_URL, {
            responseType: 'arraybuffer',
            params,
            timeout: 15000,
        });

        const decoded = iconv.decode(res.data, 'utf-8');
        const { ok, msg, items } = await parseRtmsResponse(decoded);

        if (!ok) {
            console.warn(`[WARN] 비정상 응답 (${code5}/${ym}) → ${msg}`);
            console.warn('[RAW]', decoded.slice(0, 300), '...');
            return;
        }

        if (!items) {
            console.info(`[INFO] ${code5}/${ym} 거래 없음`);
            return;
        }

        const rows = Array.isArray(items) ? items : [items];

        let inserted = 0;
        for (const d of rows) {
            try {
                await sql`
          INSERT INTO oi.apt_deal_rent_raw (
            sggCd, umdNm, aptNm, jibun, excluUseAr,
            dealYear, dealMonth, dealDay, deposit, monthlyRent,
            floor, buildYear, contractTerm, contractType, useRRRight,
            preDeposit, preMonthlyRent, created_at, updated_at
          ) VALUES (
            ${d.sggCd ?? null}, ${d.umdNm ?? null}, ${d.aptNm ?? null}, ${d.jibun ?? null}, ${toFloat(d.excluUseAr)},
            ${toInt(d.dealYear)}, ${toInt(d.dealMonth)}, ${toInt(d.dealDay)}, ${toInt(d.deposit)}, ${toInt(d.monthlyRent)},
            ${toInt(d.floor)}, ${toInt(d.buildYear)}, ${d.contractTerm ?? null}, ${d.contractType ?? null}, ${d.useRRRight ?? null},
            ${toInt(d.preDeposit)}, ${toInt(d.preMonthlyRent)}, now(), now()
          )
          ON CONFLICT DO NOTHING
        `;
                inserted++;
            } catch (e: any) {
                console.error(`[ERROR] INSERT 실패 (${code5}/${ym}) → ${e?.message ?? e}`);
            }
        }

        console.log(`[OK] ${code5}/${ym} 저장: ${inserted}건`);
    } catch (e: any) {
        if (e?.response) {
            const body = iconv.decode(e.response.data, 'utf-8');
            console.error(`[FATAL] HTTP ${e.response.status} (${code5}/${ym})`);
            console.error('[BODY]', body.slice(0, 300), '...');
        } else {
            console.error(`[FATAL] 요청 실패 (${code5}/${ym}) → ${e?.message ?? e}`);
        }
    }
}

async function run() {
    await sql`SELECT 1`;
    console.log('[DEBUG] DB 연결 성공');

    const codes = await sql`
    SELECT DISTINCT SUBSTRING(code, 1, 5) AS lawd
    FROM oi.legal_dong
    WHERE sido = '서울특별시'
  `;
    const lawdList: string[] = codes.map((r: any) => r.lawd);

    const ymList: string[] = [];
    for (let d = dayjs('2025-01-01'); d.isSame(dayjs(), 'month') || d.isBefore(dayjs(), 'month'); d = d.add(1, 'month')) {
        ymList.push(d.format('YYYYMM'));
    }

    // ▶ 이미 저장된 조합 조회 (법정동5자리 + 연월)
    const existing = await sql`
    SELECT DISTINCT SUBSTRING(sggcd, 1, 5) || '_' || dealyear || LPAD(dealmonth::text, 2, '0') AS key
    FROM oi.apt_deal_rent_raw
  `;
    const existingKeys = new Set<string>(existing.map((r: any) => r.key));
    console.log('[DEBUG] 제외할 기존 키 수:', existingKeys.size);

    for (const code5 of lawdList) {
        for (const ym of ymList) {
            const key = `${code5}_${ym}`;
            const shouldFetch =
                RETRY_ONLY.size > 0 ? RETRY_ONLY.has(key) : !existingKeys.has(key);

            if (!shouldFetch) continue;

            await fetchAptRentRaw(code5, ym);
        }
    }

    await sql.end();
    console.log('[DONE]');
}

run().catch((e) => {
    console.error('[FATAL] run 실패:', e);
});
