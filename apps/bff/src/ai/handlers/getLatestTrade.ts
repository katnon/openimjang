import { orchestrateSelect } from './utils/sqlOrchestrator';
import { findBestApartmentMatch, generateSmartQuestion, normalizeApartmentName } from './database/normalizeApartmentName';

interface GetLatestTradeParams {
  apartmentName: string;   // "마곡엠밸리7단지", "신당 현대", "현대아파트" 등
  region?: string;         // 선택적 지역 힌트 (예: "중구", "신당동")
  dealType?: '매매' | '전세' | '월세' | '전체';
  limit?: number;          // 기본 20
  userProfile?: any;       // 사용자 프로필 (개인화)
}

/**
 * 특정 아파트의 최근 거래 내역을 조회합니다.
 */
export async function getLatestTrade(args: GetLatestTradeParams): Promise<any> {
  const { apartmentName, region, dealType = '매매', limit = 20, userProfile } = args;

  try {
    console.log('🔍 최근 거래 내역 조회 (RAG 오케스트레이션):', { apartmentName, region, dealType, limit });

    // 1️⃣ 아파트명 정규화 시도
    const normalizedApt = await findBestApartmentMatch(apartmentName, region);
    
    let finalApartmentName = apartmentName;
    let searchHints: string[] = [];
    
    if (normalizedApt) {
      finalApartmentName = normalizedApt.aptName;
      searchHints.push(`apartment_id: ${normalizedApt.aptId}`);
      console.log('✅ 아파트명 정규화 성공:', {
        입력: apartmentName,
        정규화: finalApartmentName,
        점수: normalizedApt.score.toFixed(3)
      });
    } else {
      // 정규화 실패시 여러 후보 확인
      const candidates = await normalizeApartmentName(apartmentName, region);
      if (candidates && candidates.length > 1) {
        return {
          success: false,
          error: '여러 아파트가 검색되었습니다.',
          suggestions: generateSmartQuestion(candidates, apartmentName),
          candidates: candidates.map(c => ({
            aptId: c.aptId,
            aptName: c.aptName,
            region: c.region
          }))
        };
      }
      console.log('⚠️ 아파트명 정규화 실패, 원본 이름 사용:', apartmentName);
    }

    const question = [
      `아파트 "${finalApartmentName}"의 최신 ${limit}건 ${dealType} 거래를 시간 역순으로 조회해줘.`,
      `반드시 날짜, 거래금액(deal_amount), 보증금(deposit), 월세(monthly_rent), 전용면적(exclu_use_ar), 층(floor) 정보를 포함해.`,
      `거래유형 구분: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세.`,
      `oi.apt_deal_all 테이블을 사용해서 결과는 ${limit}건 이하여야 해.`,
    ].join(' ');

    const { success, sql, rows, rowCount, error } = await orchestrateSelect({
      question,
      forceSchemaHints: [
        'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, floor, deal_year, deal_month, deal_day, apt_nm, ...)',
        '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
        ...searchHints // 정규화된 apt_id 힌트 추가
      ],
      requireColumns: ['exclu_use_ar', 'floor'],
      userProfile,
      safety: { maxRows: limit, readOnly: true },
    });

    if (!success) {
      return {
        success: false,
        error: error || '최근 거래 내역 조회에 실패했습니다.',
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
        message: '해당 조건의 최근 거래 데이터가 없습니다.',
        searchConditions: {
          apartmentName,
          dealType,
          limit
        },
        deals: [],
        totalCount: 0,
        sql, // 디버깅을 위해 생성된 SQL 포함
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
        // 원본 데이터 보존
        _raw: deal
      };
    });

    return {
      success: true,
      searchConditions: {
        apartmentName,
        dealType,
        limit
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
    console.error('❌ getLatestTrade 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '최근 거래 내역 조회 중 오류가 발생했습니다.'
    };
  }
}

