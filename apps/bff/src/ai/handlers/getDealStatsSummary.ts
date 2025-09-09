import { fetchStatsSummary, findApartmentByName } from '../repo/dealsRepo';

interface GetDealStatsSummaryParams {
  apartmentName?: string;
  aptId?: number;
  period?: '1개월' | '3개월' | '6개월' | '1년' | '2년' | '3년';
  dealType?: '매매' | '전세' | '월세' | '전체';
  includeFloorAnalysis?: boolean;
}

/**
 * 특정 아파트의 거래 통계 요약을 제공합니다.
 */
export async function getDealStatsSummary(args: GetDealStatsSummaryParams): Promise<any> {
  const { 
    apartmentName, 
    aptId, 
    period = '1년', 
    dealType = '전체',
    includeFloorAnalysis = false 
  } = args;

  try {
    console.log('📊 거래 통계 요약:', { apartmentName, aptId, period, dealType });

    // 아파트 정보 조회
    let targetAptId = aptId;
    let targetAptName = apartmentName;
    
    if (!targetAptId && apartmentName) {
      const aptInfo = await findApartmentByName(apartmentName);
      if (aptInfo) {
        targetAptId = aptInfo.id;
        targetAptName = aptInfo.name;
      }
    }

    if (!targetAptId && !apartmentName) {
      return {
        success: false,
        error: '아파트 ID 또는 아파트명이 필요합니다.'
      };
    }

    // 기간을 YYYYMM 형식으로 변환
    const { fromYM, toYM } = parsePeriodToYM(period);

    // 통계 데이터 조회
    const stats = await fetchStatsSummary({
      apartmentName,
      aptId: targetAptId,
      dealType: dealType === '전체' ? '매매' : dealType, // 현재 매매만 지원
      fromYM,
      toYM
    });

    if (stats.sampleCount === 0) {
      return {
        success: true,
        message: '해당 조건의 거래 통계 데이터가 없습니다.',
        stats: null,
        searchConditions: {
          apartmentName: targetAptName,
          period,
          dealType
        }
      };
    }

    return {
      success: true,
      searchConditions: {
        apartmentName: targetAptName,
        period,
        dealType
      },
      stats: {
        ...stats,
        // 포맷된 값들 추가
        minFormatted: stats.min ? formatAmount(stats.min) : undefined,
        maxFormatted: stats.max ? formatAmount(stats.max) : undefined,
        avgFormatted: stats.avg ? formatAmount(stats.avg) : undefined,
        priceRange: stats.min && stats.max ? `${formatAmount(stats.min)} ~ ${formatAmount(stats.max)}` : undefined,
        periodSummary: `${period} 동안 총 ${stats.sampleCount}건의 거래`
      },
      dataSchema: {
        min: '최저 거래가 (만원 단위)',
        max: '최고 거래가 (만원 단위)', 
        avg: '평균 거래가 (만원 단위)',
        sampleCount: '총 거래 건수',
        unit: stats.unit,
        note: '30000 = 3억원'
      }
    };

  } catch (error: any) {
    console.error('❌ getDealStatsSummary 오류:', error);
    return {
      success: false,
      error: error.message || '거래 통계 요약 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 기간 문자열을 YYYYMM으로 변환
 */
function parsePeriodToYM(period: string): { fromYM: number; toYM: number } {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYM = currentYear * 100 + currentMonth;

  let monthsAgo = 12;

  if (period.includes('개월')) {
    const match = period.match(/(\d+)개월/);
    if (match) {
      monthsAgo = parseInt(match[1]);
    }
  } else if (period.includes('년')) {
    const match = period.match(/(\d+)년/);
    if (match) {
      monthsAgo = parseInt(match[1]) * 12;
    }
  }

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsAgo);
  const fromYM = startDate.getFullYear() * 100 + (startDate.getMonth() + 1);

  return { fromYM, toYM: currentYM };
}

/**
 * 금액 포맷팅
 */
function formatAmount(amount: number): string {
  if (amount >= 10000) {
    const billion = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    const thousand = Math.floor(remainder / 1000);
    
    let result = `${billion}억`;
    if (thousand > 0) {
      result += `${thousand}천`;
    }
    return result;
  } else if (amount >= 1000) {
    const thousand = Math.floor(amount / 1000);
    return `${thousand}천`;
  }
  return `${amount}`;
}