// apps/bff/scripts/sync-assistant-tools.ts
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname 대체
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/bff/.env 를 “스크립트 파일 기준”으로 강제 로드
config({ path: path.resolve(__dirname, '../.env') });

import { OpenAI } from 'openai';
import { tools as localTools } from '../src/ai/tools';

// ──────────────────────────────────────────────────────────────
// 진단 로그 (필요 없으면 주석 처리해도 됨)
console.log('[ENV] CWD =', process.cwd());
console.log('[ENV] dotenv path =', path.resolve(__dirname, '../.env'));
console.log('[ENV] has keys =', !!process.env.OPENAI_API_KEY, !!process.env.OPENAI_ASSISTANT_ID);
// ──────────────────────────────────────────────────────────────

type FlatTool = { name?: string; description?: string; parameters?: any; strict?: boolean };
type OAIFunction = { name?: string; description?: string; parameters?: any };
type OAITool = { type: 'function'; function: OAIFunction };

function isOAITool(x: any): x is OAITool {
    return x && x.type === 'function' && x.function && typeof x.function === 'object';
}

// (A) parameters 정규화
function normalizeParameters(params: any) {
    if (!params || typeof params !== 'object') {
        return { type: 'object', properties: {}, required: [], additionalProperties: false };
    }
    const p: any = { ...params };

    // 기본 형태 강제
    if (p.type !== 'object') p.type = 'object';
    if (!p.properties || typeof p.properties !== 'object') p.properties = {};

    // required 보강: properties의 모든 키를 포함
    const keys = Object.keys(p.properties);
    const required: string[] = Array.isArray(p.required) ? [...p.required] : [];
    for (const k of keys) {
        if (!required.includes(k)) required.push(k);
    }
    p.required = required;

    if (typeof p.additionalProperties !== 'boolean') p.additionalProperties = false;
    return p;
}

// (B) 도구 포맷 흡수 + 정규화 적용 (OAI/Flat 모두)
function asAssistantTool(x: FlatTool | OAITool): OAITool {
    if (isOAITool(x)) {
        return {
            type: 'function',
            function: {
                name: x.function?.name,
                description: x.function?.description ?? '',
                parameters: normalizeParameters(x.function?.parameters),
            },
        };
    }
    // 평평한 스키마라면 OpenAI 포맷으로 감싸기
    return {
        type: 'function',
        function: {
            name: x.name!,
            description: x.description ?? '',
            parameters: normalizeParameters(x.parameters),
        },
    };
}

// (C) 로컬 도구 사전 검증(정규화된 결과 기준)
function assertLocalTools(tools: (FlatTool | OAITool)[]) {
    const problems: string[] = [];
    tools.forEach((t, i) => {
        const oai = asAssistantTool(t);
        const fn = oai.function;
        if (!fn?.name) problems.push(`[${i}] missing function.name`);
        const p = fn?.parameters;
        if (!p || typeof p !== 'object') problems.push(`[${i}] invalid parameters (not object)`);
        if (p?.type !== 'object') problems.push(`[${i}] parameters.type != 'object'`);

        // required 누락 확인
        const keys = Object.keys(p?.properties ?? {});
        const missing = keys.filter(k => !(p.required ?? []).includes(k));
        if (missing.length) problems.push(`[${i}] required missing: ${missing.join(', ')}`);
    });

    if (problems.length) {
        console.error('❌ Local tools validation failed:\n' + problems.map(p => '  - ' + p).join('\n'));
        console.error('🔎 도구 이름 목록:', tools.map((t: any, i) => {
            const oai = asAssistantTool(t);
            return `[${i}] ${oai.function?.name}`;
        }).join(', '));
        process.exit(1);
    }
}

async function main() {
    const { OPENAI_API_KEY, OPENAI_ASSISTANT_ID } = process.env;
    if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
        throw new Error('OPENAI_API_KEY/OPENAI_ASSISTANT_ID missing');
    }

    const toolsArray = Array.isArray(localTools) ? localTools : [];
    console.log(`✅ AI Tools 로드 완료: ${toolsArray.length}개 함수`);

    // 정규화 기준으로 사전 검증
    assertLocalTools(toolsArray as any);

    // 업로드 payload (정규화 적용)
    const payload = {
        tools: (toolsArray as any[]).map(asAssistantTool),
    };

    // (원하면 여기서 payload 일부 로깅)
    // console.log(JSON.stringify(payload.tools[0], null, 2));

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const updated = await client.beta.assistants.update(OPENAI_ASSISTANT_ID, payload);
    console.log(`✅ Assistant updated. tools: ${updated.tools?.length ?? 0}`);
}

main().catch((e) => {
    console.error('❌ sync-assistant-tools error:', e);
    process.exit(1);
});
