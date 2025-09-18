// apps/bff/src/ai/handlers/utils/smartQueryRetryService.ts
import { orchestrateSelect } from './sqlOrchestrator';
import { DirectSqlGenerator } from './directSqlGenerator';

type RetryCondition = {
  dealType: string;       // '매매' | '전세' | '월세' | '전체'
  specificApt: boolean;   // 특정 아파트명 vs 지역 전체
  exactArea: boolean;     // 정확한 면적 vs 범위
  strictPeriod: boolean;  // 엄격한 기간 vs 확장된 기간
};

type RetryResult = {
  success: boolean;
  data: any;
  conditionUsed: RetryCondition;
  attemptNumber: number;
  sql?: string;
  message: string;
};

/**
 * 🧠 지능형 쿼리 재시도 서비스
 * 조건을 점진적으로 완화하면서 의미있는 데이터를 찾을 때까지 시도
 */
export class SmartQueryRetryService {
  private static retryConditions: RetryCondition[] = [
    // 1차: 원래 조건 (가장 구체적)
    { dealType: '매매', specificApt: true, exactArea: true, strictPeriod: true },

    // 2차: 거래유형 확장 (매매 → 전체)
    { dealType: '전체', specificApt: true, exactArea: true, strictPeriod: true },

    // 3차: 면적 범위 확장
    { dealType: '전체', specificApt: true, exactArea: false, strictPeriod: true },

    // 4차: 기간 확장 (1년 → 3년)
    { dealType: '전체', specificApt: true, exactArea: false, strictPeriod: false },

    // 5차: 지역 전체로 확장 (마지막 수단)
    { dealType: '전체', specificApt: false, exactArea: false, strictPeriod: false },
  ];

  /**
   * 똑똑한 재시도로 데이터 검색
   */
  static async searchWithRetry(
    originalQuestion: string,
    apartmentName: string,
    region?: string,
    dealType?: string,
    area?: number,
    period?: string,
    userProfile?: any,
    contextAptData?: any  // 🆕 컨텍스트 아파트 데이터 추가
  ): Promise<RetryResult> {

    for (let i = 0; i < this.retryConditions.length; i++) {
      const condition = this.retryConditions[i];

      try {
        console.log(`🔄 시도 ${i + 1}/${this.retryConditions.length}: ${this.conditionToString(condition)}`);

        const adaptedQuestion = this.adaptQuestion(
          originalQuestion,
          apartmentName,
          region,
          dealType,
          area,
          period,
          condition,
          contextAptData  // 🆕 컨텍스트 데이터 전달
        );

        // 🔧 DirectSqlGenerator 우선 시도 (RAG 우회)
        const finalApartmentName = apartmentName || contextAptData?.aptName || contextAptData?.name;
        const finalAptId = contextAptData?.aptId || contextAptData?.id;

        console.log(`🔧 재시도 ${i + 1}: DirectSql 사용`, {
          apartmentName: finalApartmentName,
          aptId: finalAptId,
          dealType: condition.dealType,
          condition
        });

        const directResult = await DirectSqlGenerator.searchRealEstateDeals({
          apartmentName: finalApartmentName,
          aptId: finalAptId,
          dealType: condition.dealType as any,
          area: condition.exactArea ? area : undefined,
          areaRange: !condition.exactArea && area ? [area - 5, area + 5] : undefined,
          period: condition.strictPeriod ? period : this.extendPeriod(period || '1년'),
          limit: 100,
          region: region
        });

        const result = {
          success: directResult.success,
          rows: directResult.data,
          sql: directResult.sql
        };

        // DirectSql 실패시에만 RAG 폴백
        if (!result.success || !result.rows || result.rows.length === 0) {
          console.log(`⚠️ 재시도 ${i + 1}: DirectSql 실패, RAG 폴백`);
          const ragResult = await orchestrateSelect({
            question: adaptedQuestion,
            userProfile,
            safety: { maxRows: 100 }
          });
          result.success = ragResult.success;
          result.rows = ragResult.rows;
          result.sql = ragResult.sql;
        }

        if (result.success && result.rows && result.rows.length > 0) {
          console.log(`✅ 시도 ${i + 1} 성공: ${result.rows.length}건 발견`);

          return {
            success: true,
            data: result.rows,
            conditionUsed: condition,
            attemptNumber: i + 1,
            sql: result.sql,
            message: `${this.conditionToString(condition)} 조건으로 ${result.rows.length}건 발견`
          };
        }

        console.log(`❌ 시도 ${i + 1} 실패: 데이터 없음`);

      } catch (error) {
        console.log(`❌ 시도 ${i + 1} 오류:`, error);
        continue;
      }
    }

    return {
      success: false,
      data: [],
      conditionUsed: this.retryConditions[0],
      attemptNumber: this.retryConditions.length,
      message: '모든 조건을 시도했지만 데이터를 찾을 수 없습니다'
    };
  }

