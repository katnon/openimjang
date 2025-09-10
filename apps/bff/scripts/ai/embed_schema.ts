// scripts/ai/embed_schema.ts
// 목적: 스키마 DDL + per-table 상세 텍스트를 청킹하여 OpenAI 임베딩 → ai.embeddings UPSERT
// 실행: bunx tsx scripts/ai/embed_schema.ts
import "dotenv/config"; // CWD의 .env를 강제로 로드
import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { OpenAI } from "openai";
import { globby } from "globby";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const DATABASE_URL = process.env.DATABASE_URL!;

if (!OPENAI_API_KEY || !DATABASE_URL) {
    console.error("❌ .env에 OPENAI_API_KEY, DATABASE_URL이 필요합니다.");
    process.exit(1);
}

const sql = postgres(DATABASE_URL, {
    max: 5,
    prepare: false,
    idle_timeout: 10,
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/** 간단 청킹: 문단 기준으로 800~1500자 내로 합치기 */
function chunkText(raw: string, min = 800, max = 1500): string[] {
    const paras = raw
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/) // 빈 줄 기준 문단
        .map((s) => s.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let buf: string[] = [];
    let len = 0;
    for (const p of paras) {
        if (len + p.length + 1 > max && buf.length > 0) {
            // flush
            chunks.push(buf.join("\n\n"));
            buf = [];
            len = 0;
        }
        buf.push(p);
        len += p.length + 2;
        if (len >= min) {
            chunks.push(buf.join("\n\n"));
            buf = [];
            len = 0;
        }
    }
    if (buf.length) chunks.push(buf.join("\n\n"));
    // 너무 긴 줄(예: DDL)의 경우 안전 절단
    const final: string[] = [];
    for (const c of chunks) {
        if (c.length <= max) {
            final.push(c);
        } else {
            for (let i = 0; i < c.length; i += max) final.push(c.slice(i, i + max));
        }
    }
    return final;
}

/** 파일명에서 스키마/테이블 추출 (예: public.apt_info.txt) */
function parseSchemaTableFromFilename(file: string) {
    const base = path.basename(file);
    const m = base.match(/^([^.]+)\.([^.]+)\.txt$/);
    if (!m) return { schema_name: null as string | null, table_name: null as string | null, object_name: base };
    return { schema_name: m[1], table_name: m[2], object_name: `${m[1]}.${m[2]}` };
}

/** 벡터 리터럴 문자열로 포맷 (예: "[0.1,0.2,...]") */
function toVectorLiteral(v: number[]) {
    return `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

/** 임베딩 계산 */
async function embed(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    });
    return res.data[0].embedding as unknown as number[];
}

/** UPSERT */
async function upsertEmbedding(params: {
    source_path: string;
    schema_name: string | null;
    table_name: string | null;
    object_name: string | null;
    chunk_id: number;
    content_text: string;
    token_count: number | null;
    embeddingVec: number[];
    meta?: any;
}) {
    const {
        source_path,
        schema_name,
        table_name,
        object_name,
        chunk_id,
        content_text,
        token_count,
        embeddingVec,
        meta,
    } = params;
    const vecStr = toVectorLiteral(embeddingVec);

    await sql/* sql */`
    INSERT INTO ai.embeddings
      (source_path, schema_name, table_name, object_name,
       chunk_id, content_text, token_count, embedding, meta)
    VALUES
      (${source_path}, ${schema_name}, ${table_name}, ${object_name},
       ${chunk_id}, ${content_text}, ${token_count}, ${vecStr}::vector, ${sql.json(meta || null)})
    ON CONFLICT (source_path, chunk_id) DO UPDATE SET
      content_text = EXCLUDED.content_text,
      token_count  = EXCLUDED.token_count,
      embedding    = EXCLUDED.embedding,
      meta         = EXCLUDED.meta,
      updated_at   = now();
  `;
}

/** 메인 */
async function main() {
    const repoRoot = process.cwd();
    const ddlFile = path.join(repoRoot, "db_schema_public_oi.sql");
    const detailFiles = await globby(["docs/db_schema_report/*.txt"], { cwd: repoRoot, absolute: true });

    const targets = [
        { source_path: ddlFile, kind: "ddl" as const },
        ...detailFiles.map((p) => ({ source_path: p, kind: "detail" as const })),
    ];

    console.log(`🔎 대상 파일: ${targets.length}개`);
    let totalChunks = 0;

    for (const { source_path, kind } of targets) {
        const raw = await fs.readFile(source_path, "utf8");
        const chunks = chunkText(raw, 800, 1500);

        const metaCommon: any = { kind, relpath: path.relative(repoRoot, source_path) };
        const { schema_name, table_name, object_name } =
            kind === "detail" ? parseSchemaTableFromFilename(source_path) : { schema_name: null, table_name: null, object_name: path.basename(source_path) };

        console.log(`→ ${metaCommon.relpath} | chunks=${chunks.length}`);
        totalChunks += chunks.length;

        // 간단한 동시성(4개 워커)
        const concurrency = 4;
        let i = 0;
        async function worker() {
            while (i < chunks.length) {
                const idx = i++;
                const text = chunks[idx];
                try {
                    const emb = await embed(text);
                    await upsertEmbedding({
                        source_path: metaCommon.relpath.replace(/\\/g, "/"),
                        schema_name,
                        table_name,
                        object_name,
                        chunk_id: idx,
                        content_text: text,
                        token_count: null, // 필요시 실제 토크나이저로 계산
                        embeddingVec: emb,
                        meta: metaCommon,
                    });
                } catch (e: any) {
                    console.error(`  ✖ chunk ${idx} 실패:`, e?.message || e);
                }
            }
        }
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
    }

    console.log(`✅ 완료: 총 청크 ${totalChunks}개 upsert`);
    await sql.end({ timeout: 5 });
}

main().catch(async (e) => {
    console.error("❌ 실패:", e);
    try { await sql.end({ timeout: 5 }); } catch { }
    process.exit(1);
});
