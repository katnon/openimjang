// validate-assistant-tools.ts
import 'dotenv/config';
import { OpenAI } from 'openai';
import deepEqual from 'fast-deep-equal';
import { tools as localTools } from '../src/ai/tools';

type ToolSchema = {
  name: string;
  description: string;
  strict?: boolean;
  parameters: any; // JSON Schema
};

const REQUIRED_ENV = ['OPENAI_API_KEY', 'OPENAI_ASSISTANT_ID'] as const;

function assertEnv() {
  const miss = REQUIRED_ENV.filter(k => !process.env[k]);
  if (miss.length) {
    throw new Error(`Missing ENV: ${miss.join(', ')}`);
  }
}

// JSON Schema 정규화(정렬·기본값 제거 등)로 비교를 안정화
function normalizeSchema(s: any): any {
  if (Array.isArray(s)) return s.map(normalizeSchema);
  if (s && typeof s === 'object') {
    const out: Record<string, any> = {};
    Object.keys(s).sort().forEach(k => {
      const v = s[k];
      if (v === undefined) return; // undefined 제거
      out[k] = normalizeSchema(v);
    });
    return out;
  }
  return s;
}

function normalizeTool(t: ToolSchema) {
  return {
    name: t.name,
    description: t.description,
    strict: t.strict ?? true,
    parameters: normalizeSchema(t.parameters),
  };
}

async function main() {
  assertEnv();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const asstId = process.env.OPENAI_ASSISTANT_ID!;

  // 1) 플랫폼에서 Assistant 조회
  const asst = await client.beta.assistants.retrieve(asstId);
  const remoteFns = (asst.tools ?? [])
    .filter((t: any) => t.type === 'function')
    .map((t: any) => ({
      name: t.function?.name,
      description: t.function?.description ?? '',
      strict: true, // Platform에선 기본적으로 strict function schema 사용
      parameters: t.function?.parameters ?? {},
    })) as ToolSchema[];

  // 2) 로컬 tools
  const local = (localTools as any[]).map((t: any) => ({
    name: t.function.name,
    description: t.function.description,
    strict: t.function.strict ?? true,
    parameters: t.function.parameters,
  }) as ToolSchema).map(normalizeTool);
  const remote = remoteFns.map(normalizeTool);

  // 3) 이름 세트 단위 1차 비교
  const localNames = new Set(local.map(t => t.name));
  const remoteNames = new Set(remote.map(t => t.name));

  const missingOnRemote = [...localNames].filter(n => !remoteNames.has(n));
  const extraOnRemote   = [...remoteNames].filter(n => !localNames.has(n));

  // 4) 동일 이름의 스키마 shape 비교
  const diffs: string[] = [];
  for (const ln of localNames) {
    if (!remoteNames.has(ln)) continue;
    const l = local.find(t => t.name === ln)!;
    const r = remote.find(t => t.name === ln)!;

    const sameDesc = l.description.trim() === r.description.trim();
    const sameStrict = (l.strict ?? true) === (r.strict ?? true);
    const sameParams = deepEqual(l.parameters, r.parameters);

    if (!sameDesc || !sameStrict || !sameParams) {
      diffs.push(`- ${ln}: ${[
        sameDesc ? null : 'description',
        sameStrict ? null : 'strict',
        sameParams ? null : 'parameters',
      ].filter(Boolean).join(', ')} mismatch`);
    }
  }

  // 5) 리포팅
  if (missingOnRemote.length || extraOnRemote.length || diffs.length) {
    console.error('❌ Assistant functions mismatch detected.');
    if (missingOnRemote.length) {
      console.error(`  - Missing on Assistant: ${missingOnRemote.join(', ')}`);
    }
    if (extraOnRemote.length) {
      console.error(`  - Extra on Assistant: ${extraOnRemote.join(', ')}`);
    }
    if (diffs.length) {
      console.error('  - Shape differences:');
      diffs.forEach(d => console.error(`    ${d}`));
    }
    // 엄격 모드: 부팅 차단
    if (!process.env.ALLOW_MISMATCH) {
      process.exit(1);
    }
  } else {
    console.log('✅ Assistant functions are fully in sync with local tools.');
  }
}

main().catch(err => {
  console.error('❌ validate-assistant-tools error:', err);
  process.exit(1);
});