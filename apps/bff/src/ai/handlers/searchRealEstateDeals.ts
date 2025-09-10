import { fetchDeals, findApartmentByName } from '../repo/dealsRepo';

interface SearchRealEstateDealsParams {
  aptId?: number;
  apartmentName?: string;
  dealType?: '매매' | '전세' | '월세' | '전월세';
  area?: number;
  period?: string;
  areaRange?: number[];
  limit?: number;
}

/**
 * 특정 아파트의 실거래 데이터를 검색합니다.
 */
export async function searchRealEstateDeals(args: SearchRealEstateDealsParams): Promise<any> {
  const { 
    aptId, 
    apartmentName, 
    dealType = '전체', 
    area, 
    period = '최근 1년',
    areaRange,
    limit = 50 
  } = args;

  try {
    console.log('🔍 실거래가 검색:', { aptId, apartmentName, dealType, area, period });

    // 기간 파싱
    const { fromYM, toYM } = parsePeriod(period);

    // 아파트명으로 ID 조회 (aptId가 없는 경우)
    let targetAptId = aptId;
    let targetAptName = apartmentName;
    
    if (!targetAptId && apartmentName) {
      console.log(`🔍 아파트명으로 ID 검색 시도: "${apartmentName}"`);
      const aptInfo = await findApartmentByName(apartmentName);
      if (aptInfo) {
        targetAptId = aptInfo.id;
        targetAptName = aptInfo.name;
        console.log(`✅ 아파트 매핑 성공: "${apartmentName}" → "${aptInfo.name}" (ID: ${aptInfo.id})`);
      } else {
        console.log(`❌ 아파트 검색 실패: "${apartmentName}"`);
        return {
          success: false,
          error: `"${apartmentName}" 이름의 아파트를 찾을 수 없습니다. 정확한 아파트명을 확인해주세요.`,
          suggestions: '아파트명을 정확히 입력하거나, 일부 키워드로도 검색 가능합니다.',
          dataSchema: {
            dealAmount: '매매가 (만원 단위)',
            deposit: '보증금 (만원 단위)', 
            monthlyRent: '월세 (만원 단위)',
            exclusiveArea: '전용면적 (㎡)',
            note: '예: dealAmount 50000 = 5억원'
          }
        };
      }
    }

    if (!targetAptId && !apartmentName) {
      return {
        success: false,
        error: '아파트 ID 또는 아파트명이 필요합니다. 예: "마곡엠밸리7단지"',
        dataSchema: {
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)', 
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          note: '예: dealAmount 50000 = 5억원'
        }
      };
    }

    // 면적 필터 설정
    let areaMin: number | undefined;
    let areaMax: number | undefined;
    
    if (area) {
      // ±5㎡ 오차 허용
      areaMin = area - 5;
      areaMax = area + 5;
    } else if (areaRange && areaRange.length === 2) {
      areaMin = areaRange[0];
      areaMax = areaRange[1];
    }

    // 거래 유형 정규화
    const normalizedDealType = dealType === '전월세' ? '전체' : dealType;

    // 데이터 조회
    const deals = await fetchDeals({
      aptId: targetAptId,
      apartmentName: apartmentName,
      dealType: normalizedDealType,
      fromYM,
      toYM,
      areaMin,
      areaMax,
      limit
    });

    if (deals.length === 0) {
      return {
        success: true,
        message: '해당 조건의 실거래 데이터가 없습니다.',
        searchConditions: {
          apartmentName: targetAptName,
          dealType: normalizedDealType,
          period,
          area: area ? `${area}㎡ (±5㎡)` : undefined,
          areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
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
    const formattedDeals = deals.map(deal => ({
      dealDate: `${deal.dealYear}.${String(deal.dealMonth).padStart(2, '0')}.${String(deal.dealDay).padStart(2, '0')}`,
      dealType: deal.dealType,
      dealAmount: deal.dealAmount,
      deposit: deal.deposit, 
      monthlyRent: deal.monthlyRent,
      exclusiveArea: deal.exclusiveArea,
      floor: deal.floor,
      apartmentName: deal.apartmentName || targetAptName,
      // 가독성을 위한 추가 필드
      dealAmountFormatted: deal.dealAmount ? `${Math.floor(deal.dealAmount / 10000)}억${deal.dealAmount % 10000 ? Math.floor((deal.dealAmount % 10000) / 1000) + '천' : ''}` : undefined,
      pricePerSqm: deal.dealAmount ? Math.round(deal.dealAmount * 10000 / deal.exclusiveArea) : undefined
    }));

    return {
      success: true,
      searchConditions: {
        apartmentName: targetAptName,
        dealType: normalizedDealType,
        period,
        area: area ? `${area}㎡ (±5㎡)` : undefined,
        areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined
      },
      deals: formattedDeals,
      totalCount: deals.length,
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        deposit: '보증금 (만원 단위)', 
        monthlyRent: '월세 (만원 단위)',
        exclusiveArea: '전용면적 (㎡)',
        pricePerSqm: '평단가 (원/㎡)',
        note: '30000 = 3억원, 500 = 5천만원'
      }
    };

  } catch (error: any) {
    console.error('❌ searchRealEstateDeals 오류:', error);
    return {
      success: false,
      error: error.message || '실거래 데이터 검색 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 기간 문자열을 YYYYMM 정수로 파싱
 */
function parsePeriod(period: string): { fromYM: number; toYM: number } {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYM = currentYear * 100 + currentMonth;

  let monthsAgo = 12; // 기본값: 1년

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

  // 시작 날짜 계산
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsAgo);
  const fromYM = startDate.getFullYear() * 100 + (startDate.getMonth() + 1);

  return { fromYM, toYM: currentYM };
}