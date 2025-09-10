// apps/bff/scripts/ai/reembedSchemaDocuments.ts
// 자연어 스키마 문서를 임베딩하여 pgvector DB에 저장

import "dotenv/config";
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import OpenAI from 'openai';

const EMB_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
    console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
    process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
}

const sql = postgres(DB_URL, { max: 5, prepare: false, idle_timeout: 10 });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DocumentChunk {
    content: string;
    metadata: {
        sourcePath: string;
        schemaName: string;
        tableName: string;
        chunkId: string;
        chunkIdNum: number;
    };
}

// 벡터를 PostgreSQL 배열 형식으로 변환
const toVec = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;

// 텍스트를 임베딩으로 변환
async function embedText(text: string): Promise<number[]> {
    console.log(`🔄 임베딩 생성 중... (${text.length} 문자)`);
    const response = await openai.embeddings.create({
        model: EMB_MODEL,
        input: text.replace(/\n/g, ' ').trim()
    });
    return response.data[0].embedding;
}

// 마크다운 문서를 청크로 분할
function chunkDocument(content: string, sourcePath: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkCounter = 1;
    
    // 파일명에서 스키마와 테이블명 추출
    const fileName = path.basename(sourcePath, '.md');
    let schemaName = 'unknown';
    let tableName = 'unknown';
    
    if (fileName === 'complete_schema_guide') {
        schemaName = 'all';
        tableName = 'overview';
    } else if (fileName.includes('_')) {
        const parts = fileName.split('_');
        schemaName = parts[0];
        tableName = parts.slice(1).join('_');
    }
    
    // 헤딩 기준으로 섹션 분할
    const sections = content.split(/^#+ /m);
    
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;
        
        // 각 섹션을 더 작은 청크로 분할 (너무 긴 경우)
        const maxChunkSize = 1000; // 문자 기준
        if (section.length <= maxChunkSize) {
            chunks.push({
                content: section,
                metadata: {
                    sourcePath,
                    schemaName,
                    tableName,
                    chunkId: `${fileName}_${i}`,
                    chunkIdNum: chunkCounter++
                }
            });
        } else {
            // 긴 섹션을 여러 청크로 분할
            const words = section.split(' ');
            let currentChunk = '';
            let subChunkIndex = 0;
            
            for (const word of words) {
                if ((currentChunk + ' ' + word).length > maxChunkSize && currentChunk) {
                    chunks.push({
                        content: currentChunk.trim(),
                        metadata: {
                            sourcePath,
                            schemaName,
                            tableName,
                            chunkId: `${fileName}_${i}_${subChunkIndex}`,
                            chunkIdNum: chunkCounter++
                        }
                    });
                    currentChunk = word;
                    subChunkIndex++;
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + word;
                }
            }
            
            if (currentChunk) {
                chunks.push({
                    content: currentChunk.trim(),
                    metadata: {
                        sourcePath,
                        schemaName,
                        tableName,
                        chunkId: `${fileName}_${i}_${subChunkIndex}`,
                        chunkIdNum: chunkCounter++
                    }
                });
            }
        }
    }
    
    return chunks.filter(chunk => chunk.content.length > 50); // 너무 짧은 청크 제외
}

// 생성된 스키마 문서 파일들을 읽어서 청크화
async function loadSchemaDocuments(): Promise<DocumentChunk[]> {
    const docsDir = path.join(process.cwd(), '..', '..', 'docs', 'generated_schema_docs');
    
    if (!fs.existsSync(docsDir)) {
        throw new Error(`스키마 문서 디렉토리를 찾을 수 없습니다: ${docsDir}`);
    }
    
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    console.log(`📁 ${files.length}개의 마크다운 파일을 발견했습니다.`);
    
    const allChunks: DocumentChunk[] = [];
    let globalChunkCounter = 1;
    
    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        console.log(`📖 처리 중: ${file} (${content.length} 문자)`);
        const chunks = chunkDocument(content, filePath);
        
        // 글로벌 카운터로 chunkIdNum 재설정
        chunks.forEach(chunk => {
            chunk.metadata.chunkIdNum = globalChunkCounter++;
        });
        
        allChunks.push(...chunks);
        
        console.log(`   → ${chunks.length}개 청크로 분할`);
    }
    
    console.log(`✅ 총 ${allChunks.length}개의 문서 청크를 준비했습니다.`);
    return allChunks;
}

