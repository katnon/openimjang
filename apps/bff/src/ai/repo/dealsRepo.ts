// 부동산 거래 데이터 리포지토리 레이어
import { db } from '../../lib/db';
import { sql } from 'kysely';

export interface DealSearchParams {
  apartmentName?: string;
  aptId?: number;
  dealType?: '매매' | '전세' | '월세' | '전체';
  fromYM?: number; // YYYYMM 형식
  toYM?: number;   // YYYYMM 형식
  areaMin?: number;
  areaMax?: number;
  floorMin?: number;
  floorMax?: number;
  limit?: number;
  offset?: number;
}

export interface DealRecord {
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  dealAmount?: number;  // 매매가 (만원)
  deposit?: number;     // 보증금 (만원) 
  monthlyRent?: number; // 월세 (만원)
  exclusiveArea: number; // 전용면적 (㎡)
  floor: number;
  dealType: string;
  apartmentName: string;
  dealYmd: string;
}

export interface TrendDataPoint {
  key: string;          // YYYY-MM 또는 YYYY-Qn
  value: number;        // 평균 거래가 등
  sampleCount: number;  // 샘플 수
  metric: string;       // 지표명
}

export interface StatsResult {
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
  p25?: number;
  p75?: number;
  sampleCount: number;
  unit: string;
}

/**
 * 거래 데이터 검색 (매매 + 전월세 통합)
 */
export async function fetchDeals(params: DealSearchParams): Promise<DealRecord[]> {
  const {
    apartmentName,
    aptId,
    dealType = '전체',
    fromYM,
    toYM,
    areaMin,
    areaMax,
    floorMin,
    floorMax,
    limit = 100,
    offset = 0
  } = params;

  const results: DealRecord[] = [];

  // 매매 데이터 조회
  if (dealType === '매매' || dealType === '전체') {
    let query = db
      .selectFrom('oi.apt_deal_trade_raw as t')
      .leftJoin('oi.apt_info as a', 'a.id', 't.apt_info_id')
      .select([
        't.dealyear as dealYear',
        't.dealmonth as dealMonth', 
        't.dealday as dealDay',
        't.dealamount as dealAmount',
        't.excluusear as exclusiveArea',
        't.floor',
        'a.apt_nm as apartmentName',
        sql`CONCAT(t.dealyear, LPAD(t.dealmonth, 2, '0'), LPAD(t.dealday, 2, '0'))`.as('dealYmd')
      ]);

    // 필터 적용
    if (apartmentName) {
      query = query.where('a.apt_nm', 'like', `%${apartmentName}%`);
    }
    if (aptId) {
      query = query.where('t.apt_info_id', '=', aptId);
    }
    if (fromYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '>=', fromYM);
    }
    if (toYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '<=', toYM);
    }
    if (areaMin) {
      query = query.where('t.excluusear', '>=', areaMin);
    }
    if (areaMax) {
      query = query.where('t.excluusear', '<=', areaMax);
    }
    if (floorMin) {
      query = query.where('t.floor', '>=', floorMin);
    }
    if (floorMax) {
      query = query.where('t.floor', '<=', floorMax);
    }

    const tradeResults = await query
      .orderBy('t.dealyear', 'desc')
      .orderBy('t.dealmonth', 'desc')
      .orderBy('t.dealday', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    results.push(...tradeResults.map(r => ({
      ...r,
      dealType: '매매'
    })));
  }

  // 전월세 데이터 조회
  if (dealType === '전세' || dealType === '월세' || dealType === '전체') {
    let query = db
      .selectFrom('oi.apt_deal_rent_raw as r')
      .leftJoin('oi.apt_info as a', 'a.id', 'r.apt_info_id')
      .select([
        'r.dealyear as dealYear',
        'r.dealmonth as dealMonth',
        'r.dealday as dealDay',
        'r.deposit',
        'r.monthlyrent as monthlyRent',
        'r.excluusear as exclusiveArea',
        'r.floor',
        'a.apt_nm as apartmentName',
        sql`CONCAT(r.dealyear, LPAD(r.dealmonth, 2, '0'), LPAD(r.dealday, 2, '0'))`.as('dealYmd')
      ]);

    // 필터 적용 (매매와 동일)
    if (apartmentName) {
      query = query.where('a.apt_nm', 'like', `%${apartmentName}%`);
    }
    if (aptId) {
      query = query.where('r.apt_info_id', '=', aptId);
    }
    if (fromYM) {
      query = query.where(sql`r.dealyear * 100 + r.dealmonth`, '>=', fromYM);
    }
    if (toYM) {
      query = query.where(sql`r.dealyear * 100 + r.dealmonth`, '<=', toYM);
    }
    if (areaMin) {
      query = query.where('r.excluusear', '>=', areaMin);
    }
    if (areaMax) {
      query = query.where('r.excluusear', '<=', areaMax);
    }
    if (floorMin) {
      query = query.where('r.floor', '>=', floorMin);
    }
    if (floorMax) {
      query = query.where('r.floor', '<=', floorMax);
    }

    const rentResults = await query
      .orderBy('r.dealyear', 'desc')
      .orderBy('r.dealmonth', 'desc')
      .orderBy('r.dealday', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    results.push(...rentResults.map(r => ({
      ...r,
      dealType: r.monthlyRent && r.monthlyRent > 0 ? '월세' : '전세'
    })));
  }

  // 결과 정렬 (최신순)
  return results.sort((a, b) => b.dealYmd.localeCompare(a.dealYmd));
}

