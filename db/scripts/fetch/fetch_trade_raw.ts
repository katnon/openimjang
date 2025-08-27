// 최종 버전: 중복방지 + 실패항목만 재시도 + 안전 파서
import 'dotenv/config';
import axios from 'axios';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import postgres from 'postgres';
import dayjs from 'dayjs';

const API_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

const SERVICE_KEY = process.env.RTMS_API_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

const RETRY_ONLY = new Set([
  // 실패했던 코드/연월 → "법정동코드_연월" 형식으로 명시
  '11230_202503',
]);

const sql = postgres(DATABASE_URL, {
  max: 5,
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 10,
});

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

async function fetchAptTradeRaw(code5: string, ym: string) {
  const params = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    LAWD_CD: code5,
    DEAL_YMD: ym,
    pageNo: '1',
    numOfRows: '1000',
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
          INSERT INTO oi.apt_deal_trade_raw (
            sggCd, umdCd, landCd, bonbun, bubun,
            roadNm, roadNmSggCd, roadNmCd, roadNmSeq, roadNmbCd,
            roadNmBonbun, roadNmBubun, umdNm, aptNm, jibun,
            excluUseAr, dealYear, dealMonth, dealDay, dealAmount,
            floor, buildYear, aptSeq, cdealType, cdealDay,
            dealingGbn, estateAgentSggNm, rgstDate, aptDong,
            slerGbn, buyerGbn, landLeaseholdGbn, created_at, updated_at
          ) VALUES (
            ${d.sggCd ?? null}, ${d.umdCd ?? null}, ${d.landCd ?? null},
            ${d.bonbun ?? null}, ${d.bubun ?? null}, ${d.roadNm ?? null},
            ${d.roadNmSggCd ?? null}, ${d.roadNmCd ?? null},
            ${d.roadNmSeq ?? null}, ${d.roadNmbCd ?? null},
            ${d.roadNmBonbun ?? null}, ${d.roadNmBubun ?? null},
            ${d.umdNm ?? null}, ${d.aptNm ?? null}, ${d.jibun ?? null},
            ${toFloat(d.excluUseAr)}, ${toInt(d.dealYear)}, ${toInt(d.dealMonth)}, ${toInt(d.dealDay)},
            ${toInt(d.dealAmount)}, ${toInt(d.floor)}, ${toInt(d.buildYear)},
            ${d.aptSeq ?? null}, ${d.cdealType ?? null}, ${d.cdealDay ?? null},
            ${d.dealingGbn ?? null}, ${d.estateAgentSggNm ?? null}, ${d.rgstDate ?? null},
            ${d.aptDong ?? null}, ${d.slerGbn ?? null}, ${d.buyerGbn ?? null},
            ${d.landLeaseholdGbn ?? null}, now(), now()
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
  for (
    let d = dayjs('2025-01-01');
    d.isSame(dayjs(), 'month') || d.isBefore(dayjs(), 'month');
    d = d.add(1, 'month')
  ) {
    ymList.push(d.format('YYYYMM'));
  }

  // ▶ 이미 저장된 (법정동코드 + 연월) 조합 가져오기
  const existing = await sql`
    SELECT DISTINCT SUBSTRING(umdcd, 1, 5) || '_' || dealyear || LPAD(dealmonth::text, 2, '0') AS key
    FROM oi.apt_deal_trade_raw
  `;
  const existingKeys = new Set<string>(existing.map((r: any) => r.key));

  console.log('[DEBUG] 제외할 기존 키 수:', existingKeys.size);

  for (const code5 of lawdList) {
    for (const ym of ymList) {
      const key = `${code5}_${ym}`;
      const shouldFetch =
        RETRY_ONLY.size > 0 ? RETRY_ONLY.has(key) : !existingKeys.has(key);

      if (!shouldFetch) {
        continue;
      }

      await fetchAptTradeRaw(code5, ym);
    }
  }

  await sql.end();
  console.log('[DONE]');
}

run().catch((e) => {
  console.error('[FATAL] run 실패:', e);
});
