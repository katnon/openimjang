import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';
import { findBestApartmentMatch, generateSmartQuestion, normalizeApartmentName } from './database/normalizeApartmentName';

interface SearchRealEstateDealsParams {
  apartmentName?: string;                  // "마곡엠밸리", "신당 현대" 등
  aptId?: number;                          // 아파트 ID (우선순위)
  region?: string;                         // "강서구", "신당동" 등
  dealType?: '매매' | '전세' | '월세' | '전체';
  period?: string;                         // "3개월" 등
  area?: number;                           // 특정 전용면적
  areaRange?: [number, number];
  priceRange?: [number, number];           // 만원 단위 가정
  limit?: number;
  userProfile?: any;                       // 사용자 프로필 (개인화)
}

/**
 * 특정 아파트의 실거래 데이터를 검색합니다.
 */
export async function searchRealEstateDeals(args: SearchRealEstateDealsParams): Promise<any> {
  const {
    apartmentName,
    aptId,
    region,
    dealType = '매매',
    period,
    area,
    areaRange,
    priceRange,
    limit = 50,
    userProfile,
  } = args;

  try {
    console.log('🔍 실거래가 검색 (RAG 오케스트레이션):', { 
      apartmentName, aptId, region, dealType, period, area, areaRange, priceRange, limit 
    });

    // 1️⃣ 아파트 식별: ID가 있으면 우선 사용, 없으면 이름으로 정규화
    let finalApartmentName = apartmentName;
    let finalAptId = aptId;
    let searchHints: string[] = [];
    
    if (aptId) {
      // ID가 있으면 우선 사용 (메타데이터에서 전달된 경우)
      searchHints.push(`apartment_id: ${aptId}`);
      console.log('✅ 아파트 ID 사용:', aptId, apartmentName);
    } else if (apartmentName) {
      // ID가 없으면 이름으로 정규화
      const normalizedApt = await findBestApartmentMatch(apartmentName, region);
      
      if (normalizedApt) {
        finalApartmentName = normalizedApt.aptName;
        finalAptId = normalizedApt.aptId;
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
    } else if (!aptId && !apartmentName) {
      // 아파트 ID나 이름 둘 다 없는 경우
      return {
        success: false,
        error: '아파트 이름이나 ID가 필요합니다. 먼저 @아파트명을 멘션하거나 구체적인 아파트명을 제공해주세요.',
        dataSchema: {
          apartmentName: '아파트 이름',
          aptId: '아파트 ID (선택사항)',
          dealType: '거래 유형 (매매/전세/월세)',
          period: '검색 기간 (3개월/6개월/1년 등)',
          note: 'apartmentName 또는 aptId 중 하나는 반드시 필요'
        }
      };
    }

    const conds: string[] = [];
    if (finalApartmentName) conds.push(`아파트 "${finalApartmentName}"`);
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
      `oi.apt_deal_all 테이블을 사용해서 스키마/컬럼 자동 선택.`,
    ].join(' ');

    const { success, sql, rows, rowCount, error } = await orchestrateSelect({
      question,
      forceSchemaHints: [
        'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, floor, deal_year, deal_month, deal_day, apt_nm, ...)',
        '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
        ...searchHints
      ],
      requireColumns: ['exclu_use_ar', 'floor'],
      userProfile,
      safety: { maxRows: limit, readOnly: true },
    });

    if (!success) {
      return {
        success: false,
        error: error || '실거래 데이터 검색에 실패했습니다.',
        dataSchema: {
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)', 
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          note: '30000 = 3억원'
        }
      };
    }

    if (!rows || rows.length === 0) {
      return {
        success: true,
        message: '해당 조건의 실거래 데이터가 없습니다.',
        searchConditions: {
          apartmentName,
          region,
          dealType,
          period,
          area: area ? `${area}㎡` : undefined,
          areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined,
          priceRange: priceRange ? `${priceRange[0]}~${priceRange[1]}만원` : undefined
        },
        deals: [],
        totalCount: 0,
        sql, // 디버깅용
        dataSchema: {
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)',
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          note: '30000 = 3억원'
        }
      };
    }

    // 결과 포맷팅 (AI가 반환한 원본 데이터를 표준화)
    const formattedDeals = rows.map((deal: any, index: number) => {
      // 거래유형 자동 판단 (사용자 요청이 '전체'인 경우 필요)
      let actualDealType = dealType;
      if (dealType === '전체') {
        if (deal.deal_amount || deal.dealamount) {
          actualDealType = '매매';
        } else if (deal.monthly_rent === 0 || deal.monthlyrent === 0) {
          actualDealType = '전세';
        } else if ((deal.monthly_rent && deal.monthly_rent > 0) || (deal.monthlyrent && deal.monthlyrent > 0)) {
          actualDealType = '월세';
        }
      }
      
      return {
        id: index + 1,
        dealDate: deal.dealdate || deal.deal_date || `${deal.deal_year || deal.dealyear}.${deal.deal_month || deal.dealmonth}.${deal.deal_day || deal.dealday}`,
        dealType: actualDealType,
        dealAmount: deal.deal_amount || deal.dealamount,
        deposit: deal.deposit,
        monthlyRent: deal.monthly_rent || deal.monthlyrent,
        exclusiveArea: deal.exclu_use_ar || deal.excluusear || deal.exclusive_area,
        floor: deal.floor,
        apartmentName: deal.apt_nm || deal.aptnm || deal.apartment_name || apartmentName,
        region: deal.region || region,
        // 원본 데이터 보존
        _raw: deal
      };
    });

    return {
      success: true,
      searchConditions: {
        apartmentName,
        region,
        dealType,
        period,
        area: area ? `${area}㎡` : undefined,
        areaRange: areaRange ? `${areaRange[0]}~${areaRange[1]}㎡` : undefined,
        priceRange: priceRange ? `${priceRange[0]}~${priceRange[1]}만원` : undefined
      },
      deals: formattedDeals,
      totalCount: formattedDeals.length,
      sql, // 생성된 SQL 쿼리 (디버깅용)
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        deposit: '보증금 (만원 단위)', 
        monthlyRent: '월세 (만원 단위)',
        exclusiveArea: '전용면적 (㎡)',
        dealType: 'deal_amount 존재=매매, deal_amount 없음+deposit만=전세, deal_amount 없음+deposit+monthly_rent=월세',
        note: '30000 = 3억원, AI가 자연어로 생성한 SQL 결과 (oi.apt_deal_all 테이블)'
      }
    };

  } catch (error: any) {
    console.error('❌ searchRealEstateDeals 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '실거래 데이터 검색 중 오류가 발생했습니다.'
    };
  }
}

