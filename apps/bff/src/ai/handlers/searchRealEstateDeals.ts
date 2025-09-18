import { orchestrateSelect, parsePeriodToSqlInterval } from './utils/sqlOrchestrator';
import { findBestApartmentMatch, generateSmartQuestion, normalizeApartmentName } from './database/normalizeApartmentName';
import { SmartQueryRetryService } from './utils/smartQueryRetryService';
import { AreaAnalysisService } from './utils/areaAnalysisService';
import { DirectSqlGenerator } from './utils/directSqlGenerator';

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
  contextAptData?: any;                    // 아파트 컨텍스트 데이터
  persistentAttachedApartments?: Array<{   // 🆕 챗봇에서 첨부된 아파트들
    id: number;
    name: string;
    address: string;
    lat: number;
    lon: number;
  }>;
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
    contextAptData,
    persistentAttachedApartments,
  } = args;

  try {
    console.log('🔍 실거래가 검색 (RAG 오케스트레이션):', {
      apartmentName, aptId, region, dealType, period, area, areaRange, priceRange, limit,
      persistentAttachedApartments: persistentAttachedApartments?.length || 0
    });

    // 1️⃣ 아파트 식별: 컨텍스트 데이터 우선, ID가 있으면 우선 사용, 없으면 이름으로 정규화
    let finalApartmentName = apartmentName;
    let finalAptId = aptId;
    let searchHints: string[] = [];
    
    // 🆕 1순위: 컨텍스트에서 아파트 데이터가 있으면 우선 사용
    if (contextAptData && contextAptData.aptId) {
      finalApartmentName = contextAptData.aptName || apartmentName;
      finalAptId = contextAptData.aptId;
      searchHints.push(`apartment_id: ${finalAptId}`);
      console.log('✅ 컨텍스트 아파트 데이터 사용:', {
        aptId: finalAptId,
        aptName: finalApartmentName,
        source: 'contextAptData'
      });
    }
    // 🆕 2순위: 첨부된 아파트가 있으면서 아파트명이 없거나 애매한 경우 첫 번째 첨부 아파트 사용
    else if (persistentAttachedApartments && persistentAttachedApartments.length > 0 && (!apartmentName || apartmentName.length < 3)) {
      const firstAttached = persistentAttachedApartments[0];
      finalApartmentName = firstAttached.name;
      finalAptId = firstAttached.id;
      searchHints.push(`apartment_id: ${finalAptId}`);
      console.log('✅ 첨부된 아파트 데이터 사용:', {
        aptId: finalAptId,
        aptName: finalApartmentName,
        source: 'persistentAttachedApartments',
        totalAttached: persistentAttachedApartments.length
      });
    }
    // 🆕 3순위: 아파트명이 있고 첨부된 아파트 중 일치하는 것이 있으면 사용
    else if (persistentAttachedApartments && persistentAttachedApartments.length > 0 && apartmentName) {
      const matchedAttached = persistentAttachedApartments.find(apt =>
        apt.name.includes(apartmentName) || apartmentName.includes(apt.name)
      );
      if (matchedAttached) {
        finalApartmentName = matchedAttached.name;
        finalAptId = matchedAttached.id;
        searchHints.push(`apartment_id: ${finalAptId}`);
        console.log('✅ 일치하는 첨부 아파트 데이터 사용:', {
          aptId: finalAptId,
          aptName: finalApartmentName,
          inputName: apartmentName,
          source: 'persistentAttachedApartments_matched'
        });
      }
    }
    else if (aptId) {
      // ID가 있으면 우선 사용 (메타데이터에서 전달된 경우)
      searchHints.push(`apartment_id: ${aptId}`);
      console.log('✅ 아파트 ID 사용:', aptId, apartmentName);
    } else if (apartmentName) {
      // ID가 없으면 이름으로 정규화 (중복 호출 방지: 1번만 실행)
      const candidates = await normalizeApartmentName(apartmentName, region);
      
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1 || candidates[0].score <= 0.3) {
          // 유일한 후보이거나 첫 번째 후보의 유사도가 높은 경우
          const bestMatch = candidates[0];
          finalApartmentName = bestMatch.aptName;
          finalAptId = bestMatch.aptId;
          searchHints.push(`apartment_id: ${bestMatch.aptId}`);
          console.log('✅ 아파트명 정규화 성공:', {
            입력: apartmentName,
            정규화: finalApartmentName,
            점수: bestMatch.score.toFixed(3)
          });
        } else {
          // 여러 후보가 있고 불확실한 경우 - 친절한 안내
          const topCandidates = candidates.slice(0, 3).map(c => `${c.aptName} (${c.region})`);
          return {
            success: false,
            needsClarification: true,
            message: `"${apartmentName}"로 검색하니 비슷한 이름의 아파트가 여러 개 있네요! 😊`,
            suggestion: `혹시 이 중에서 찾으시는 곳이 있을까요?`,
            alternatives: topCandidates,
            helpText: `구나 동 이름을 함께 말씀해주시면 더 정확하게 찾아드릴 수 있어요. 예: "${apartmentName} 강남구" 또는 "${apartmentName} 서초동"`,
            candidates: candidates.map(c => ({ aptId: c.aptId, aptName: c.aptName, region: c.region, score: c.score }))
          };
        }
      } else {
        console.log('⚠️ 아파트명 정규화 실패, 원본 이름 사용:', apartmentName);
      }
    }
    // 🏠 면적만 주어지고 아파트명이 없지만 컨텍스트 데이터가 있는 경우
    else if (!aptId && !apartmentName && contextAptData && area) {
      finalApartmentName = contextAptData.aptName;
      finalAptId = contextAptData.aptId;
      console.log('✅ 면적 기반 컨텍스트 아파트 사용:', {
        aptId: finalAptId,
        aptName: finalApartmentName,
        targetArea: area,
        source: 'contextAptData_with_area'
      });
    }
    else if (!aptId && !apartmentName && !contextAptData) {
      // 아파트 ID나 이름, 컨텍스트 데이터가 모두 없는 경우 - 사용자 정보 기반 추천
      const userRecommendations = [];

      // 사용자 온보딩 정보에서 지역 추천
      if (userProfile?.workLocation) {
        userRecommendations.push(`직장 위치(${userProfile.workLocation}) 근처`);
      }

      // 사용자 선호도에서 추천
      if (userProfile?.commutingRadius) {
        userRecommendations.push(`통근권 ${userProfile.commutingRadius}분 이내`);
      }

      const recommendationText = userRecommendations.length > 0
        ? ` 혹시 ${userRecommendations.join(', ')} 지역의 아파트 정보를 찾아보시는 건가요?`
        : '';

      return {
        success: false,
        needsApartmentInfo: true,
        message: `어떤 아파트의 정보를 찾아드릴까요? 😊${recommendationText}`,
        helpText: `아파트 이름이나 지역을 알려주시면 바로 찾아드릴게요!`,
        examples: [
          `"@잠실래미안" 처럼 @를 붙여서 아파트명 멘션하기`,
          `"강남구 아파트 매매가" 처럼 지역명으로 검색하기`,
          `"역삼역 근처 전세" 처럼 역이나 랜드마크로 검색하기`
        ],
        userContext: userProfile ? {
          workLocation: userProfile.workLocation,
          commutingRadius: userProfile.commutingRadius,
          priorities: userProfile.priorities
        } : undefined,
        dataSchema: {
          apartmentName: '아파트 이름',
          region: '지역명 (구, 동, 역 등)',
          dealType: '거래 유형 (매매/전세/월세)',
          period: '검색 기간 (3개월/6개월/1년 등)',
          note: '다양한 방법으로 검색 가능해요!'
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
      dealType === '매매' ? `매매 거래만 조회: WHERE deal_amount IS NOT NULL 조건 필수.` : '',
      dealType === '전세' ? `전세 거래만 조회: WHERE deal_amount IS NULL AND monthly_rent = 0 조건 필수.` : '',
      dealType === '월세' ? `월세 거래만 조회: WHERE deal_amount IS NULL AND monthly_rent > 0 조건 필수.` : '',
      area ? `전용면적 ${area}㎡의 경우 ±1㎡ 허용 범위 적용: exclu_use_ar BETWEEN ${area-1} AND ${area+1}.` : '',
      `oi.apt_deal_all 테이블을 사용해서 스키마/컬럼 자동 선택.`,
    ].filter(Boolean).join(' ');

    // 🔧 DirectSqlGenerator 우선 시도 (RAG 우회)
    console.log('🔧 DirectSqlGenerator로 직접 SQL 생성 시도');

    const directResult = await DirectSqlGenerator.searchRealEstateDeals({
      apartmentName: finalApartmentName,
      aptId: finalAptId,
      dealType,
      area,
      areaRange,
      period,
      limit,
      region
    });

    let success = directResult.success;
    let sql = directResult.sql;
    let rows = directResult.data;
    let rowCount = directResult.rowCount;
    let error = directResult.error;

    console.log('🔧 DirectSql 결과:', {
      success,
      rowCount,
      hasRows: rows?.length > 0,
      explanation: directResult.explanation
    });

    // 🔍 DirectSql 상세 로그
    if (directResult.success && directResult.data && directResult.data.length > 0) {
      console.log('🔍 DirectSql 실제 데이터 수신:', {
        dataCount: directResult.data.length,
        firstData: directResult.data[0],
        directResultType: typeof directResult.data,
        isArray: Array.isArray(directResult.data)
      });
    } else {
      console.log('❌ DirectSql 데이터 없음:', {
        success: directResult.success,
        dataExists: !!directResult.data,
        dataLength: directResult.data?.length,
        error: directResult.error
      });
    }

    // DirectSql이 실패한 경우에만 RAG 폴백
    if (!success || !rows || rows.length === 0) {
      console.log('⚠️ DirectSql 실패, RAG 폴백 시도');

      const ragResult = await orchestrateSelect({
        question,
        forceSchemaHints: [
          'oi.apt_deal_all(deal_amount, deposit, monthly_rent, exclu_use_ar, floor, deal_year, deal_month, deal_day, apt_nm, jibun_address)',
          '거래유형: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          '지역 필터링: jibun_address 컬럼 사용 (umdnm 컬럼 없음)',
          '날짜 정렬: ORDER BY deal_year DESC, deal_month DESC, deal_day DESC (MAKE_DATE 함수 사용 금지)',
          '아파트명 검색: WHERE apt_nm ILIKE \'%아파트명%\' (정확한 이름으로 검색)',
          '날짜 조건: WHERE deal_year >= EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL \'3 months\') (MAKE_DATE 함수 대신)',
          '단순한 SQL 생성: 복잡한 함수나 논리적 모순 조건 피하기',
          '금지된 테이블: oi.apt_deal_trade_raw, oi.apt_deal_rent_raw 사용 금지',
          ...searchHints
        ],
        requireColumns: ['exclu_use_ar', 'floor'],
        safety: { maxRows: limit, readOnly: true },
      });

      success = ragResult.success;
      sql = ragResult.sql;
      rows = ragResult.rows;
      rowCount = ragResult.rowCount;
      error = ragResult.error;
    }

    console.log('🔧 SQL 실행 후 결과 확인:', {
      success,
      rowCount,
      rowsLength: rows?.length || 0,
      firstRowSample: rows?.[0] ? {
        deal_amount: rows[0].deal_amount,
        dealamount: rows[0].dealamount,
        deposit: rows[0].deposit,
        monthly_rent: rows[0].monthly_rent
      } : null
    });

    if (!success || !rows || rows.length === 0) {
      // 🧠 SmartQueryRetryService로 지능형 재시도
      console.log('⚠️ 초기 쿼리 결과 부족, SmartQueryRetryService 시작');

      const retryResult = await SmartQueryRetryService.searchWithRetry(
        question,
        finalApartmentName || apartmentName || '아파트',
        region,
        dealType,
        area,
        period,
        userProfile,
        contextAptData  // 🆕 컨텍스트 아파트 데이터 전달
      );

      if (retryResult.success && retryResult.data.length > 0) {
        console.log(`✅ 재시도 성공: ${retryResult.attemptNumber}번째 시도로 ${retryResult.data.length}건 발견`);

        const quality = SmartQueryRetryService.evaluateDataQuality(retryResult.data, retryResult.conditionUsed);

        return {
          success: true,
          message: retryResult.message,
          isSmartRetry: true,
          conditionUsed: retryResult.conditionUsed,
          attemptNumber: retryResult.attemptNumber,
          dataQuality: quality,
          searchConditions: { apartmentName, region, dealType, period },
          deals: retryResult.data.map((deal: any, index: number) => ({
            id: index + 1,
            dealDate: deal.dealdate || deal.deal_date || `${deal.deal_year || deal.dealyear}.${deal.deal_month || deal.dealmonth}.${deal.deal_day || deal.dealday}`,
            dealType: dealType === '전체' ? (deal.deal_amount ? '매매' : deal.monthly_rent > 0 ? '월세' : '전세') : dealType,
            dealAmount: deal.deal_amount || deal.dealamount,
            deposit: deal.deposit,
            monthlyRent: deal.monthly_rent || deal.monthlyrent,
            exclusiveArea: deal.exclu_use_ar || deal.excluusear || deal.exclusive_area,
            floor: deal.floor,
            apartmentName: deal.apt_nm || deal.aptnm || deal.apartment_name || apartmentName,
            _raw: deal
          })),
          totalCount: retryResult.data.length,
          sql: retryResult.sql,
          dataSchema: {
            dealAmount: '매매가 (만원 단위)',
            deposit: '보증금 (만원 단위)',
            monthlyRent: '월세 (만원 단위)',
            exclusiveArea: '전용면적 (㎡)',
            dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
            note: '30000 = 3억원, SmartQueryRetryService 적용됨'
          }
        };
      }

      return {
        success: false,
        error: retryResult.message,
        suggestion: `모든 조건을 시도했지만 데이터가 없습니다. 다른 아파트나 지역으로 검색해보시겠어요?`,
        retryAttempts: retryResult.attemptNumber,
        dataSchema: {
          dealAmount: '매매가 (만원 단위)',
          deposit: '보증금 (만원 단위)',
          monthlyRent: '월세 (만원 단위)',
          exclusiveArea: '전용면적 (㎡)',
          dealType: 'deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세',
          note: '30000 = 3억원, SmartQueryRetryService로 5단계 시도 완료'
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

    // 🧠 면적별 분석 추가 (사용자가 면적별 관심을 보인 경우 또는 충분한 데이터가 있는 경우)
    let areaAnalysis = null;
    const shouldAnalyzeByArea = (
      question.includes('면적별') ||
      question.includes('시세비교') ||
      question.includes('면적') ||
      formattedDeals.length >= 10
    );

    if (shouldAnalyzeByArea && finalApartmentName) {
      console.log(`🏠 면적별 분석 실행: ${finalApartmentName}`);
      try {
        areaAnalysis = await AreaAnalysisService.analyzeByArea(finalApartmentName, area, userProfile);
        console.log(`✅ 면적별 분석 완료: ${areaAnalysis.areaTypes.length}개 면적타입 발견`);
      } catch (error) {
        console.log(`⚠️ 면적별 분석 실패:`, error);
      }
    }

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
      areaAnalysis, // 🆕 면적별 분석 결과 추가
      sql, // 생성된 SQL 쿼리 (디버깅용)
      dataSchema: {
        dealAmount: '매매가 (만원 단위)',
        deposit: '보증금 (만원 단위)',
        monthlyRent: '월세 (만원 단위)',
        exclusiveArea: '전용면적 (㎡)',
        dealType: 'deal_amount 존재=매매, deal_amount 없음+deposit만=전세, deal_amount 없음+deposit+monthly_rent=월세',
        note: '30000 = 3억원, AI가 자연어로 생성한 SQL 결과 (oi.apt_deal_all 테이블)',
        areaAnalysis: areaAnalysis ? '면적별 상세 분석 데이터 포함' : undefined
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

