// apps/bff/src/index.ts
import 'dotenv/config';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { db } from './lib/db';
import { searchRoute } from './routes/search';
import { sql } from "kysely";
import upisGeoRouter from './routes/geo/upis';
import buildings from './routes/geo/buildings';
import poi from './routes/poi';
// import { aiRoute } from './routes/ai';  // ⚠️ LEGACY - 새로운 AI 모듈로 대체됨
import apiAiToolsRoute from './routes/apiAiTools';
import aiChatRoute from './routes/aiChat';
import aiAskRoute from './routes/aiAsk';
import aiHybridRoute from './routes/aiHybrid';
import embeddingRoute from './routes/embedding';
import swaggerRoute from './routes/swagger';
import { memoRoute } from './routes/memo';
import apartmentFullDataRoute from './routes/apartmentFullData';

console.log('💡 ENV URL:', process.env.DATABASE_URL);

const app = new Hono();

// logger
app.use('*', logger());

// CORS 설정
app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// 라우트 등록
app.route('/api/search', searchRoute);
app.route('/api/poi', poi);
// app.route('/api/ai', aiRoute);  // ⚠️ LEGACY - 새로운 AI 모듈로 대체됨
app.route('/api/ai', apiAiToolsRoute);  // AI Functions 전용 라우터
app.route('/api/ai-new', aiChatRoute);  // 새로운 표준 패턴 테스트용
app.route('/api/ai', aiAskRoute);       // 🆕 RAG 기반 질의응답 라우터
app.route('/api/ai', aiHybridRoute);    // 🆕 하이브리드 RAG+Functions 라우터
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
