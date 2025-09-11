import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';
import { findBestApartmentMatch, generateSmartQuestion, normalizeApartmentName } from './database/normalizeApartmentName';

interface GetPriceTrendsParams {
  apartmentName?: string;            // "마곡엠밸리", "신당 현대" 등
  region?: string;                   // 선택적 지역 힌트
  aptId?: number;                    // 힌트로만 사용
  period?: string;                   // "1년", "2년", "3년", "5년"
  dealType?: '매매' | '전세' | '월세' | '전체';
  areaRange?: [number, number];
  userProfile?: any;                 // 사용자 프로필 (개인화)
}

/**
 * 특정 아파트의 가격 트렌드를 분석합니다.
 */
export async function getPriceTrends(args: GetPriceTrendsParams): Promise<any> {
  const { 
    aptId, 
    apartmentName, 
    region,
    period = '3년', 
    dealType = '전체',
    areaRange,
    userProfile
  } = args;

  try {
    console.log('📈 가격 트렌드 분석 (RAG 오케스트레이션):', { aptId, apartmentName, region, period, dealType, areaRange });

    // 1️⃣ 아파트명 정규화
    let finalApartmentName = apartmentName;
    let searchHints: string[] = [];
    
    if (apartmentName) {
      const normalizedApt = await findBestApartmentMatch(apartmentName, region);
      
      if (normalizedApt) {
        finalApartmentName = normalizedApt.aptName;
        searchHints.push(`apartment_id: ${normalizedApt.aptId}`);
        console.log('✅ 아파트명 정규화 성공:', {
          입력: apartmentName,
          정규화: finalApartmentName,
          점수: normalizedApt.score.toFixed(3)
        });
      } else {
        const candidates = await normalizeApartmentName(apartmentName, region);
        if (candidates && candidates.length > 1) {
          return {
            success: false,
            error: '여러 아파트가 검색되었습니다.',
            suggestions: generateSmartQuestion(candidates, apartmentName),
            candidates: candidates.map(c => ({ aptId: c.aptId, aptName: c.aptName, region: c.region }))
          };
        }
        console.log('⚠️ 아파트명 정규화 실패, 원본 이름 사용:', apartmentName);
      }
    }

    if (!apartmentName) {
      return {
        success: false,
        error: '아파트명이 필요합니다.',
        dataSchema: {
          averagePrice: '월별 평균 거래가 (만원 단위)',
          sampleCount: '해당 월의 거래 건수',
          period: '거래 기간 (YYYY.MM)',
          note: '30000 = 3억원'
        }
      };
    }

    const interval = parsePeriodToSqlInterval(period) ?? period;
    
    const conds: string[] = [];
    if (finalApartmentName) conds.push(`아파트 "${finalApartmentName}"`);
    conds.push(`${dealType} 거래`);
    conds.push(`최근 ${period}(${interval})`);
    if (areaRange) conds.push(`전용면적 ${areaRange[0]}~${areaRange[1]}㎡`);
    const what = conds.join(', ');

    const question = [
      `${what} 조건에 맞는 월별 평균 거래가 트렌드를 조회해줘.`,
      `월(YYYY-MM) 단위로 그룹핑해서 각 월별 평균 거래금액(매매=deal_amount, 전월세=deposit), 거래 건수를 구해줘.`,
      `거래유형 구분: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세.`,
      `시간 순서대로 정렬해서 트렌드 분석이 가능하도록 oi.apt_deal_all 테이블 사용.`,
    ].join(' ');

    const hints: string[] = [
      'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, deal_year, deal_month, deal_day, apt_nm, ...)',
      '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
      ...searchHints
    ];
    if (aptId) {
      hints.push(`apartment id (hint): ${aptId}`);
    }

    const { success, sql, rows, rowCount, error } = await orchestrateSelect({
      question,
      forceSchemaHints: hints,
      requireColumns: [],  // 거래유형에 따라 deal_amount 또는 deposit 사용
      userProfile,
      safety: { maxRows: 100, readOnly: true },
    });

    if (!success) {
      return {
        success: false,
        error: error || '가격 트렌드 분석에 실패했습니다.',
        dataSchema: {
          averagePrice: '월별 평균 거래가 (만원 단위)',
          sampleCount: '해당 월의 거래 건수',
          period: '거래 기간 (YYYY.MM)',
          dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          note: '30000 = 3억원'
        }
      };
    }

    if (!rows || rows.length === 0) {
      return {
        success: true,
        message: '해당 조건의 가격 트렌드 데이터가 없습니다.',
        searchConditions: {
          apartmentName,
          period,
          dealType,
          areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
        },
        trends: [],
        totalCount: 0,
        sql, // 디버깅용
        dataSchema: {
          averagePrice: '월별 평균 거래가 (만원 단위)',
          sampleCount: '해당 월의 거래 건수',
          period: '거래 기간 (YYYY.MM)',
          dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          note: '30000 = 3억원'
        }
      };
    }

    // 결과 포맷팅 (AI가 반환한 원본 데이터를 표준화)
    const formattedTrends = rows.map((trend: any, index: number) => {
      // 거래가 결정 (매매=deal_amount, 전월세=deposit)
      const priceValue = trend.avg_price || trend.average_price || 
                        trend.deal_amount || trend.dealamount || 
                        trend.deposit;
      
      return {
        period: trend.period || trend.month || `${trend.year || trend.deal_year}.${String(trend.month || trend.deal_month).padStart(2, '0')}`,
        averagePrice: priceValue,
        sampleCount: trend.count || trend.sample_count || trend.deal_count,
        dealType: dealType,
        // 전월 대비 변화율 계산 (AI가 반환하지 않은 경우)
        changeFromPreviousMonth: index > 0 
          ? priceValue - (rows[index - 1].avg_price || rows[index - 1].average_price || 
                         rows[index - 1].deal_amount || rows[index - 1].dealamount || 
                         rows[index - 1].deposit)
          : null,
        changeFromPreviousMonthPercent: index > 0 
          ? calculateChangePercent(
              rows[index - 1].avg_price || rows[index - 1].average_price || 
              rows[index - 1].deal_amount || rows[index - 1].dealamount || 
              rows[index - 1].deposit,
              priceValue
            ) 
          : null,
        // 원본 데이터 보존
        _raw: trend
      };
    });

    // 간단한 트렌드 분석
    const analysis = analyzeTrendFromFormatted(formattedTrends);

    return {
      success: true,
      searchConditions: {
        apartmentName,
        period,
        dealType,
        areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
      },
      trends: formattedTrends,
      analysis,
      totalCount: formattedTrends.length,
      sql, // 생성된 SQL 쿼리 (디버깅용)
      dataSchema: {
        averagePrice: '월별 평균 거래가 (만원 단위)',
        sampleCount: '해당 월의 거래 건수',
        period: '거래 기간 (YYYY.MM)',
        changeFromPreviousMonth: '전월 대비 변화액 (만원)',
        changeFromPreviousMonthPercent: '전월 대비 변화율 (%)',
        dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
        note: '30000 = 3억원, AI가 자연어로 생성한 트렌드 결과 (oi.apt_deal_all 테이블)'
      }
    };

  } catch (error: any) {
    console.error('❌ getPriceTrends 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '가격 트렌드 분석 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 전월 대비 변화율 계산 (%)
 */
function calculateChangePercent(prevValue: number, currentValue: number): number {
  if (prevValue === 0) return 0;
  return Math.round(((currentValue - prevValue) / prevValue) * 10000) / 100;
}

/**
 * 포맷팅된 트렌드 데이터에서 간단한 분석 수행
 */
function analyzeTrendFromFormatted(trends: any[]): any {
  if (trends.length < 2) {
    return {
      trend: '분석불가',
      reason: '데이터가 부족합니다 (최소 2개월 필요)',
      periodSummary: '분석 불가',
      totalSampleCount: trends.length > 0 ? trends[0].sampleCount : 0
    };
  }

  const firstPrice = trends[0].averagePrice || 0;
  const lastPrice = trends[trends.length - 1].averagePrice || 0;
  const totalChange = lastPrice - firstPrice;
  const totalChangePercent = ((totalChange / firstPrice) * 100).toFixed(2);

  // 상승/하락 구간 계산
  let upwardMonths = 0;
  let downwardMonths = 0;
  
  for (let i = 1; i < trends.length; i++) {
    const currentPrice = trends[i].averagePrice || 0;
    const previousPrice = trends[i - 1].averagePrice || 0;
    if (currentPrice > previousPrice) {
      upwardMonths++;
    } else if (currentPrice < previousPrice) {
      downwardMonths++;
    }
  }

  let trendDirection = '안정';
  if (Math.abs(parseFloat(totalChangePercent)) > 5) {
    trendDirection = totalChange > 0 ? '상승' : '하락';
  }

  const averagePriceOverPeriod = Math.round(
    trends.reduce((sum, t) => sum + (t.averagePrice || 0), 0) / trends.length
  );
  const totalSampleCount = trends.reduce((sum, t) => sum + (t.sampleCount || 0), 0);
  const validPrices = trends.map(t => t.averagePrice || 0).filter(p => p > 0);
  const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

  return {
    trend: trendDirection,
    totalChange,
    totalChangePercent: parseFloat(totalChangePercent),
    upwardMonths,
    downwardMonths,
    stabilityScore: Math.round(
      ((trends.length - 1 - upwardMonths - downwardMonths) / (trends.length - 1)) * 100
    ),
    highestPrice,
    lowestPrice,
    periodSummary: `${trends.length}개월 동안의 가격 트렌드`,
    averagePriceOverPeriod,
    totalSampleCount
  };
}