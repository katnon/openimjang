// 벡터 검색 테스트 스크립트
import "dotenv/config";
import OpenAI from 'openai';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
const sql = postgres(DB_URL!, { max: 5, prepare: false, idle_timeout: 10 });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const toVec = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;

async function testSearch() {
    const query = "oi 스키마의 apt_deal_trade_raw 주요 컬럼과 의미를 요약해줘";
    
    console.log('🔍 질의:', query);
    console.log('🔄 임베딩 생성 중...');
    
    const emb = await openai.embeddings.create({ 
        model: 'text-embedding-3-small', 
        input: query 
    });
    const vec = toVec(emb.data[0].embedding);
    
    console.log('✅ 임베딩 완료, 벡터 검색 수행 중...');
    
    const rows = await sql`
        SELECT id, schema_name, table_name, chunk_id,
               LEFT(content_text, 200) as content_preview,
               1 - (embedding <=> ${vec}::vector) AS score
        FROM ai.embeddings
        ORDER BY embedding <=> ${vec}::vector
        LIMIT 5;
    `;
    
    console.log('\n📊 검색 결과:');
    rows.forEach((row: any, idx: number) => {
        console.log(`\n[${idx + 1}] Score: ${row.score.toFixed(4)}`);
        console.log(`    Schema: ${row.schema_name}, Table: ${row.table_name}`);
        console.log(`    ChunkID: ${row.chunk_id}`);
        console.log(`    Content: ${row.content_preview}...`);
    });
    
    await sql.end();
}

testSearch().catch(console.error);