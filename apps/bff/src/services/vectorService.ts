// apps/bff/src/services/vectorService.ts
// pgvector 백엔드 기본, (원하면 나중에 Pinecone 분기 추가)

// dotenv (루트에서 실행 시도 대비)
import "dotenv/config";
import postgres from "postgres";
import OpenAI from "openai";

export type DocumentHit = {
    id: string;
    content: string;
    metadata: {
        source: string;
        type: "schema_doc" | "user_memo" | "domain_knowledge";
        score: number;
        schema_name?: string | null;
        table_name?: string | null;
    };
};
export type SearchOptions = {
    topK?: number;
    userId?: string;
    filter?: { schema?: string; table?: string };
};

const EMB_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const DB_URL = process.env.DATABASE_URL; // .env.ai.read/ .env.ai.write 중 실행 시 주입
const sql = DB_URL ? postgres(DB_URL, { max: 5, prepare: false, idle_timeout: 10 }) : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const toVec = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;

async function pgSearch(query: string, { topK = 8, filter }: SearchOptions = {}): Promise<DocumentHit[]> {
    if (!sql) throw new Error("DATABASE_URL not set for pgvector search");
    
    console.log('🔍 pgSearch 시작:', { query: query.slice(0, 50), topK, filter });
    
    // 1) 질의 임베딩
    const emb = await openai.embeddings.create({ model: EMB_MODEL, input: query });
    const vec = toVec(emb.data[0].embedding as unknown as number[]);
    
    console.log('✅ 임베딩 생성 완료, vec 길이:', vec.length);

    // 2) pgvector KNN (코사인 유사도)
    const where: any[] = [];
    if (filter?.schema) where.push(sql`schema_name = ${filter.schema}`);
    if (filter?.table) where.push(sql`table_name = ${filter.table}`);

    console.log('🔄 SQL 쿼리 실행 중...');
    
    const rows = await sql/* sql */`
    SELECT id, source_path, schema_name, table_name, chunk_id,
           content_text,
           1 - (embedding <=> ${vec}::vector) AS score
    FROM ai.embeddings
    ${where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``}
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${topK};
  `;
  
    console.log('📊 SQL 결과:', { rowCount: rows.length });

    return rows.map((r: any) => ({
        id: String(r.id),
        content: r.content_text,
        metadata: {
            source: r.source_path,
            type: "schema_doc",
            score: Number(r.score),
            schema_name: r.schema_name,
            table_name: r.table_name,
        },
    }));
}

export const vectorService = {
    async search(query: string, opts: SearchOptions = {}) {
        // 지금은 pgvector 모드 고정 (Pinecone 키가 있어도 우선 pgvector 사용)
        return pgSearch(query, opts);
    },
};
