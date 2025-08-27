// apps/bff/src/index.ts
import 'dotenv/config';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { db } from './lib/db';
import { searchRoute } from './routes/search';
import { sql } from "kysely";
import vworld from './routes/vworld'; // ✅ 추가

console.log('💡 ENV URL:', process.env.DATABASE_URL);

const app = new Hono();

// logger
app.use('*', logger());

// CORS 설정
app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// 라우트 등록
app.route('/api/search', searchRoute);
app.route('/api/vworld', vworld); // ✅ 추가

// 헬스체크 + DB 테스트
app.get('/api/db/now', async (c) => {
    try {
        console.log('✅ DATABASE_URL:', process.env.DATABASE_URL);
        // 간단한 SQL 쿼리로 테스트
        const result = await db.execute(sql`SELECT NOW() as now`);
        return c.json({ now: result.rows[0]?.now });
    } catch (e) {
        console.error('DB ERROR /api/db/now ->', e);
        return c.json({ ok: false, error: String(e) }, 500);
    }
});

export default app;
