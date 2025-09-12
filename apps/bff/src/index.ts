// apps/bff/src/index.ts
import 'dotenv/config';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
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
import embeddingRoute from './routes/embedding';
import swaggerRoute from './routes/swagger';
import { memoRoute } from './routes/memo';
import apartmentFullDataRoute from './routes/apartmentFullData';

console.log('💡 ENV URL:', process.env.DATABASE_URL);

const app = new Hono();

// logger
app.use('*', logger());

// Body parsing 설정 - UTF-8 인코딩 보장
app.use('*', bodyLimit({
    maxSize: 50 * 1024 * 1024 // 50MB
}));

// CORS 설정
app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// 라우트 등록
app.route('/api/search', searchRoute);
app.route('/api/poi', poi);
// ⚠️ LEGACY Function Calling 라우트들 - 플래너 시스템으로 대체됨
// app.route('/api/ai', aiRoute);
// app.route('/api/ai', apiAiToolsRoute);
// app.route('/api/ai', aiAskRoute);
// app.route('/api/ai', aiHybridRoute);

// 🎯 플래너 기반 AI 시스템 (새로운 표준)
// app.route('/api/ai', aiChatRoute);  // 구문 오류로 임시 비활성화
app.route('/api/ai', chatBotRoute);  // 🧪 정상 작동하는 플래너 시스템
// app.route('/api/planner', plannerTestRoute);  // 🧪 플래너 테스트 전용 - 구문 오류로 임시 주석
app.route('/api/embedding', embeddingRoute); // 🆕 임베딩 관리 라우터
app.route('/api/docs', swaggerRoute);   // 🆕 Swagger API 문서 라우터
app.route('/api/memo', memoRoute);    // 🆕 Firebase 메모 시스템 라우터
// app.route('/api/apartment', apartmentFullDataRoute); // 🆕 아파트 전체 정보 일괄 조회 라우터
app.route('/api', upisGeoRouter);
app.route('/api', buildings);

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

export default app;
