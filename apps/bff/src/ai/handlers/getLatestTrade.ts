import { fetchLatestDeals, findApartmentByName } from '../repo/dealsRepo';

interface GetLatestTradeParams {
  apartmentName?: string;
  aptId?: number;
  limit?: number;
  dealType?: '매매' | '전세' | '월세' | '전체';
}

/**
 * 특정 아파트의 최근 거래 내역을 조회합니다.
 */
export async function getLatestTrade(args: GetLatestTradeParams): Promise<any> {
  const { apartmentName, aptId, limit = 10, dealType = '전체' } = args;

  try {
    console.log('🔍 최근 거래 내역 조회:', { apartmentName, aptId, limit, dealType });

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
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)', 
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          note: '30000 = 3억원'
        }
      };
    }

    // 최근 거래 데이터 조회
    const deals = await fetchLatestDeals({
      apartmentName: apartmentName,
      aptId: targetAptId,
      limit
    });

    // 거래 유형 필터 적용 (전체가 아닌 경우)
    let filteredDeals = deals;
    if (dealType !== '전체') {
      filteredDeals = deals.filter(deal => deal.dealType === dealType);
    }

    if (filteredDeals.length === 0) {
      return {
        success: true,
        message: '해당 조건의 최근 거래 데이터가 없습니다.',
        searchConditions: {
          apartmentName: targetAptName,
          dealType,
          limit
        },
        deals: [],
        totalCount: 0,
        dataSchema: {
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)',
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          note: '30000 = 3억원'
        }
      };
    }

    // 결과 포맷팅
    const formattedDeals = filteredDeals.slice(0, limit).map(deal => {
      const dealAmount = deal.dealAmount;
      const deposit = deal.deposit;
      const monthlyRent = deal.monthlyRent;
      
      return {
        dealDate: `${deal.dealYear}.${String(deal.dealMonth).padStart(2, '0')}.${String(deal.dealDay).padStart(2, '0')}`,
        dealType: deal.dealType,
        dealAmount,
        deposit,
        monthlyRent,
        exclusiveArea: deal.exclusiveArea,
        floor: deal.floor,
        apartmentName: deal.apartmentName || targetAptName,
        // 가독성을 위한 추가 필드
        dealAmountFormatted: dealAmount ? formatAmount(dealAmount) : undefined,
        depositFormatted: deposit ? formatAmount(deposit) : undefined,
        monthlyRentFormatted: monthlyRent ? formatAmount(monthlyRent) : undefined,
        pricePerSqm: dealAmount ? Math.round(dealAmount * 10000 / deal.exclusiveArea) : undefined,
        daysAgo: calculateDaysAgo(`${deal.dealYear}${String(deal.dealMonth).padStart(2, '0')}${String(deal.dealDay).padStart(2, '0')}`)
      };
    });

    return {
      success: true,
      searchConditions: {
        apartmentName: targetAptName,
        dealType,
        limit
      },
      deals: formattedDeals,
      totalCount: formattedDeals.length,
      summary: {
        매매: filteredDeals.filter(d => d.dealType === '매매').length,
        전세: filteredDeals.filter(d => d.dealType === '전세').length,
        월세: filteredDeals.filter(d => d.dealType === '월세').length
      },
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        deposit: '보증금 (만원 단위)', 
        monthlyRent: '월세 (만원 단위)',
        exclusiveArea: '전용면적 (㎡)',
        pricePerSqm: '평단가 (원/㎡)',
        daysAgo: '거래일로부터 경과 일수',
        note: '30000 = 3억원, 500 = 5천만원'
      }
    };

  } catch (error: any) {
    console.error('❌ getLatestTrade 오류:', error);
    return {
      success: false,
      error: error.message || '최근 거래 내역 조회 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 금액을 읽기 쉬운 형태로 포맷팅 (만원 단위 → 억/천만원)
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
    if (remainder % 1000 > 0) {
      result += `${remainder % 1000}`;
    }
    return result;
  } else if (amount >= 1000) {
    const thousand = Math.floor(amount / 1000);
    const remainder = amount % 1000;
    return remainder > 0 ? `${thousand}천${remainder}` : `${thousand}천`;
  } else {
    return `${amount}`;
  }
}

/**
 * 거래일로부터 경과 일수 계산
 */
function calculateDaysAgo(dealYmd: string): number {
  const dealDate = new Date(
    parseInt(dealYmd.substring(0, 4)),
    parseInt(dealYmd.substring(4, 6)) - 1,
    parseInt(dealYmd.substring(6, 8))
  );
  const currentDate = new Date();
  const diffTime = currentDate.getTime() - dealDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}