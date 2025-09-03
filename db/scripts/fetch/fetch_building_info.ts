// 건축HUB 건축물대장 OpenAPI 호출 스크립트
// 총괄표제부(getBrRecapTitleInfo) + 표제부(getBrTitleInfo) 데이터 수집
import 'dotenv/config';
import axios from 'axios';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const RECAP_API_URL = 'http://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo';
const TITLE_API_URL = 'http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

const SERVICE_KEY = process.env.RTMS_API_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

const sql = postgres(DATABASE_URL, {
  max: 5,
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 10,
});

// API 응답 파싱 함수
async function parseApiResponse(decoded: string) {
  const txt = decoded.trim();

  if (txt.startsWith('{') || txt.startsWith('[')) {
    try {
      const j = JSON.parse(txt);
      // 건축HUB API는 response 래퍼 없이 바로 header가 옴
      const code = j?.header?.resultCode;
      const ok = code === '00' || code === '000';
      return {
        ok,
        msg: j?.header?.resultMsg || 'JSON',
        items: j?.body?.items?.item ?? null,
      };
    } catch {
      return { ok: false, msg: 'JSON parse error', items: null };
    }
  }

  if (txt.startsWith('<') || txt.startsWith('<?xml')) {
    try {
      const parsed = await xml2js.parseStringPromise(txt, { explicitArray: false });
      // 건축HUB API XML도 바로 response.header 구조
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

// 안전한 숫자 변환
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

// 날짜 변환 (YYYYMMDD → DATE)
function toDate(v: any): Date | null {
  if (!v || String(v).trim() === '') return null;
  const s = String(v).replace(/\D/g, ''); // 숫자만 추출
  if (s.length === 8) {
    const year = s.substring(0, 4);
    const month = s.substring(4, 6);
    const day = s.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }
  return null;
}

// PNU 파싱 함수 - 실제 길이 확인 후 처리
function parsePNU(pnu: string) {
  if (!pnu) {
    console.warn(`[WARN] PNU가 null 또는 빈값: ${pnu}`);
    return null;
  }

  console.log(`[DEBUG] PNU 파싱 시도: "${pnu}" (길이: ${pnu.length})`);

  if (pnu.length !== 19) {
    console.warn(`[WARN] PNU 길이 오류: ${pnu} (길이: ${pnu.length}, 예상: 19자리)`);
    return null;
  }

  // PNU 19자리 구조: 시도(2) + 시군구(3) + 읍면동(3) + 리(2) + 필지구분(1) + 본번(4) + 부번(4)  
  // 예시: 1168010300000120000
  //       11680 10300 0 0012 0000
  const sigunguCd = pnu.substring(0, 5);        // 시도(2) + 시군구(3) = 11680
  const bjdongCd = pnu.substring(5, 10);        // 읍면동(3) + 리(2) = 10300
  const pnuPlatGb = parseInt(pnu.substring(10, 11)); // PNU 필지구분: 1=일반대지, 2=산
  const platGbCd = String(pnuPlatGb - 1);       // API 변환: 0=대지, 1=산 (PNU-1)
  const bun = pnu.substring(11, 15);            // 본번(4자리) = 0012  
  const ji = pnu.substring(15, 19);             // 부번(4자리) = 0000

  return {
    sigunguCd,
    bjdongCd,
    platGbCd,
    bun,
    ji,
  };
}

// 총괄표제부 조회 및 저장 (페이지네이션 적용)
async function fetchBuildingRecap(aptId: number, pnu: string) {
  const pnuParams = parsePNU(pnu);
  if (!pnuParams) {
    console.error(`[SKIP] PNU 파싱 실패: ${pnu}`);
    return;
  }

  const { sigunguCd, bjdongCd, platGbCd, bun, ji } = pnuParams;
  console.log(`[RECAP] 총괄표제부 조회: aptId=${aptId}, PNU=${pnu}`);
  console.log(`[RECAP] 파싱된 파라미터: sigunguCd=${sigunguCd}, bjdongCd=${bjdongCd}, platGbCd=${platGbCd} (PNU:${pnu.substring(10, 11)}→API:${platGbCd}), bun=${bun}, ji=${ji}`);

  let pageNo = 1;
  let totalSaved = 0;
  const numOfRows = 1000;

  while (true) {
    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      sigunguCd,
      bjdongCd,
      platGbCd,
      bun,
      ji,
      numOfRows: numOfRows.toString(),
      pageNo: pageNo.toString(),
    });

    console.log(`[RECAP] 페이지 ${pageNo} 조회 중... (aptId=${aptId})`);
    console.log(`[DEBUG] API 요청 URL: ${RECAP_API_URL}?${params.toString()}`);

    try {
      const res = await axios.get(RECAP_API_URL, {
        responseType: 'arraybuffer',
        params,
        timeout: 15000,
      });

      const decoded = iconv.decode(res.data, 'utf-8');
      const { ok, msg, items } = await parseApiResponse(decoded);

      console.log(`[DEBUG] 총괄표제부 응답: OK=${ok}, MSG=${msg}, items=${items ? (Array.isArray(items) ? items.length : 1) : 0}개`);

      if (!ok) {
        console.warn(`[WARN] 총괄표제부 비정상 응답 (aptId=${aptId}, 페이지=${pageNo}) → ${msg}`);
        break;
      }

      if (!items) {
        console.info(`[INFO] 총괄표제부 데이터 없음 (aptId=${aptId}, 페이지=${pageNo})`);
        break;
      }

      const dataArray = Array.isArray(items) ? items : [items];
      let pageSaved = 0;

      for (const data of dataArray) {
        // 총괄표제부 필드 매핑 및 저장
        await saveToDb(aptId, 'recap', {
          dongNm: null, // 총괄에는 동명칭 없음
          bldNm: data.bldNm || null,                    // 건물명
          platPlc: data.platPlc || null,                // 대지위치  
          platArea: toFloat(data.platArea),             // 대지면적
          archArea: toFloat(data.archArea),             // 건축면적
          totArea: toFloat(data.totArea),               // 연면적
          grndFlrCnt: toInt(data.grndFlrCnt),           // 지상층수
          ugrndFlrCnt: toInt(data.ugrndFlrCnt),         // 지하층수
          mainPurpsCdNm: data.mainPurpsCdNm || null,    // 주용도명
          strctCdNm: data.strctCdNm || null,            // 구조
          roofCdNm: data.roofCdNm || null,              // 지붕구조
          hhldCnt: toInt(data.hhldCnt),                 // 세대수 (총괄)
          mainBldCnt: toInt(data.mainBldCnt),           // 주건축물수 (총괄)
          atchBldCnt: toInt(data.atchBldCnt),           // 부속건축물수 (총괄)  
          totPkngCnt: toInt(data.totPkngCnt),           // 총주차수 (총괄)
          useAprDay: toDate(data.useAprDay),            // 사용승인일
          raw_data: data, // 원본 데이터
        });
        pageSaved++;
      }

      totalSaved += pageSaved;
      console.log(`[OK] 총괄표제부 페이지 ${pageNo} 저장: ${pageSaved}건 (aptId=${aptId})`);

      // 다음 페이지가 있는지 확인 (현재 페이지가 1000건 미만이면 마지막 페이지)
      if (dataArray.length < numOfRows) {
        console.log(`[INFO] 총괄표제부 마지막 페이지 도달 (aptId=${aptId})`);
        break;
      }

      pageNo++;

      // API 호출 간격 (Rate Limiting 방지)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (e: any) {
      if (e?.response) {
        const body = iconv.decode(e.response.data, 'utf-8');
        console.error(`[FATAL] 총괄표제부 HTTP ${e.response.status} (aptId=${aptId}, 페이지=${pageNo})`);
        console.error('[BODY]', body.slice(0, 300), '...');
      } else {
        console.error(`[FATAL] 총괄표제부 요청 실패 (aptId=${aptId}, 페이지=${pageNo}) → ${e?.message ?? e}`);
      }
      break;
    }
  }

  console.log(`[COMPLETE] 총괄표제부 수집 완료: 총 ${totalSaved}건 저장 (aptId=${aptId})`);
}

// 표제부 조회 및 저장 (페이지네이션 적용)
async function fetchBuildingTitle(aptId: number, pnu: string) {
  const pnuParams = parsePNU(pnu);
  if (!pnuParams) {
    console.error(`[SKIP] PNU 파싱 실패: ${pnu}`);
    return;
  }

  const { sigunguCd, bjdongCd, platGbCd, bun, ji } = pnuParams;
  console.log(`[TITLE] 표제부 조회: aptId=${aptId}, PNU=${pnu}`);
  console.log(`[TITLE] 파싱된 파라미터: sigunguCd=${sigunguCd}, bjdongCd=${bjdongCd}, platGbCd=${platGbCd} (PNU:${pnu.substring(10, 11)}→API:${platGbCd}), bun=${bun}, ji=${ji}`);

  let pageNo = 1;
  let totalSaved = 0;
  const numOfRows = 1000;

  while (true) {
    const params = new URLSearchParams({
      serviceKey: SERVICE_KEY,
      sigunguCd,
      bjdongCd,
      platGbCd,
      bun,
      ji,
      numOfRows: numOfRows.toString(),
      pageNo: pageNo.toString(),
    });

    console.log(`[TITLE] 페이지 ${pageNo} 조회 중... (aptId=${aptId})`);

    try {
      const res = await axios.get(TITLE_API_URL, {
        responseType: 'arraybuffer',
        params,
        timeout: 15000,
      });

      const decoded = iconv.decode(res.data, 'utf-8');
      const { ok, msg, items } = await parseApiResponse(decoded);

      console.log(`[DEBUG] 표제부 응답: OK=${ok}, MSG=${msg}, items=${items ? (Array.isArray(items) ? items.length : 1) : 0}개`);

      if (!ok) {
        console.warn(`[WARN] 표제부 비정상 응답 (aptId=${aptId}, 페이지=${pageNo}) → ${msg}`);
        break;
      }

      if (!items) {
        console.info(`[INFO] 표제부 데이터 없음 (aptId=${aptId}, 페이지=${pageNo})`);
        break;
      }

      const dataArray = Array.isArray(items) ? items : [items];
      let pageSaved = 0;

      for (const data of dataArray) {
        // 표제부 필드 매핑 및 저장
        await saveToDb(aptId, 'title', {
          dongNm: data.dongNm || null,                  // 동명칭 (표제부만 해당)
          bldNm: data.bldNm || null,                    // 건물명
          platPlc: data.platPlc || null,                // 대지위치
          platArea: toFloat(data.platArea),             // 대지면적
          archArea: toFloat(data.archArea),             // 건축면적
          totArea: toFloat(data.totArea),               // 연면적
          grndFlrCnt: toInt(data.grndFlrCnt),           // 지상층수
          ugrndFlrCnt: toInt(data.ugrndFlrCnt),         // 지하층수
          mainPurpsCdNm: data.mainPurpsCdNm || null,    // 주용도명
          strctCdNm: data.strctCdNm || null,            // 구조
          roofCdNm: data.roofCdNm || null,              // 지붕구조
          hhldCnt: null,                                // 표제부에는 세대수 없음
          mainBldCnt: null,                             // 표제부에는 주건축물수 없음
          atchBldCnt: null,                             // 표제부에는 부속건축물수 없음
          totPkngCnt: null,                             // 표제부에는 총주차수 없음
          useAprDay: toDate(data.useAprDay),            // 사용승인일
          raw_data: data, // 원본 데이터
        });
        pageSaved++;
      }

      totalSaved += pageSaved;
      console.log(`[OK] 표제부 페이지 ${pageNo} 저장: ${pageSaved}건 (aptId=${aptId})`);

      // 다음 페이지가 있는지 확인 (현재 페이지가 1000건 미만이면 마지막 페이지)
      if (dataArray.length < numOfRows) {
        console.log(`[INFO] 표제부 마지막 페이지 도달 (aptId=${aptId})`);
        break;
      }

      pageNo++;

      // API 호출 간격 (Rate Limiting 방지)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (e: any) {
      if (e?.response) {
        const body = iconv.decode(e.response.data, 'utf-8');
        console.error(`[FATAL] 표제부 HTTP ${e.response.status} (aptId=${aptId}, 페이지=${pageNo})`);
        console.error('[BODY]', body.slice(0, 300), '...');
      } else {
        console.error(`[FATAL] 표제부 요청 실패 (aptId=${aptId}, 페이지=${pageNo}) → ${e?.message ?? e}`);
      }
      break;
    }
  }

  console.log(`[COMPLETE] 표제부 수집 완료: 총 ${totalSaved}건 저장 (aptId=${aptId})`);
}

// DB 저장 함수
async function saveToDb(aptId: number, type: 'recap' | 'title', data: any) {
  try {
    console.log(`[DEBUG] DB 저장 시도: aptId=${aptId}, type=${type}, dongNm=${data.dongNm || 'null'}`);

    const result = await sql`
      INSERT INTO oi.apt_building_info (
        apt_id, type, dongNm, bldNm, platPlc, platArea, archArea, totArea,
        grndFlrCnt, ugrndFlrCnt, mainPurpsCdNm, strctCdNm, roofCdNm,
        hhldCnt, mainBldCnt, atchBldCnt, totPkngCnt, useAprDay, raw_data
      ) VALUES (
        ${aptId}, ${type}, ${data.dongNm}, ${data.bldNm}, ${data.platPlc},
        ${data.platArea}, ${data.archArea}, ${data.totArea}, ${data.grndFlrCnt},
        ${data.ugrndFlrCnt}, ${data.mainPurpsCdNm}, ${data.strctCdNm}, ${data.roofCdNm},
        ${data.hhldCnt}, ${data.mainBldCnt}, ${data.atchBldCnt}, ${data.totPkngCnt},
        ${data.useAprDay}, ${JSON.stringify(data.raw_data)}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    if (result.length > 0) {
      console.log(`[SUCCESS] DB 저장 성공: aptId=${aptId}, type=${type}, dongNm=${data.dongNm || 'null'}`);
    } else {
      console.log(`[INFO] 중복 데이터로 스킵: aptId=${aptId}, type=${type}, dongNm=${data.dongNm || 'null'}`);
    }

  } catch (e: any) {
    console.error(`[ERROR] DB 저장 실패 (aptId=${aptId}, type=${type}, dongNm=${data.dongNm || 'null'}) → ${e?.message ?? e}`);
    console.error(`[ERROR] 저장하려던 데이터:`, JSON.stringify(data, null, 2));
    throw e;
  }
}

// 이미 수집된 아파트인지 확인
async function isAlreadyFetched(aptId: number): Promise<boolean> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM oi.apt_building_info 
      WHERE apt_id = ${aptId}
    `;

    const count = parseInt(result[0].count);
    return count > 0;
  } catch (e: any) {
    console.error(`[ERROR] 중복 확인 실패 (aptId=${aptId}): ${e?.message ?? e}`);
    return false; // 에러 시 수집 시도
  }
}

// PNU를 통해 아파트 정보 조회 함수
async function getAptWithPNU(aptId: number) {
  try {
    const pnuResult = await sql`
      SELECT a1 AS pnu
      FROM public.al_d002_11_20250804
      WHERE ST_Intersects(
        geom,
        ST_Transform(ST_SetSRID(ST_Point(
          (SELECT lon FROM oi.apt_info WHERE id = ${aptId}),
          (SELECT lat FROM oi.apt_info WHERE id = ${aptId})
        ), 4326), 5186)
      )
      LIMIT 1
    `;

    const pnuRow = pnuResult[0];
    if (!pnuRow || !pnuRow.pnu) {
      console.warn(`[WARN] PNU 없음 (aptId=${aptId})`);
      return null;
    }

    return pnuRow.pnu;
  } catch (e: any) {
    console.error(`[ERROR] PNU 조회 실패 (aptId=${aptId}): ${e?.message ?? e}`);
    return null;
  }
}

// 실행 진입점
async function run() {
  await sql`SELECT 1`;
  console.log('[DEBUG] DB 연결 성공');

  // 환경변수로 실행 옵션 제어
  const TARGET_APT_ID = process.env.TARGET_APT_ID ? parseInt(process.env.TARGET_APT_ID) : null;
  const BATCH_SIZE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 100;
  const MAX_TOTAL = process.env.MAX_TOTAL ? parseInt(process.env.MAX_TOTAL) : 10000;
  const FORCE_REFETCH = process.env.FORCE_REFETCH === 'true';

  // 로그 파일 설정
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const logDir = path.join(__dirname, 'logs');
  const failureLogFile = path.join(logDir, `building_failures_${timestamp}.txt`);

  // logs 디렉토리 생성
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 로그 파일 초기화
  fs.writeFileSync(failureLogFile, `건축물 정보 수집 실패/스킵 로그 - ${new Date().toLocaleString('ko-KR')}\n`);
  fs.appendFileSync(failureLogFile, `==========================================================\n\n`);

  let aptList;
  if (TARGET_APT_ID) {
    console.log(`[INFO] 특정 아파트만 처리: aptId=${TARGET_APT_ID}`);
    aptList = await sql`
      SELECT id, apt_nm, jibun_address 
      FROM oi.apt_info 
      WHERE id = ${TARGET_APT_ID}
      LIMIT 1
    `;
  } else {
    console.log(`[INFO] 전체 아파트 처리${MAX_TOTAL ? ` (최대 ${MAX_TOTAL}개)` : ''}`);

    if (MAX_TOTAL) {
      aptList = await sql`
        SELECT id, apt_nm, jibun_address 
        FROM oi.apt_info 
        WHERE jibun_address IS NOT NULL
        ORDER BY id
        LIMIT ${MAX_TOTAL}
      `;
    } else {
      aptList = await sql`
        SELECT id, apt_nm, jibun_address 
        FROM oi.apt_info 
        WHERE jibun_address IS NOT NULL
        ORDER BY id
      `;
    }
  }

  const totalCount = aptList.length;
  console.log(`[INFO] 처리할 아파트: ${totalCount}개`);
  console.log(`[INFO] 배치 크기: ${BATCH_SIZE}, 강제 재수집: ${FORCE_REFETCH}`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // 배치 단위로 처리
  for (let i = 0; i < totalCount; i += BATCH_SIZE) {
    const batch = aptList.slice(i, Math.min(i + BATCH_SIZE, totalCount));

    console.log(`\n[BATCH] ${i + 1}~${Math.min(i + BATCH_SIZE, totalCount)} / ${totalCount} 처리 중...`);

    for (const apt of batch) {
      const { id: aptId, apt_nm: aptName, jibun_address: jibunAddress } = apt;

      console.log(`\n[${processed + skipped + failed + 1}/${totalCount}] ${aptName} (aptId=${aptId})`);

      // 중복 확인 (강제 재수집 모드가 아닌 경우)
      if (!FORCE_REFETCH) {
        const alreadyFetched = await isAlreadyFetched(aptId);
        if (alreadyFetched) {
          console.log(`[SKIP] 이미 수집됨 (aptId=${aptId})`);

          // 로그 파일에 스킵 기록
          fs.appendFileSync(failureLogFile, `[SKIP] 이미 수집됨\n`);
          fs.appendFileSync(failureLogFile, `- aptId: ${aptId}\n`);
          fs.appendFileSync(failureLogFile, `- 아파트명: ${aptName}\n`);
          fs.appendFileSync(failureLogFile, `- 지번주소: ${jibunAddress}\n`);
          fs.appendFileSync(failureLogFile, `- 시간: ${new Date().toLocaleString('ko-KR')}\n`);
          fs.appendFileSync(failureLogFile, `- 재실행 명령어: TARGET_APT_ID=${aptId} FORCE_REFETCH=true bun run fetch_building_info.ts\n\n`);

          skipped++;
          continue;
        }
      }

      // PNU 조회
      const pnu = await getAptWithPNU(aptId);
      if (!pnu) {
        console.error(`[SKIP] PNU 조회 실패 (aptId=${aptId})`);

        // 로그 파일에 실패 기록
        fs.appendFileSync(failureLogFile, `[FAILED] PNU 조회 실패\n`);
        fs.appendFileSync(failureLogFile, `- aptId: ${aptId}\n`);
        fs.appendFileSync(failureLogFile, `- 아파트명: ${aptName}\n`);
        fs.appendFileSync(failureLogFile, `- 지번주소: ${jibunAddress}\n`);
        fs.appendFileSync(failureLogFile, `- 실패 원인: 좌표로 PNU를 찾을 수 없음\n`);
        fs.appendFileSync(failureLogFile, `- 시간: ${new Date().toLocaleString('ko-KR')}\n`);
        fs.appendFileSync(failureLogFile, `- 재실행 명령어: TARGET_APT_ID=${aptId} bun run fetch_building_info.ts\n\n`);

        failed++;
        continue;
      }

      console.log(`[INFO] PNU: ${pnu}`);

      try {
        // 총괄표제부 조회
        await fetchBuildingRecap(aptId, pnu);

        // 표제부 조회  
        await fetchBuildingTitle(aptId, pnu);

        processed++;
        console.log(`[SUCCESS] 처리 완료 (aptId=${aptId})`);

      } catch (e: any) {
        console.error(`[ERROR] ${aptName} 처리 실패: ${e?.message ?? e}`);

        // 로그 파일에 실패 기록
        fs.appendFileSync(failureLogFile, `[FAILED] API 호출 실패\n`);
        fs.appendFileSync(failureLogFile, `- aptId: ${aptId}\n`);
        fs.appendFileSync(failureLogFile, `- 아파트명: ${aptName}\n`);
        fs.appendFileSync(failureLogFile, `- 지번주소: ${jibunAddress}\n`);
        fs.appendFileSync(failureLogFile, `- PNU: ${pnu}\n`);
        fs.appendFileSync(failureLogFile, `- 실패 원인: ${e?.message ?? e}\n`);
        fs.appendFileSync(failureLogFile, `- 시간: ${new Date().toLocaleString('ko-KR')}\n`);
        fs.appendFileSync(failureLogFile, `- 재실행 명령어: TARGET_APT_ID=${aptId} bun run fetch_building_info.ts\n\n`);

        failed++;
      }

      // API 호출 간격 (Rate Limiting 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 배치 완료 시 진행 상황 출력
    const batchProgress = Math.min(i + BATCH_SIZE, totalCount);
    const percentage = Math.round((batchProgress / totalCount) * 100);
    console.log(`\n[BATCH COMPLETE] ${batchProgress}/${totalCount} (${percentage}%) - 성공: ${processed}, 스킵: ${skipped}, 실패: ${failed}`);
  }

  await sql.end();
  console.log('\n[FINAL] 건축물대장 수집 완료');
  console.log(`[STATS] 총 ${totalCount}개 - 성공: ${processed}, 스킵: ${skipped}, 실패: ${failed}`);

  // 최종 요약을 로그 파일에 기록
  fs.appendFileSync(failureLogFile, `==========================================================\n`);
  fs.appendFileSync(failureLogFile, `최종 실행 결과 - ${new Date().toLocaleString('ko-KR')}\n`);
  fs.appendFileSync(failureLogFile, `==========================================================\n`);
  fs.appendFileSync(failureLogFile, `총 처리 대상: ${totalCount}개\n`);
  fs.appendFileSync(failureLogFile, `성공: ${processed}개\n`);
  fs.appendFileSync(failureLogFile, `스킵: ${skipped}개\n`);
  fs.appendFileSync(failureLogFile, `실패: ${failed}개\n\n`);

  if (failed > 0 || skipped > 0) {
    fs.appendFileSync(failureLogFile, `💡 재실행 방법:\n`);
    fs.appendFileSync(failureLogFile, `1. 전체 재실행 (강제): FORCE_REFETCH=true bun run fetch_building_info.ts\n`);
    fs.appendFileSync(failureLogFile, `2. 특정 아파트만: TARGET_APT_ID=[아파트ID] bun run fetch_building_info.ts\n`);
    fs.appendFileSync(failureLogFile, `3. 실패한 것만 재시도: 위의 개별 재실행 명령어들 참고\n`);
  }

  console.log(`\n[LOG] 실패/스킵 로그 저장됨: ${failureLogFile}`);
}

// 스크립트 실행
run().catch((e) => {
  console.error('[FATAL] run 실패:', e);
  process.exit(1);
});