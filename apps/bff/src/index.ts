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
import { aiRoute } from './routes/ai';

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
app.route('/api/ai', aiRoute);
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
