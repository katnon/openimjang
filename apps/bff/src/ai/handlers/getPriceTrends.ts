import { fetchTrendAgg, findApartmentByName } from '../repo/dealsRepo';

interface GetPriceTrendsParams {
  aptId?: number;
  apartmentName?: string;
  period?: '1년' | '2년' | '3년' | '5년';
  dealType?: '매매' | '전세' | '월세' | '전체';
  areaRange?: number[];
}

/**
 * 특정 아파트의 가격 트렌드를 분석합니다.
 */
export async function getPriceTrends(args: GetPriceTrendsParams): Promise<any> {
  const { 
    aptId, 
    apartmentName, 
    period = '3년', 
    dealType = '전체',
    areaRange
  } = args;

  try {
    console.log('📈 가격 트렌드 분석:', { aptId, apartmentName, period, dealType, areaRange });

    // 아파트명으로 ID 조회 (aptId가 없는 경우)
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
        error: '아파트 ID 또는 아파트명이 필요합니다.',
        dataSchema: {
          value: '월별 평균 거래가 (만원 단위)',
          sampleCount: '해당 월의 거래 건수',
          note: '30000 = 3억원'
        }
      };
    }

    // 기간을 개월 수로 변환
    const periodMonths = parsePeriodToMonths(period);

    // 매매 트렌드 데이터 조회
    let trendData = [];
    let dealTypeFilter = dealType;
    
    if (dealType === '전체' || dealType === '매매') {
      const tradeTrends = await fetchTrendAgg({
        apartmentName: apartmentName,
        aptId: targetAptId,
        dealType: '매매',
        periodMonths,
        groupBy: '월',
        metric: '평균'
      });
      
      trendData.push(...tradeTrends.map(trend => ({
        ...trend,
        dealType: '매매'
      })));
    }

    // 전세 트렌드는 추후 구현 (현재 dealsRepo에서 매매만 지원)
    if ((dealType === '전체' || dealType === '전세') && dealType !== '매매') {
      // TODO: 전세 트렌드 데이터 추가
    }

    if (trendData.length === 0) {
      return {
        success: true,
        message: '해당 조건의 가격 트렌드 데이터가 없습니다.',
        searchConditions: {
          apartmentName: targetAptName,
          period,
          dealType,
          areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
        },
        trends: [],
        totalCount: 0,
        dataSchema: {
          value: '월별 평균 거래가 (만원 단위)',
          sampleCount: '해당 월의 거래 건수',
          note: '30000 = 3억원'
        }
      };
    }

    // 트렌드 분석
    const analysis = analyzePriceTrend(trendData);
    
    // 결과 포맷팅
    const formattedTrends = trendData.map((trend, index) => ({
      period: trend.key,
      averagePrice: trend.value,
      sampleCount: trend.sampleCount,
      dealType: trend.dealType || '매매',
      // 가독성을 위한 추가 필드
      averagePriceFormatted: formatAmount(trend.value),
      // 전월 대비 변화율
      changeFromPreviousMonth: index > 0 ? calculateChangeRate(trendData[index - 1].value, trend.value) : null,
      changeFromPreviousMonthPercent: index > 0 ? calculateChangePercent(trendData[index - 1].value, trend.value) : null
    }));

    return {
      success: true,
      searchConditions: {
        apartmentName: targetAptName,
        period,
        dealType,
        areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
      },
      trends: formattedTrends,
      analysis: {
        ...analysis,
        periodSummary: `${period} 동안의 가격 트렌드`,
        averagePriceOverPeriod: Math.round(trendData.reduce((sum, t) => sum + t.value, 0) / trendData.length),
        totalSampleCount: trendData.reduce((sum, t) => sum + t.sampleCount, 0)
      },
      totalCount: trendData.length,
      dataSchema: {
        averagePrice: '월별 평균 거래가 (만원 단위)',
        sampleCount: '해당 월의 거래 건수',
        changeFromPreviousMonth: '전월 대비 변화액 (만원)',
        changeFromPreviousMonthPercent: '전월 대비 변화율 (%)',
        note: '30000 = 3억원, +1000 = 1천만원 상승'
      }
    };

  } catch (error: any) {
    console.error('❌ getPriceTrends 오류:', error);
    return {
      success: false,
      error: error.message || '가격 트렌드 분석 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 기간 문자열을 개월 수로 변환
 */
function parsePeriodToMonths(period: string): number {
  switch (period) {
    case '1년':
      return 12;
    case '2년':
      return 24;
    case '3년':
      return 36;
    case '5년':
      return 60;
    default:
      return 36; // 기본값: 3년
  }
}

/**
 * 가격 트렌드 분석
 */
function analyzePriceTrend(trendData: any[]): any {
  if (trendData.length < 2) {
    return {
      trend: '분석불가',
      reason: '데이터가 부족합니다 (최소 2개월 필요)'
    };
  }

  const firstValue = trendData[0].value;
  const lastValue = trendData[trendData.length - 1].value;
  const totalChange = lastValue - firstValue;
  const totalChangePercent = ((totalChange / firstValue) * 100).toFixed(2);

  // 연속 상승/하락 구간 분석
  let upwardMonths = 0;
  let downwardMonths = 0;
  
  for (let i = 1; i < trendData.length; i++) {
    if (trendData[i].value > trendData[i - 1].value) {
      upwardMonths++;
    } else if (trendData[i].value < trendData[i - 1].value) {
      downwardMonths++;
    }
  }

  let trendDirection = '안정';
  if (Math.abs(totalChangePercent) > 5) {
    trendDirection = totalChange > 0 ? '상승' : '하락';
  }

  return {
    trend: trendDirection,
    totalChange,
    totalChangePercent: parseFloat(totalChangePercent),
    totalChangeFormatted: formatAmount(Math.abs(totalChange)),
    upwardMonths,
    downwardMonths,
    stabilityScore: Math.round(((trendData.length - 1 - upwardMonths - downwardMonths) / (trendData.length - 1)) * 100),
    highestPrice: Math.max(...trendData.map(t => t.value)),
    lowestPrice: Math.min(...trendData.map(t => t.value))
  };
}

/**
 * 전월 대비 변화액 계산 (만원)
 */
function calculateChangeRate(prevValue: number, currentValue: number): number {
  return currentValue - prevValue;
}

/**
 * 전월 대비 변화율 계산 (%)
 */
function calculateChangePercent(prevValue: number, currentValue: number): number {
  if (prevValue === 0) return 0;
  return Math.round(((currentValue - prevValue) / prevValue) * 10000) / 100;
}

/**
 * 금액을 읽기 쉬운 형태로 포맷팅 (만원 단위 → 억/천만원)
 */
function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 10000) {
    const billion = Math.floor(absAmount / 10000);
    const remainder = absAmount % 10000;
    const thousand = Math.floor(remainder / 1000);
    
    let result = `${billion}억`;
    if (thousand > 0) {
      result += `${thousand}천`;
    }
    if (remainder % 1000 > 0) {
      result += `${remainder % 1000}`;
    }
    
    return amount < 0 ? `-${result}` : result;
  } else if (absAmount >= 1000) {
    const thousand = Math.floor(absAmount / 1000);
    const remainder = absAmount % 1000;
    const result = remainder > 0 ? `${thousand}천${remainder}` : `${thousand}천`;
    return amount < 0 ? `-${result}` : result;
  } else {
    return `${amount}`;
  }
}