import { fetchHistogram, findApartmentByName } from '../repo/dealsRepo';

interface GetDealDistributionParams {
  apartmentName?: string;
  aptId?: number;
  distributionType?: '가격대별' | '면적별' | '층별' | '전체';
  period?: '6개월' | '1년' | '2년' | '3년';
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
    console.log('📊 거래 분포 분석:', { apartmentName, aptId, distributionType, period, dealType });

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

    const distributions: any = {};

    // 분포 유형에 따라 데이터 조회
    const typesToAnalyze = distributionType === '전체' 
      ? ['가격대별', '면적별', '층별'] 
      : [distributionType];

    for (const type of typesToAnalyze) {
      const bucketBy = type === '가격대별' ? '가격' : type === '면적별' ? '면적' : '층';
      const bucketSize = getBucketSize(bucketBy);

      try {
        const histogram = await fetchHistogram({
          apartmentName,
          aptId: targetAptId,
          bucketBy,
          bucketSize,
          dealType: dealType === '전체' ? '매매' : dealType,
          fromYM,
          toYM
        });

        distributions[type] = {
          bucketBy,
          bucketSize,
          distribution: histogram,
          totalCount: histogram.reduce((sum, item) => sum + item.count, 0),
          summary: analyzeBuckets(histogram, bucketBy)
        };
      } catch (error) {
        distributions[type] = {
          error: `${type} 분포 데이터를 가져올 수 없습니다.`
        };
      }
    }

    return {
      success: true,
      searchConditions: {
        apartmentName: targetAptName,
        distributionType,
        period,
        dealType
      },
      distributions,
      dataSchema: {
        range: '구간 범위',
        count: '해당 구간의 거래 건수',
        note: '가격: 만원 단위, 면적: ㎡, 층: 층수'
      }
    };

  } catch (error: any) {
    console.error('❌ getDealDistribution 오류:', error);
    return {
      success: false,
      error: error.message || '거래 분포 분석 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 분포 유형에 따른 버킷 크기 결정
 */
function getBucketSize(bucketBy: string): number {
  switch (bucketBy) {
    case '가격':
      return 5000; // 5천만원 단위
    case '면적':
      return 10;   // 10㎡ 단위
    case '층':
      return 5;    // 5층 단위
    default:
      return 1;
  }
}

/**
 * 버킷 분석
 */
function analyzeBuckets(histogram: any[], bucketBy: string): any {
  if (histogram.length === 0) {
    return { message: '분석할 데이터가 없습니다.' };
  }

  // 가장 빈번한 구간 찾기
  const maxCountBucket = histogram.reduce((max, bucket) => 
    bucket.count > max.count ? bucket : max
  );

  // 분포 특성 분석
  const totalCount = histogram.reduce((sum, bucket) => sum + bucket.count, 0);
  const nonZeroBuckets = histogram.filter(bucket => bucket.count > 0);
  
  return {
    mostFrequentRange: maxCountBucket.range,
    mostFrequentCount: maxCountBucket.count,
    distributionSpread: nonZeroBuckets.length,
    averageCountPerBucket: Math.round(totalCount / nonZeroBuckets.length),
    concentrationRate: Math.round((maxCountBucket.count / totalCount) * 100)
  };
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