// apps/bff/scripts/validate-assistant-tools.ts
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

import { OpenAI } from 'openai';
import deepEqual from 'fast-deep-equal';
import { tools as localTools } from '../src/ai/tools';

// ──────────────────────────────────────────────────────────────
// 진단 로그 (원하시면 주석 처리)
console.log('[ENV] CWD =', process.cwd());
console.log('[ENV] dotenv path =', path.resolve(__dirname, '../.env'));
console.log('[ENV] has keys =', !!process.env.OPENAI_API_KEY, !!process.env.OPENAI_ASSISTANT_ID);
// ──────────────────────────────────────────────────────────────

type FlatTool = { name?: string; description?: string; strict?: boolean; parameters?: any };
type OAITool = { type: 'function'; function: { name?: string; description?: string; parameters?: any } };

// OpenAI 포맷 판별
function isOAITool(x: any): x is OAITool {
  return x && x.type === 'function' && x.function && typeof x.function === 'object';
}

// parameters 정규화 (sync와 동일 규칙)
function normalizeParameters(params: any) {
  if (!params || typeof params !== 'object') {
    return { type: 'object', properties: {}, required: [], additionalProperties: false };
  }
  const p: any = { ...params };

  if (p.type !== 'object') p.type = 'object';
  if (!p.properties || typeof p.properties !== 'object') p.properties = {};

  // required = properties 모든 키 포함
  const keys = Object.keys(p.properties);
  const req: string[] = Array.isArray(p.required) ? [...p.required] : [];
  for (const k of keys) if (!req.includes(k)) req.push(k);
  p.required = req;

  if (typeof p.additionalProperties !== 'boolean') p.additionalProperties = false;

  // 속성/enum 등 비교 안정화를 위한 정렬
  const sortObj = (o: any): any => {
    if (Array.isArray(o)) return o.map(sortObj);
    if (o && typeof o === 'object') {
      const out: Record<string, any> = {};
      Object.keys(o).sort().forEach(k => { out[k] = sortObj(o[k]); });
      return out;
    }
    return o;
  };

  p.properties = sortObj(p.properties);
  if (Array.isArray(p.required)) p.required = [...p.required].sort();
  return sortObj(p);
}

// 도구를 “평평한 비교용”으로 변환 + 정규화 적용
function toFlatNormalized(t: any) {
  // OAI 포맷이면 function에서 꺼냄
  if (isOAITool(t)) {
    return {
      name: t.function?.name,
      description: (t.function?.description ?? '').trim(),
      strict: true,
      parameters: normalizeParameters(t.function?.parameters),
    };
  }
  // 평평한 포맷
  return {
    name: t?.name,
    description: (t?.description ?? '').trim(),
    strict: t?.strict ?? true,
    parameters: normalizeParameters(t?.parameters),
  };
}

// 최종 비교 전 전체 정규화
function normalizeToolForCompare(t: any) {
  // JSON 정렬(키순) + undefined 제거
  const sortObj = (o: any): any => {
    if (Array.isArray(o)) return o.map(sortObj);
    if (o && typeof o === 'object') {
      const out: Record<string, any> = {};
      Object.keys(o).sort().forEach(k => {
        const v = (o as any)[k];
        if (v === undefined) return;
        out[k] = sortObj(v);
      });
      return out;
    }
    return o;
  };
  return sortObj(toFlatNormalized(t));
}

async function main() {
  const { OPENAI_API_KEY, OPENAI_ASSISTANT_ID } = process.env;
  if (!OPENAI_API_KEY || !OPENAI_ASSISTANT_ID) {
    throw new Error('OPENAI_API_KEY/OPENAI_ASSISTANT_ID missing');
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  // 1) 원격 Assistant 툴셋 수집
  const asst = await client.beta.assistants.retrieve(OPENAI_ASSISTANT_ID);
  const remoteFns = (asst.tools ?? [])
    .filter((t: any) => t.type === 'function');

  // 2) 로컬/원격 정규화
  const localNorm = (Array.isArray(localTools) ? localTools : []).map(normalizeToolForCompare);
  const remoteNorm = remoteFns.map(normalizeToolForCompare);

  // 3) 이름 세트 비교
  const localNames = new Set(localNorm.map(t => t.name));
  const remoteNames = new Set(remoteNorm.map(t => t.name));

  const missingOnRemote = [...localNames].filter(n => !remoteNames.has(n));
  const extraOnRemote = [...remoteNames].filter(n => !localNames.has(n));

  // 4) 동일 이름 shape 비교
  const diffs: string[] = [];
  for (const ln of localNames) {
    if (!remoteNames.has(ln)) continue;
    const l = localNorm.find(t => t.name === ln)!;
    const r = remoteNorm.find(t => t.name === ln)!;

    const sameDesc = l.description === r.description;
    const sameStrict = (l.strict ?? true) === (r.strict ?? true);
    const sameParams = deepEqual(l.parameters, r.parameters);

    if (!sameDesc || !sameStrict || !sameParams) {
      const parts = [];
      if (!sameDesc) parts.push('description');
      if (!sameStrict) parts.push('strict');
      if (!sameParams) parts.push('parameters');
      diffs.push(`- ${ln}: ${parts.join(', ')} mismatch`);
    }
  }

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
    process.exit(1);
  } else {
    console.log('✅ Assistant functions are fully in sync with local tools.');
  }
}

main().catch(err => {
  console.error('❌ validate-assistant-tools error:', err);
  process.exit(1);
});
