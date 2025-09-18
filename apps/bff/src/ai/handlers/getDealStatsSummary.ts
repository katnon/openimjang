import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';

interface GetDealStatsSummaryParams {
  apartmentName?: string;             // 특정 아파트 통계면 지정
  aptId?: number;                     // 있으면 함께 힌트로 주되 강제 사용 X
  dealType?: '매매' | '전세' | '월세' | '전체';
  period?: string;                    // "3개월", "90일", "1년" 등
}

/**
 * 특정 아파트의 거래 통계 요약을 제공합니다.
 */
export async function getDealStatsSummary(args: GetDealStatsSummaryParams): Promise<any> {
  const { apartmentName, aptId, dealType = '매매', period = '3개월' } = args;

  try {
    console.log('📊 거래 통계 요약 (RAG 오케스트레이션):', { apartmentName, aptId, dealType, period });

    const interval = parsePeriodToSqlInterval(period) ?? '3 months';

    const who = apartmentName
      ? `아파트 "${apartmentName}"의 `
      : `해당 지역/조건의 `;
    const question = [
      `${who}최근 ${period}(${interval}) ${dealType} 거래의 통계를 구해줘.`,
      `평균/최소/최대 거래금액, 거래 건수, (가능하면) 면적 구간별 평균도 요약해.`,
      `날짜 필터는 현재 날짜 기준으로 ${interval} 이내.`,
      dealType === '매매' ? `매매 거래만: WHERE deal_amount IS NOT NULL 조건 필수.` : '',
      dealType === '전세' ? `전세 거래만: WHERE deal_amount IS NULL AND monthly_rent = 0 조건 필수.` : '',
      dealType === '월세' ? `월세 거래만: WHERE deal_amount IS NULL AND monthly_rent > 0 조건 필수.` : '',
      `스키마/컬럼은 RAG 문서에 맞춰 자동 선택.`,
    ].filter(Boolean).join(' ');

    const hints: string[] = [
      'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, floor, deal_year, deal_month, deal_day, apt_nm, jibun_address)',
      '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
      dealType === '매매' ? '매매 필터: WHERE deal_amount IS NOT NULL (필수)' : '',
      dealType === '전세' ? '전세 필터: WHERE deal_amount IS NULL AND monthly_rent = 0 (필수)' : '',
      dealType === '월세' ? '월세 필터: WHERE deal_amount IS NULL AND monthly_rent > 0 (필수)' : '',
      '통계 집계: AVG(deal_amount), MIN(deal_amount), MAX(deal_amount), COUNT(*)',
      '면적별 그룹화: CASE WHEN exclu_use_ar < 60 THEN \'소형\' WHEN exclu_use_ar BETWEEN 60 AND 85 THEN \'중형\' ELSE \'대형\' END',
      '날짜 조건: WHERE deal_year >= EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL \'3 months\')',
      '금지된 테이블: oi.apt_deal_trade_raw, oi.apt_deal_rent_raw 사용 금지',
    ].filter(Boolean);
    if (aptId) {
      // 강제는 아니고 힌트로만
      hints.push(`apartment id (hint): ${aptId}`);
    }

    const { success, sql, rows, rowCount, error } = await orchestrateSelect({
      question,
      forceSchemaHints: hints,
      requireColumns: ['deal_amount'],
      safety: { maxRows: 10000, readOnly: true },
    });

    if (!success) {
      return {
        success: false,
        error: error || '거래 통계 요약에 실패했습니다.',
        dataSchema: {
          min: '최저 거래가 (만원 단위)',
          max: '최고 거래가 (만원 단위)', 
          avg: '평균 거래가 (만원 단위)',
          sampleCount: '총 거래 건수',
          note: '30000 = 3억원'
        }
      };
    }

    // (선택) 간단 요약 형태로 재구성
    let summary: any = undefined;
    if (success && Array.isArray(rows)) {
      // rows가 이미 집계형(AVG/MIN/MAX/COUNT)일 가능성이 높음.
      // 못 알아보는 경우에도 그대로 rows 반환.
      summary = rows[0] ?? null;
    }

    return {
      success: true,
      searchConditions: {
        apartmentName,
        period,
        dealType
      },
      stats: summary,
      rows, // 원본 집계 결과
      rowCount,
      sql, // 생성된 SQL 쿼리 (디버깅용)
      dataSchema: {
        min: '최저 거래가 (만원 단위)',
        max: '최고 거래가 (만원 단위)', 
        avg: '평균 거래가 (만원 단위)',
        sampleCount: '총 거래 건수',
        note: '30000 = 3억원, AI가 자연어로 생성한 집계 결과'
      }
    };

  } catch (error: any) {
    console.error('❌ getDealStatsSummary 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '거래 통계 요약 중 오류가 발생했습니다.'
    };
  }
}