  /**
   * 조건에 따라 질문을 적응적으로 변경
   */
  private static adaptQuestion(
    originalQuestion: string,
    apartmentName: string,
    region?: string,
    dealType?: string,
    area?: number,
    period?: string,
    condition: RetryCondition,
    contextAptData?: any  // 🆕 컨텍스트 아파트 데이터
  ): string {
    let adaptedQuestion = '';

    // 1. 아파트명 처리 (컨텍스트 데이터 우선 활용)
    if (condition.specificApt) {
      const finalApartmentName = apartmentName || contextAptData?.aptName || contextAptData?.name;
      if (finalApartmentName) {
        adaptedQuestion += `아파트 "${finalApartmentName}"`;
      } else {
        // 아파트명이 없으면 지역으로 대체
        const targetRegion = region || contextAptData?.region || '서울';
        adaptedQuestion += `"${targetRegion}" 지역의 아파트들`;
      }
    } else {
      // 지역 전체로 확장
      const targetRegion = region ||
                          this.extractRegionFromApartmentName(apartmentName || contextAptData?.aptName || '') ||
                          contextAptData?.region ||
                          '서울';
      adaptedQuestion += `"${targetRegion}" 지역의 아파트들`;
    }

    // 2. 거래유형 처리
    if (condition.dealType === '전체') {
      adaptedQuestion += '의 모든 거래 (매매, 전세, 월세)';
    } else {
      adaptedQuestion += `의 ${condition.dealType} 거래`;
    }

    // 3. 면적 처리
    if (area && condition.exactArea) {
      adaptedQuestion += ` ${area}㎡ (±1㎡ 허용)`;
    } else if (area && !condition.exactArea) {
      // 면적 범위 확장 (±5㎡)
      adaptedQuestion += ` ${area}㎡ 유사 면적 (±5㎡ 허용)`;
    }

    // 4. 기간 처리
    if (period) {
      if (condition.strictPeriod) {
        adaptedQuestion += ` 최근 ${period}`;
      } else {
        // 기간 확장
        const extendedPeriod = this.extendPeriod(period);
        adaptedQuestion += ` 최근 ${extendedPeriod}`;
      }
    } else {
      adaptedQuestion += ' 최근 1년';
    }

    adaptedQuestion += ' 데이터를 최신순으로 조회해줘. 반드시 날짜, 거래금액(deal_amount), 보증금(deposit), 월세(monthly_rent), 전용면적(exclu_use_ar), 층(floor) 컬럼을 포함해.';

    // 5. 거래유형 구분 로직
    if (condition.dealType === '전체') {
      adaptedQuestion += ' 거래유형 구분: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세.';
    } else if (condition.dealType === '매매') {
      adaptedQuestion += ' 매매 거래만: WHERE deal_amount IS NOT NULL 조건 필수.';
    } else if (condition.dealType === '전세') {
      adaptedQuestion += ' 전세 거래만: WHERE deal_amount IS NULL AND monthly_rent = 0 조건 필수.';
    } else if (condition.dealType === '월세') {
      adaptedQuestion += ' 월세 거래만: WHERE deal_amount IS NULL AND monthly_rent > 0 조건 필수.';
    }

    adaptedQuestion += ' oi.apt_deal_all 테이블을 사용해서 스키마/컬럼 자동 선택.';

    return adaptedQuestion;
  }

  /**
   * 아파트명에서 지역명 추출
   */
  private static extractRegionFromApartmentName(apartmentName: string): string {
    // 청구e편한세상 → 청구
    const commonPrefixes = ['청구', '잠실', '강남', '역삼', '신당', '마포', '송파', '강동'];

    for (const prefix of commonPrefixes) {
      if (apartmentName.includes(prefix)) {
        return prefix;
      }
    }

    // 기본값으로 아파트명의 첫 2글자
    return apartmentName.slice(0, 2);
  }

  /**
   * 기간 확장 (1년 → 3년)
   */
  private static extendPeriod(period: string): string {
    if (period.includes('1년') || period.includes('12개월')) {
      return '3년';
    }
    if (period.includes('6개월')) {
      return '1년';
    }
    if (period.includes('3개월')) {
      return '6개월';
    }
    return '3년'; // 기본값
  }

  /**
   * 조건을 사람이 읽기 쉬운 문자열로 변환
   */
  private static conditionToString(condition: RetryCondition): string {
    const parts: string[] = [];

    if (condition.specificApt) {
      parts.push('특정아파트');
    } else {
      parts.push('지역전체');
    }

    parts.push(condition.dealType);

    if (condition.exactArea) {
      parts.push('정확면적');
    } else {
      parts.push('유사면적');
    }

    if (condition.strictPeriod) {
      parts.push('원래기간');
    } else {
      parts.push('확장기간');
    }

    return parts.join('+');
  }

  /**
   * 결과 데이터 품질 평가
   */
  static evaluateDataQuality(data: any[], condition: RetryCondition): {
    score: number;
    insights: string[];
  } {
    if (!data || data.length === 0) {
      return { score: 0, insights: ['데이터 없음'] };
    }

    const insights: string[] = [];
    let score = 0;

    // 데이터 건수 평가
    if (data.length >= 10) {
      score += 40;
      insights.push(`충분한 데이터 (${data.length}건)`);
    } else if (data.length >= 3) {
      score += 20;
      insights.push(`제한적 데이터 (${data.length}건)`);
    } else {
      score += 10;
      insights.push(`부족한 데이터 (${data.length}건)`);
    }

    // 거래유형 다양성 평가
    const dealTypes = new Set(data.map(row => {
      if (row.deal_amount && row.deal_amount > 0) return '매매';
      if (row.monthly_rent && row.monthly_rent > 0) return '월세';
      return '전세';
    }));

    if (dealTypes.size >= 2) {
      score += 30;
      insights.push(`다양한 거래유형 (${Array.from(dealTypes).join(', ')})`);
    } else {
      score += 10;
      insights.push(`단일 거래유형 (${Array.from(dealTypes)[0]})`);
    }

    // 최신성 평가
    const latestYear = Math.max(...data.map(row => row.deal_year || 2020));
    if (latestYear >= 2024) {
      score += 30;
      insights.push('최신 데이터 포함');
    } else if (latestYear >= 2023) {
      score += 20;
      insights.push('비교적 최신 데이터');
    } else {
      score += 5;
      insights.push('오래된 데이터');
    }

    return { score, insights };
  }
}