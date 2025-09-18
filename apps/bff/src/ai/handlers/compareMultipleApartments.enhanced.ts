import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';
import { findBestApartmentMatch, generateSmartQuestion, normalizeApartmentName } from './database/normalizeApartmentName';

interface CompareMultipleApartmentsParams {
  apartmentList: string[];                 // ["현대", "신당푸르지오"] - 다중 아파트
  region?: string;                         // "강서구", "신당동" 등
  dealType?: '매매' | '전세' | '월세' | '전체';
  period?: string;                         // "3개월" 등
  area?: number;                           // 특정 전용면적
  areaRange?: [number, number];
  priceRange?: [number, number];           // 만원 단위 가정
  limit?: number;
  userProfile?: any;                       // 사용자 프로필 (개인화)
  persistentAttachedApartments?: Array<{   // 🆕 챗봇에서 첨부된 아파트들
    id: number;
    name: string;
    address: string;
    lat: number;
    lon: number;
  }>;
}

/**
 * 다중 아파트 비교 분석 함수
 */
export async function compareMultipleApartments(args: CompareMultipleApartmentsParams): Promise<any> {
  const {
    apartmentList,
    region,
    dealType = '매매',
    period,
    area,
    areaRange,
    priceRange,
    limit = 50,
    userProfile,
    persistentAttachedApartments,
  } = args;

  try {
    console.log('🔍 다중 아파트 비교 시작:', {
      apartmentList, region, dealType, period, area, areaRange, priceRange, limit,
      persistentAttachedApartments: persistentAttachedApartments?.length || 0
    });

    // 🆕 첨부된 아파트가 있고 명시적인 아파트 목록이 없으면 첨부된 아파트 사용
    let finalApartmentList = apartmentList;
    if ((!apartmentList || apartmentList.length === 0) && persistentAttachedApartments && persistentAttachedApartments.length >= 2) {
      finalApartmentList = persistentAttachedApartments.map(apt => apt.name);
      console.log('✅ 첨부된 아파트들로 비교 분석:', finalApartmentList);
    }

    if (!finalApartmentList || finalApartmentList.length === 0) {
      return {
        success: false,
        needsMultipleApartments: true,
        message: '어떤 아파트들을 비교해드릴까요? 😊',
        helpText: '2개 이상의 아파트를 알려주시면 상세한 비교 분석을 해드릴게요!',
        examples: [
          '"@잠실래미안 @잠실리센츠" 처럼 여러 아파트 멘션하기',
          '"현대아파트랑 삼성아파트 비교해줘" 처럼 자연스럽게 말하기',
          '요약 카드에서 여러 아파트를 첨부한 후 "이것들 비교해줘" 하기'
        ],
        dataSchema: {
          apartmentList: '아파트 이름 배열 (예: ["현대", "신당푸르지오"])',
          dealType: '거래 유형 (매매/전세/월세)',
          note: '2개 이상의 아파트가 필요해요!'
        }
      };
    }

    if (finalApartmentList.length < 2) {
      const currentApartment = finalApartmentList[0];
      return {
        success: false,
        needsMoreApartments: true,
        message: `"${currentApartment}"와 비교할 다른 아파트를 알려주세요! 😊`,
        suggestion: `예를 들어 "${currentApartment}랑 OO아파트 비교해줘" 처럼 말씀해주시면 돼요.`,
        currentApartments: finalApartmentList,
        helpText: '같은 지역이나 관심 있는 다른 아파트와 비교해보시는 건 어떨까요?'
      };
    }

    // 1️⃣ 각 아파트별 데이터 수집
    const apartmentResults = [];

    for (const apartmentName of finalApartmentList) {
      console.log(`🏠 아파트 "${apartmentName}" 데이터 수집 중...`);

      // 아파트명 정규화
      const candidates = await normalizeApartmentName(apartmentName, region);
      let finalApartmentName = apartmentName;
      let finalAptId = undefined;

      if (candidates && candidates.length > 0) {
        if (candidates.length === 1 || candidates[0].score <= 0.3) {
          const bestMatch = candidates[0];
          finalApartmentName = bestMatch.aptName;
          finalAptId = bestMatch.aptId;
          console.log(`✅ "${apartmentName}" → "${finalApartmentName}" (ID: ${finalAptId})`);
        } else {
          console.log(`⚠️ "${apartmentName}" 다중 후보 발견, 원본 이름 사용`);
        }
      }

      // SQL 조건 생성
      const conds: string[] = [];
      conds.push(`아파트 "${finalApartmentName}"`);
      if (region) conds.push(`${region}`);
      conds.push(`${dealType} 거래`);
      if (period) {
        const interval = parsePeriodToSqlInterval(period) ?? period;
        conds.push(`최근 ${period}(${interval})`);
      }
      if (area) conds.push(`전용면적 ${area}㎡ 근처`);
      if (areaRange) conds.push(`전용면적 ${areaRange[0]}~${areaRange[1]}㎡`);
      if (priceRange) conds.push(`거래금액 ${priceRange[0]}~${priceRange[1]}만원`);

      const what = conds.join(', ');

      const question = [
        `${what} 조건에 맞는 거래 목록을 최신순으로 ${limit}건 이내로 조회해줘.`,
        `반드시 날짜, 거래금액(deal_amount), 보증금(deposit), 월세(monthly_rent), 전용면적(exclu_use_ar), 층(floor) 컬럼을 포함해.`,
        `거래유형 구분: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세.`,
        area ? `전용면적 ${area}㎡의 경우 ±1㎡ 허용 범위 적용: exclu_use_ar BETWEEN ${area-1} AND ${area+1}.` : '',
        `oi.apt_deal_all 테이블을 사용해서 스키마/컬럼 자동 선택.`,
        finalAptId ? `apartment_id: ${finalAptId}` : ''
      ].filter(Boolean).join(' ');

      const { success, sql, rows, rowCount, error } = await orchestrateSelect({
        question,
        forceSchemaHints: [
          'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, floor, deal_year, deal_month, deal_day, apt_nm, jibun_address)',
          '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          '지역 필터링: jibun_address 컬럼 사용 (umdnm 컬럼 없음)',
          '날짜 정렬: ORDER BY deal_year DESC, deal_month DESC, deal_day DESC (MAKE_DATE 함수 사용 금지)',
          '단순한 SQL 생성: 복잡한 함수나 논리적 모순 조건 피하기',
          finalAptId ? `apartment_id: ${finalAptId}` : ''
        ].filter(Boolean),
        requireColumns: ['exclu_use_ar', 'floor'],
        safety: { maxRows: limit, readOnly: true },
      });

      // 결과 저장
      apartmentResults.push({
        apartmentName: finalApartmentName,
        originalName: apartmentName,
        aptId: finalAptId,
        success,
        error,
        deals: rows || [],
        dealCount: rowCount || 0,
        sql, // 디버깅용
        searchConditions: {
          apartmentName: finalApartmentName,
          region,
          dealType,
          period,
          area: area ? `${area}㎡` : undefined,
          areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined,
          priceRange: priceRange ? `${priceRange[0]}~${priceRange[1]}만원` : undefined
        }
      });

      console.log(`📊 "${apartmentName}" 수집 완료: ${rowCount || 0}건`);
    }

    // 2️⃣ 비교 분석 수행
    const comparison = performComparisonAnalysis(apartmentResults, dealType);

    // 3️⃣ 결과 반환
    return {
      success: true,
      comparisonType: 'multiple_apartments',
      apartments: apartmentResults,
      comparison,
      summary: generateComparisonSummary(apartmentResults, comparison),
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        deposit: '보증금 (만원 단위)',
        monthlyRent: '월세 (만원 단위)',
        exclusiveArea: '전용면적 (㎡)',
        dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
        note: '30000 = 3억원'
      }
    };

  } catch (error: any) {
    console.error('❌ compareMultipleApartments 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '다중 아파트 비교 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 비교 분석 수행
 */
function performComparisonAnalysis(apartmentResults: any[], dealType: string) {
  const validResults = apartmentResults.filter(result => result.success && result.deals.length > 0);

  if (validResults.length === 0) {
    return {
      status: 'no_data',
      message: '비교할 수 있는 아파트 데이터가 없습니다.'
    };
  }

  const comparison: any = {
    apartmentCount: validResults.length,
    dealType,
    metrics: {}
  };

  // 각 아파트별 통계 계산
  for (const result of validResults) {
    const { apartmentName, deals } = result;

    if (dealType === '매매') {
      const prices = deals
        .filter((deal: any) => deal.deal_amount || deal.dealamount)
        .map((deal: any) => deal.deal_amount || deal.dealamount);

      if (prices.length > 0) {
        comparison.metrics[apartmentName] = {
          avgPrice: Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length),
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          dealCount: prices.length,
          recentDeals: deals.slice(0, 3) // 최신 3건
        };
      }
    } else if (dealType === '전세') {
      const deposits = deals
        .filter((deal: any) => deal.deposit && (!deal.monthly_rent || deal.monthly_rent === 0))
        .map((deal: any) => deal.deposit);

      if (deposits.length > 0) {
        comparison.metrics[apartmentName] = {
          avgDeposit: Math.round(deposits.reduce((a: number, b: number) => a + b, 0) / deposits.length),
          minDeposit: Math.min(...deposits),
          maxDeposit: Math.max(...deposits),
          dealCount: deposits.length,
          recentDeals: deals.slice(0, 3)
        };
      }
    }
  }

  // 전체 비교 결론
  const apartmentNames = Object.keys(comparison.metrics);
  if (apartmentNames.length >= 2) {
    if (dealType === '매매') {
      const avgPrices = apartmentNames.map(name => comparison.metrics[name].avgPrice);
      const highest = apartmentNames[avgPrices.indexOf(Math.max(...avgPrices))];
      const lowest = apartmentNames[avgPrices.indexOf(Math.min(...avgPrices))];

      comparison.conclusion = {
        highest: { name: highest, avgPrice: comparison.metrics[highest].avgPrice },
        lowest: { name: lowest, avgPrice: comparison.metrics[lowest].avgPrice },
        priceDifference: comparison.metrics[highest].avgPrice - comparison.metrics[lowest].avgPrice
      };
    } else if (dealType === '전세') {
      const avgDeposits = apartmentNames.map(name => comparison.metrics[name].avgDeposit);
      const highest = apartmentNames[avgDeposits.indexOf(Math.max(...avgDeposits))];
      const lowest = apartmentNames[avgDeposits.indexOf(Math.min(...avgDeposits))];

      comparison.conclusion = {
        highest: { name: highest, avgDeposit: comparison.metrics[highest].avgDeposit },
        lowest: { name: lowest, avgDeposit: comparison.metrics[lowest].avgDeposit },
        depositDifference: comparison.metrics[highest].avgDeposit - comparison.metrics[lowest].avgDeposit
      };
    }
  }

  return comparison;
}

/**
 * 비교 요약 생성
 */
function generateComparisonSummary(apartmentResults: any[], comparison: any) {
  const validCount = apartmentResults.filter(r => r.success && r.deals.length > 0).length;
  const totalCount = apartmentResults.length;

  return {
    totalApartments: totalCount,
    validDataApartments: validCount,
    hasComparison: validCount >= 2,
    keyInsights: comparison.conclusion ? [
      `가장 비싼 아파트: ${comparison.conclusion.highest.name}`,
      `가장 저렴한 아파트: ${comparison.conclusion.lowest.name}`,
      `가격 차이: ${(comparison.conclusion.priceDifference || comparison.conclusion.depositDifference || 0).toLocaleString()}만원`
    ] : [],
    confidence: validCount >= 2 ? 0.9 : validCount === 1 ? 0.6 : 0.1
  };
}