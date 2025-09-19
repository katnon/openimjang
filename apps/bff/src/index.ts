// apps/bff/src/index.ts
import 'dotenv/config';
import { config } from 'dotenv';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from 'hono/bun';
import { db } from './lib/db';
import { searchRoute } from './routes/search';
import { sql } from "kysely";
import upisGeoRouter from './routes/geo/upis';
import buildings from './routes/geo/buildings';
import poi from './routes/poi';
// ⚠️ LEGACY Function Calling imports - 제거됨
// import apiAiToolsRoute from './routes/apiAiTools';
// import aiAskRoute from './routes/aiAsk';
// import aiHybridRoute from './routes/aiHybrid';

// 🎯 플래너 기반 AI 시스템
import aiChatRoute from './routes/aiChat';
// import plannerTestRoute from './routes/plannerTest';  // 구문 오류로 임시 주석
import chatBotRoute from './routes/chatBot';
import simpleAIRoute from './routes/simpleAI';
import aiSummaryRoute from './routes/aiSummary';
import embeddingRoute from './routes/embedding';
import swaggerRoute from './routes/swagger';
import { memoRoute } from './routes/memo';
import apartmentFullDataRoute from './routes/apartmentFullData';
import presetPointsRoute from './routes/presetPoints';
import uploadRoute from './routes/upload';


// 환경변수 명시적 로딩 확인
config();
console.log('🔑 OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('🔑 OpenAI API Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('💡 DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 20) + '...');

const app = new Hono();

// logger
app.use('*', logger());

// Body parsing 설정 - UTF-8 인코딩 보장
app.use('*', bodyLimit({
    maxSize: 50 * 1024 * 1024 // 50MB
}));

// UTF-8 인코딩 강제 설정 미들웨어
app.use('*', async (c, next) => {
    // 요청 헤더에 UTF-8 charset 강제 설정
    c.req.header('Content-Type')?.includes('application/json') && !c.req.header('Content-Type')?.includes('charset')
        && c.res.headers.set('Content-Type', 'application/json; charset=utf-8');

    await next();

    // 응답 헤더에 UTF-8 charset 강제 설정
    if (c.res.headers.get('Content-Type')?.includes('application/json') &&
        !c.res.headers.get('Content-Type')?.includes('charset')) {
        c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
    }
});

// 🔧 간소화된 인코딩 지원 미들웨어 (SafeBinaryJsonParser 사용 권장)
app.use('*', async (c, next) => {
    // Content-Type UTF-8 charset 강제 설정
    const contentType = c.req.header('Content-Type');
    if (contentType?.includes('application/json') && !contentType.includes('charset')) {
        c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
    }

    await next();

    // 응답 헤더 UTF-8 charset 보장
    const responseContentType = c.res.headers.get('Content-Type');
    if (responseContentType?.includes('application/json') && !responseContentType.includes('charset')) {
        c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
    }
});

// CORS 설정
app.use('*', cors({
    origin: process.env.CORS_ORIGIN || '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// 간단한 헬스체크 엔드포인트
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    });
});

// 라우트 등록
app.route('/api/search', searchRoute);
app.route('/api/poi', poi);
// ⚠️ LEGACY Function Calling 라우트들 - 플래너 시스템으로 대체됨
// app.route('/api/ai', aiRoute);
// app.route('/api/ai', apiAiToolsRoute);
// app.route('/api/ai', aiAskRoute);
// app.route('/api/ai', aiHybridRoute);

// 🎯 AI 시스템들 (순서 중요: chatBot이 먼저!)
app.route('/api/ai', chatBotRoute);  // 🧪 정상 작동하는 플래너 시스템 (우선순위)
app.route('/api/ai', simpleAIRoute);  // 🆕 단순하고 효과적인 제너럴 LLM 시스템
app.route('/api/ai', aiSummaryRoute);  // 🏠 확장카드 전용 아파트 종합 분석 시스템
// app.route('/api/ai', aiChatRoute);  // 🧠 LLM 라이프사이클 시스템 포함 (임시 비활성화)
// app.route('/api/planner', plannerTestRoute);  // 🧪 플래너 테스트 전용 - 구문 오류로 임시 주석
app.route('/api/embedding', embeddingRoute); // 🆕 임베딩 관리 라우터
app.route('/api/docs', swaggerRoute);   // 🆕 Swagger API 문서 라우터
app.route('/api/memo', memoRoute);    // 🆕 Firebase 메모 시스템 라우터
// app.route('/api/apartment', apartmentFullDataRoute); // 🆕 아파트 전체 정보 일괄 조회 라우터
app.route('/api/preset-points', presetPointsRoute); // 🆕 프리셋 포인트 시스템 라우터
app.route('/api/upload', uploadRoute); // 🆕 파일 업로드 시스템 라우터
app.route('/api', upisGeoRouter);
app.route('/api', buildings);

// 정적 파일 서빙 (업로드된 파일들)
app.use('/uploads/*', serveStatic({ root: './public' }));



// 헬스체크 + DB 테스트
app.get('/api/db/now', async (c) => {
    try {
        console.log('✅ DATABASE_URL:', process.env.DATABASE_URL);
        // 간단한 SQL 쿼리로 테스트
        const result = await sql<{ now: string }>`SELECT NOW() as now`.execute(db);
        const now = (result.rows[0] as any)?.now;
        return c.json({ now });
    } catch (e) {
        console.error('DB ERROR /api/db/now ->', e);
        return c.json({ ok: false, error: String(e) }, 500);
    }
});

// 서버 시작
const port = Number(process.env.PORT) || 8787;

console.log(`🚀 서버를 포트 ${port}에서 시작합니다...`);
console.log("CORS_ORIGIN =", process.env.CORS_ORIGIN);
export default {
    port,
    fetch: app.fetch,

};
