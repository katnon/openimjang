import 'dotenv/config'; // 맨 위에 위치
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
console.log('💡 ENV URL:', process.env.DATABASE_URL);

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('❌ DATABASE_URL is missing');
    throw new Error('DATABASE_URL is missing');
}

const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: url }),
});

export const db = new Kysely<any>({
    dialect,
});