/**
 * 최근 거래 데이터 조회
 */
export async function fetchLatestDeals(params: { 
  apartmentName?: string; 
  aptId?: number;
  limit?: number; 
}): Promise<DealRecord[]> {
  const { apartmentName, aptId, limit = 10 } = params;
  
  // 최근 1년 데이터로 제한
  const currentDate = new Date();
  const oneYearAgo = currentDate.getFullYear() - 1;
  const fromYM = oneYearAgo * 100 + 1; // 작년 1월부터
  
  return fetchDeals({
    apartmentName,
    aptId,
    dealType: '전체',
    fromYM,
    limit
  });
}

/**
 * 가격 트렌드 집계 데이터 조회
 */
export async function fetchTrendAgg(params: {
  apartmentName?: string;
  aptId?: number;
  dealType?: string;
  periodMonths: number;
  groupBy: '월' | '분기';
  metric: '평균' | '중위값';
}): Promise<TrendDataPoint[]> {
  const { apartmentName, aptId, dealType = '매매', periodMonths, groupBy, metric } = params;
  
  // 기간 계산
  const currentDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);
  
  const fromYM = startDate.getFullYear() * 100 + (startDate.getMonth() + 1);
  const toYM = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);

  if (dealType === '매매') {
    let query = db
      .selectFrom('oi.apt_deal_trade_raw as t')
      .leftJoin('oi.apt_info as a', 'a.id', 't.apt_info_id');

    if (groupBy === '월') {
      query = query
        .select([
          sql`CONCAT(t.dealyear, '-', LPAD(t.dealmonth, 2, '0'))`.as('period'),
          metric === '평균' 
            ? sql`AVG(t.dealamount)`.as('value')
            : sql`AVG(t.dealamount)`.as('value'), // 중위값은 추후 구현
          sql`COUNT(*)`.as('sampleCount')
        ])
        .groupBy(sql`t.dealyear, t.dealmonth`)
        .orderBy('t.dealyear')
        .orderBy('t.dealmonth');
    } else {
      // 분기별
      query = query
        .select([
          sql`CONCAT(t.dealyear, '-Q', CEIL(t.dealmonth / 3.0))`.as('period'),
          metric === '평균'
            ? sql`AVG(t.dealamount)`.as('value')
            : sql`AVG(t.dealamount)`.as('value'),
          sql`COUNT(*)`.as('sampleCount')
        ])
        .groupBy(sql`t.dealyear, CEIL(t.dealmonth / 3.0)`)
        .orderBy('t.dealyear')
        .orderBy(sql`CEIL(t.dealmonth / 3.0)`);
    }

    // 필터 적용
    if (apartmentName) {
      query = query.where('a.apt_nm', 'like', `%${apartmentName}%`);
    }
    if (aptId) {
      query = query.where('t.apt_info_id', '=', aptId);
    }

    query = query
      .where(sql`t.dealyear * 100 + t.dealmonth`, '>=', fromYM)
      .where(sql`t.dealyear * 100 + t.dealmonth`, '<=', toYM);

    const results = await query.execute();
    
    return results.map(r => ({
      key: r.period as string,
      value: Math.round(Number(r.value) || 0),
      sampleCount: Number(r.sampleCount),
      metric: `${metric} 거래가 (만원)`
    }));
  }

  return [];
}

