// apps/bff/src/ai/handlers/utils/sqlOrchestrator.ts
import { generateSelectQuery } from '../database/generateSelectQuery';
import { executeQuery } from '../database/executeQuery';

export function parsePeriodToSqlInterval(period?: string): string | null {
  // 한국어/영어 혼용 지원: "3개월", "3 month(s)", "90일", "1년" 등
  if (!period) return null;
  const s = period.trim().toLowerCase();

  // 년
  const y = s.match(/(\d+)\s*(년|year|years|yr|yrs)/);
  if (y) return `${y[1]} years`;

  // 개월/월
  const m = s.match(/(\d+)\s*(개월|달|month|months|mo)/);
  if (m) return `${m[1]} months`;

  // 일
  const d = s.match(/(\d+)\s*(일|day|days)/);
  if (d) return `${d[1]} days`;

  // 숫자만 들어오면 개월로 가정
  const n = s.match(/^(\d+)$/);
  if (n) return `${n[1]} months`;

  return null;
}

type OrchestrateOptions = {
  question: string;                 // LLM이 이해할 수 있는 자연어 질의
  forceSchemaHints?: string[];      // "oi.apt_deal_trade_raw(dealamount, dealymd, ...)" 같은 힌트
  requireColumns?: string[];        // 결과에 반드시 포함되길 원하는 컬럼명
  userProfile?: any;                // 사용자 프로필 정보
  safety?: {
    maxRows?: number;
    readOnly?: boolean;             // 기본 true
  };
};

/**
 * 자연어 → (RAG) → SQL 생성 → 실행까지 일괄 수행
 */
export async function orchestrateSelect(options: OrchestrateOptions) {
  const { question, forceSchemaHints = [], requireColumns = [], userProfile, safety } = options;

  // 1) 사용자 프로필 기반 질문 개선
  const enhancedQuestion = enhanceQuestionWithProfile(question, userProfile);
  
  // 1) LLM에게 줄 system 지시/컨텍스트 구성
  const systemHints = [
    'You are a SQL generator for PostgreSQL.',
    'Use only SELECT. Never use INSERT/UPDATE/DELETE/DDL.',
    'Prefer explicit schema names if known (e.g., oi.).',
    'Date columns may be named dealymd/contract_ymd/ymd/... Use RAG context.',
    ...(forceSchemaHints.length ? ['Schema hints:', ...forceSchemaHints] : []),
    ...(requireColumns.length ? [`Required columns: ${requireColumns.join(', ')}`] : []),
    ...(userProfile ? createProfileBasedSqlHints(userProfile) : []),
  ].join('\n');

  // 2) SQL 생성
  const gen = await generateSelectQuery({
    question: enhancedQuestion,
    systemHints,
    maxRows: safety?.maxRows ?? 200,
  });

  if (!gen.success || !gen.sql) {
    return { success: false, step: 'generate', error: gen.error ?? 'SQL generation failed' };
  }

  // 3) 실행
  const exec = await executeQuery({
    sql: gen.sql,
    readOnly: safety?.readOnly ?? true,
  });

  return {
    success: !!exec.success,
    sql: gen.sql,
    rows: exec.rows,
    rowCount: exec.rowCount,
    error: exec.success ? undefined : exec.error,
  };
}

/**
 * 사용자 프로필을 기반으로 질문을 개선합니다
 */
function enhanceQuestionWithProfile(question: string, userProfile?: any): string {
  if (!userProfile) return question;

  let enhancement = '';

  // 예산 범위가 있으면 추가
  if (userProfile.budgetRange && userProfile.budgetRange.length === 2) {
    const minBudgetWon = userProfile.budgetRange[0]; // 원 단위 그대로
    const maxBudgetWon = userProfile.budgetRange[1];
    const minBudgetManwon = Math.floor(minBudgetWon / 10000); // 만원 단위
    const maxBudgetManwon = Math.floor(maxBudgetWon / 10000);
    enhancement += ` 사용자 예산 범위: ${minBudgetManwon}만원~${maxBudgetManwon}만원 (dealamount 기준으로 가격 필터링 고려).`;
  }

  // 선호 건축연식이 있으면 추가
  if (userProfile.preferredBuildingAge) {
    enhancement += ` 선호 건축연식: ${userProfile.preferredBuildingAge}.`;
  }

  // 목적이 있으면 추가
  if (userProfile.purpose && userProfile.purpose.length > 0) {
    enhancement += ` 목적: ${userProfile.purpose.join(', ')}.`;
  }

  return question + enhancement;
}

/**
 * 사용자 프로필 기반 SQL 힌트를 생성합니다
 */
function createProfileBasedSqlHints(userProfile: any): string[] {
  const hints: string[] = [];

  if (userProfile.budgetRange && userProfile.budgetRange.length === 2) {
    const minPrice = Math.floor(userProfile.budgetRange[0] / 10000); // 만원 단위
    const maxPrice = Math.floor(userProfile.budgetRange[1] / 10000);
    hints.push(`User budget range: ${minPrice}~${maxPrice} (dealamount in 만원 units, e.g. dealamount BETWEEN ${minPrice} AND ${maxPrice})`);
  }

  if (userProfile.preferredBuildingAge) {
    hints.push(`User prefers building age: ${userProfile.preferredBuildingAge}`);
  }

  if (userProfile.workLocation) {
    hints.push(`User work location: ${userProfile.workLocation} (consider location-based filtering)`);
  }

  return hints;
}