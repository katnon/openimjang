import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';

interface GetDealDistributionParams {
  apartmentName?: string;
  aptId?: number;                         // 힌트로만 사용
  distributionType?: '가격대별' | '면적별' | '층별' | '전체';
  period?: string;                        // "6개월", "1년", "2년", "3년"
  dealType?: '매매' | '전세' | '월세' | '전체';
}

/**
 * 특정 아파트의 거래 분포를 분석합니다.
 */
export async function getDealDistribution(args: GetDealDistributionParams): Promise<any> {
  const { 
    apartmentName, 
    aptId, 
    distributionType = '전체',
    period = '1년', 
    dealType = '전체'
  } = args;

  try {
    console.log('📊 거래 분포 분석 (RAG 오케스트레이션):', { apartmentName, aptId, distributionType, period, dealType });

    if (!apartmentName) {
      return {
        success: false,
        error: '아파트명이 필요합니다.',
        dataSchema: {
          range: '구간 범위',
          count: '해당 구간의 거래 건수',
          note: '가격: 만원 단위, 면적: ㎡, 층: 층수'
        }
      };
    }

    const interval = parsePeriodToSqlInterval(period) ?? period;
    const distributions: any = {};

    // 분포 유형에 따라 데이터 조회
    const typesToAnalyze = distributionType === '전체' 
      ? ['가격대별', '면적별', '층별'] 
      : [distributionType];

    for (const type of typesToAnalyze) {
      try {
        const conds: string[] = [];
        conds.push(`아파트 "${apartmentName}"`);
        conds.push(`${dealType} 거래`);
        conds.push(`최근 ${period}(${interval})`);
        const what = conds.join(', ');

        let question = '';
        let groupByField = '';
        let bucketSize = '';

        switch (type) {
          case '가격대별':
            question = `${what} 조건의 거래를 가격대별로 분포 분석해줘. 5천만원 단위로 구간을 나눠서 각 구간별 거래건수를 집계해.`;
            groupByField = 'price_range';
            bucketSize = '5000만원';
            break;
          case '면적별':
            question = `${what} 조건의 거래를 전용면적별로 분포 분석해줘. 10㎡ 단위로 구간을 나눠서 각 구간별 거래건수를 집계해.`;
            groupByField = 'area_range';
            bucketSize = '10㎡';
            break;
          case '층별':
            question = `${what} 조건의 거래를 층별로 분포 분석해줘. 5층 단위로 구간을 나눠서 각 구간별 거래건수를 집계해.`;
            groupByField = 'floor_range';
            bucketSize = '5층';
            break;
        }

        question += ' 스키마/컬럼은 RAG 문서에 맞춰 자동 선택.';

        const hints: string[] = [
          'oi.apt_deal_trade_raw(dealamount, excluusear, floor, dealyear, dealmonth, dealday, aptnm, ...)',
        ];
        if (aptId) {
          hints.push(`apartment id (hint): ${aptId}`);
        }

        const { success, sql, rows, rowCount, error } = await orchestrateSelect({
          question,
          forceSchemaHints: hints,
          requireColumns: ['count'],
          safety: { maxRows: 100, readOnly: true },
        });

        if (!success || !rows || rows.length === 0) {
          distributions[type] = {
            bucketBy: type,
            bucketSize,
            distribution: [],
            totalCount: 0,
            error: error || `${type} 분포 데이터가 없습니다.`
          };
          continue;
        }

        // 결과 포맷팅
        const formattedDistribution = rows.map((item: any) => ({
          range: item.range || item.bucket || item.group,
          count: item.count || item.deal_count,
          _raw: item
        }));

        const totalCount = formattedDistribution.reduce((sum, item) => sum + (item.count || 0), 0);
        const summary = analyzeSimpleDistribution(formattedDistribution);

        distributions[type] = {
          bucketBy: type,
          bucketSize,
          distribution: formattedDistribution,
          totalCount,
          summary,
          sql // 디버깅용
        };
      } catch (error: any) {
        distributions[type] = {
          error: `${type} 분포 데이터 처리 오류: ${error.message}`
        };
      }
    }

    return {
      success: true,
      searchConditions: {
        apartmentName,
        distributionType,
        period,
        dealType
      },
      distributions,
      dataSchema: {
        range: '구간 범위',
        count: '해당 구간의 거래 건수',
        note: '가격: 만원 단위, 면적: ㎡, 층: 층수, AI가 자연어로 생성한 분포 분석 결과'
      }
    };

  } catch (error: any) {
    console.error('❌ getDealDistribution 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '거래 분포 분석 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 간단한 분포 분석
 */
function analyzeSimpleDistribution(distribution: any[]): any {
  if (distribution.length === 0) {
    return { message: '분석할 데이터가 없습니다.' };
  }

  // 가장 빈번한 구간 찾기
  const maxCountBucket = distribution.reduce((max, bucket) => 
    (bucket.count || 0) > (max.count || 0) ? bucket : max
  );

  // 분포 특성 분석
  const totalCount = distribution.reduce((sum, bucket) => sum + (bucket.count || 0), 0);
  const nonZeroBuckets = distribution.filter(bucket => (bucket.count || 0) > 0);
  
  return {
    mostFrequentRange: maxCountBucket.range,
    mostFrequentCount: maxCountBucket.count || 0,
    distributionSpread: nonZeroBuckets.length,
    averageCountPerBucket: nonZeroBuckets.length > 0 ? Math.round(totalCount / nonZeroBuckets.length) : 0,
    concentrationRate: totalCount > 0 ? Math.round(((maxCountBucket.count || 0) / totalCount) * 100) : 0
  };
}