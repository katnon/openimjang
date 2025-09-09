import 'dotenv/config';
import { OpenAI } from 'openai';
import { tools as localTools } from '../src/ai/tools';

type LocalTool = { name?: string; description?: string; strict?: boolean; parameters?: any };

function assertAndReport(tools: LocalTool[]) {
    console.log(`✅ AI Tools 로드 완료: ${tools.length}개 함수`);
    const problems: string[] = [];
    tools.forEach((t, i) => {
        if (!t || typeof t !== 'object') problems.push(`[${i}] tool is not object: ${String(t)}`);
        if (!t?.name) problems.push(`[${i}] missing name`);
        if (!t?.parameters || typeof t.parameters !== 'object') problems.push(`[${i}] invalid parameters`);
        if (t?.parameters && t.parameters.type !== 'object') problems.push(`[${i}] parameters.type != 'object'`);
    });
    if (problems.length) {
        console.error('❌ Local tools validation failed:\n' + problems.map(p => '  - ' + p).join('\n'));
        // 중요: 어떤 게 깨졌는지 상위 3개만 payload로 미리 확인
        console.error('🔎 샘플 도구 미리보기:', tools.slice(0, 3));
        process.exit(1);
    }
}

function toAssistantTool(t: LocalTool) {
    return {
        type: 'function',
        function: {
            name: t.name!, // 위에서 검증 완료 가정
            description: t.description ?? '',
            parameters: t.parameters ?? { type: 'object', properties: {} }, // 안전망
        },
    };
}

async function main() {
    const { OPENAI_API_KEY, OPENAI_ASSISTANT_ID } = process.env;
    if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
        throw new Error('OPENAI_API_KEY/OPENAI_ASSISTANT_ID missing');
    }
    // 1) 로컬 tools 검증
    assertAndReport(localTools as LocalTool[]);

    // 2) 변환 및 동기화
    const payload = { tools: (localTools as LocalTool[]).map(toAssistantTool) };
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const updated = await client.beta.assistants.update(OPENAI_ASSISTANT_ID, payload);
    console.log(`✅ Assistant updated. tools: ${updated.tools?.length ?? 0}`);
}

main().catch((e) => {
    console.error('❌ sync-assistant-tools error:', e);
    process.exit(1);
});