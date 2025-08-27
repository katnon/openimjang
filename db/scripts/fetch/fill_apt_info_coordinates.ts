import 'dotenv/config';
import postgres from 'postgres';
import axios from 'axios';

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

if (!KAKAO_API_KEY || !DATABASE_URL) {
  console.error('❌ .env에 KAKAO_REST_API_KEY, DATABASE_URL이 설정되어야 합니다.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  prepare: false,
  idle_timeout: 10,
  connect_timeout: 10,
});

async function fetchCoordinateFromKakao(query: string): Promise<{ lon: number; lat: number } | null> {
  try {
    const res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query },
      headers: {
        Authorization: `KakaoAK ${KAKAO_API_KEY}`,
      },
    });

    const documents = res.data?.documents;
    if (documents?.length > 0) {
      const { x, y } = documents[0];
      return { lon: parseFloat(x), lat: parseFloat(y) };
    }
  } catch (e: any) {
    console.warn(`[WARN] ${query} → 요청 실패: ${e?.message ?? e}`);
  }
  return null;
}

async function run() {
  await sql`SELECT 1`;
  console.log('[DEBUG] DB 연결 성공');

  // ⬇️ apt_dong 관련 조건 제거
  const rows = await sql`
    SELECT id, jibun_address
    FROM oi.apt_info
    WHERE jibun_address IS NOT NULL
      AND lon IS NULL
      AND lat IS NULL
    ORDER BY id ASC
  `;

  console.log(`[INFO] 좌표 채울 후보 건수: ${rows.length}`);

  for (const row of rows) {
    const { id, jibun_address } = row;
    console.log(`[FETCH] (${id}) → ${jibun_address}`);

    const coord = await fetchCoordinateFromKakao(jibun_address);
    if (coord) {
      await sql`
        UPDATE oi.apt_info
        SET lon = ${coord.lon}, lat = ${coord.lat}, updated_at = now()
        WHERE id = ${id}
      `;
      console.log(`[OK] → ${coord.lon}, ${coord.lat}`);
    } else {
      console.log(`[SKIP] 좌표 검색 실패`);
    }
  }

  await sql.end();
  console.log('[DONE]');
}

run().catch((e) => {
  console.error('[FATAL] 실행 실패:', e);
});