/**
 * 통계 요약 데이터 조회
 */
export async function fetchStatsSummary(params: {
  apartmentName?: string;
  aptId?: number;
  dealType?: string;
  fromYM?: number;
  toYM?: number;
}): Promise<StatsResult> {
  const { apartmentName, aptId, dealType = '매매', fromYM, toYM } = params;

  if (dealType === '매매') {
    let query = db
      .selectFrom('oi.apt_deal_trade_raw as t')
      .leftJoin('oi.apt_info as a', 'a.id', 't.apt_info_id')
      .select([
        sql`MIN(t.dealamount)`.as('min'),
        sql`MAX(t.dealamount)`.as('max'),
        sql`AVG(t.dealamount)`.as('avg'),
        sql`COUNT(*)`.as('sampleCount')
      ]);

    // 필터 적용
    if (apartmentName) {
      query = query.where('a.apt_nm', 'like', `%${apartmentName}%`);
    }
    if (aptId) {
      query = query.where('t.apt_info_id', '=', aptId);
    }
    if (fromYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '>=', fromYM);
    }
    if (toYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '<=', toYM);
    }

    const result = await query.executeTakeFirst();

    if (result) {
      return {
        min: Number(result.min) || undefined,
        max: Number(result.max) || undefined,
        avg: Math.round(Number(result.avg) || 0),
        sampleCount: Number(result.sampleCount),
        unit: '만원'
      };
    }
  }

  return {
    sampleCount: 0,
    unit: '만원'
  };
}

/**
 * 분포/히스토그램 데이터 조회
 */
export async function fetchHistogram(params: {
  apartmentName?: string;
  aptId?: number;
  bucketBy: '가격' | '면적' | '층';
  bucketSize: number;
  dealType?: string;
  fromYM?: number;
  toYM?: number;
}): Promise<Array<{ range: string; count: number }>> {
  const { apartmentName, aptId, bucketBy, bucketSize, dealType = '매매', fromYM, toYM } = params;

  let columnName: string;
  let unit: string;

  switch (bucketBy) {
    case '가격':
      columnName = 't.dealamount';
      unit = '만원';
      break;
    case '면적':
      columnName = 't.excluusear';
      unit = '㎡';
      break;
    case '층':
      columnName = 't.floor';
      unit = '층';
      break;
    default:
      throw new Error(`지원하지 않는 분포 유형: ${bucketBy}`);
  }

  if (dealType === '매매') {
    let query = db
      .selectFrom('oi.apt_deal_trade_raw as t')
      .leftJoin('oi.apt_info as a', 'a.id', 't.apt_info_id')
      .select([
        sql`FLOOR(${sql.raw(columnName)} / ${bucketSize}) * ${bucketSize}`.as('bucketStart'),
        sql`COUNT(*)`.as('count')
      ])
      .groupBy(sql`FLOOR(${sql.raw(columnName)} / ${bucketSize})`)
      .orderBy(sql`FLOOR(${sql.raw(columnName)} / ${bucketSize})`);

    // 필터 적용
    if (apartmentName) {
      query = query.where('a.apt_nm', 'like', `%${apartmentName}%`);
    }
    if (aptId) {
      query = query.where('t.apt_info_id', '=', aptId);
    }
    if (fromYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '>=', fromYM);
    }
    if (toYM) {
      query = query.where(sql`t.dealyear * 100 + t.dealmonth`, '<=', toYM);
    }

    const results = await query.execute();

    return results.map(r => ({
      range: `${Number(r.bucketStart)} ~ ${Number(r.bucketStart) + bucketSize}${unit}`,
      count: Number(r.count)
    }));
  }

  return [];
}

/**
 * 아파트명으로 apt_info_id 조회
 */
export async function findApartmentByName(apartmentName: string): Promise<{ id: number; name: string } | null> {
  const result = await db
    .selectFrom('oi.apt_info')
    .select(['id', 'apt_nm as name'])
    .where('apt_nm', 'like', `%${apartmentName}%`)
    .executeTakeFirst();

  return result || null;
}