// 기존 임베딩 데이터 삭제
async function clearExistingEmbeddings(): Promise<void> {
    console.log('🗑️ 기존 임베딩 데이터 삭제 중...');
    
    try {
        const result = await sql`DELETE FROM ai.embeddings`;
        console.log(`✅ ${result.count}개의 기존 임베딩 데이터를 삭제했습니다.`);
    } catch (error) {
        console.error('❌ 기존 데이터 삭제 중 오류:', error);
        throw error;
    }
}

// 문서 청크들을 임베딩하여 DB에 저장
async function embedAndStore(chunks: DocumentChunk[]): Promise<void> {
    console.log(`🔄 ${chunks.length}개 청크 임베딩 및 저장 시작...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
            console.log(`\n[${i + 1}/${chunks.length}] 처리 중: ${chunk.metadata.chunkId}`);
            
            // 임베딩 생성
            const embedding = await embedText(chunk.content);
            const embeddingVec = toVec(embedding);
            
            // DB에 저장
            await sql`
                INSERT INTO ai.embeddings (
                    source_path, 
                    schema_name, 
                    table_name, 
                    chunk_id,
                    content_text,
                    embedding
                ) VALUES (
                    ${chunk.metadata.sourcePath},
                    ${chunk.metadata.schemaName},
                    ${chunk.metadata.tableName}, 
                    ${chunk.metadata.chunkIdNum},
                    ${chunk.content},
                    ${embeddingVec}::vector
                )
            `;
            
            successCount++;
            console.log(`   ✅ 저장 완료`);
            
            // API 속도 제한을 위한 딜레이
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            errorCount++;
            console.error(`   ❌ 오류: ${error}`);
            
            // 계속 진행하지만 너무 많은 오류가 발생하면 중단
            if (errorCount > 10) {
                console.error('❌ 너무 많은 오류가 발생했습니다. 중단합니다.');
                throw new Error(`임베딩 처리 중 ${errorCount}개의 오류 발생`);
            }
        }
    }
    
    console.log(`\n📊 임베딩 완료 통계:`);
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${errorCount}개`);
    console.log(`   총합: ${chunks.length}개`);
}

async function main() {
    try {
        console.log('🚀 자연어 스키마 문서 재임베딩 시작...');
        console.log(`모델: ${EMB_MODEL}`);
        
        // 1단계: 스키마 문서 생성 (먼저 generateSchemaDocuments.ts 실행 필요)
        console.log('\n📝 1단계: 스키마 문서 생성 확인');
        const { execSync } = await import('child_process');
        try {
            execSync('npx tsx scripts/ai/generateSchemaDocuments.ts', { 
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.error('❌ 스키마 문서 생성 실패:', error);
            throw error;
        }
        
        // 2단계: 생성된 문서를 청크로 로드
        console.log('\n📚 2단계: 스키마 문서 로드 및 청크화');
        const chunks = await loadSchemaDocuments();
        
        // 3단계: 기존 임베딩 데이터 삭제
        console.log('\n🗑️ 3단계: 기존 임베딩 데이터 삭제');
        await clearExistingEmbeddings();
        
        // 4단계: 새로운 문서로 임베딩 및 저장
        console.log('\n🔄 4단계: 새로운 문서 임베딩 및 저장');
        await embedAndStore(chunks);
        
        console.log('\n🎉 자연어 스키마 문서 재임베딩이 완료되었습니다!');
        console.log('\n다음 명령어로 테스트할 수 있습니다:');
        console.log('curl -X POST http://127.0.0.1:8787/api/ai/ask -H "Content-Type: application/json" -d \'{"message":"oi 스키마의 apt_deal_trade_raw 주요 컬럼과 의미를 요약해줘"}\'');
        
    } catch (error) {
        console.error('❌ 재임베딩 중 오류 발생:', error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

// ES 모듈에서는 import.meta.main을 사용 (또는 직접 실행)
main();