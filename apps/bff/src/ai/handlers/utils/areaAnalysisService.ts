// apps/bff/src/ai/handlers/utils/areaAnalysisService.ts
import { orchestrateSelect } from './sqlOrchestrator';

export interface AreaAnalysisResult {
  success: boolean;
  apartmentName: string;
  totalTransactions: number;
  areaTypes: {
    area: number;
    areaLabel: string;
    saleCount: number;
    rentCount: number;
    monthlyRentCount: number;
    avgSalePrice?: number;
    avgRentDeposit?: number;
    avgMonthlyRent?: number;
    recentTransactions: any[];
  }[];
  insights: string[];
  dataSource: string;
}

/**
 * 🏠 면적별 분석 서비스
 * 전세/월세 데이터를 활용하여 의미있는 면적별 인사이트 제공
 */
export class AreaAnalysisService {

  /**
   * 특정 아파트의 면적별 상세 분석
   */
  static async analyzeByArea(
    apartmentName: string,
    targetArea?: number,
    userProfile?: any
  ): Promise<AreaAnalysisResult> {
    console.log(`🏠 면적별 분석 시작: ${apartmentName}, 대상면적: ${targetArea}㎡`);

    try {
      // 1단계: 모든 거래 데이터 수집 (매매 + 전세 + 월세)
      const allTransactionsQuestion = [
        `아파트 "${apartmentName}"의 모든 거래 (매매, 전세, 월세) 데이터를 면적별로 분석해줘.`,
        `반드시 전용면적(exclu_use_ar), 거래금액(deal_amount), 보증금(deposit), 월세(monthly_rent),`,
        `거래년도(deal_year), 거래월(deal_month) 컬럼을 포함해.`,
        `거래유형 구분: deal_amount 존재=매매, deal_amount 없음+monthly_rent=0=전세, deal_amount 없음+monthly_rent>0=월세`,
        `최근 2년 데이터를 우선으로 하되, 데이터가 부족하면 전체 기간 조회`,
        `면적별로 그룹핑하여 통계 제공. oi.apt_deal_all 테이블 사용.`
      ].join(' ');

      const allTransactionsResult = await orchestrateSelect({
        question: allTransactionsQuestion,
        userProfile,
        safety: { maxRows: 500 }
      });

      if (!allTransactionsResult.success || !allTransactionsResult.rows?.length) {
        console.log('❌ 모든 거래 데이터 조회 실패, 전세/월세만 조회 시도');

        // 2단계: 전세/월세만 조회 (매매 데이터가 없는 경우 대안)
        const rentOnlyQuestion = [
          `아파트 "${apartmentName}"의 전세/월세 거래 데이터를 면적별로 분석해줘.`,
          `WHERE deal_amount IS NULL 조건으로 전세/월세만 조회`,
          `전용면적(exclu_use_ar), 보증금(deposit), 월세(monthly_rent), 거래년도, 거래월 포함`,
          `면적별 평균 보증금, 월세 계산해줘. 최근 2년 우선, 없으면 전체 기간`
        ].join(' ');

        const rentResult = await orchestrateSelect({
          question: rentOnlyQuestion,
          userProfile,
          safety: { maxRows: 300 }
        });

        if (!rentResult.success || !rentResult.rows?.length) {
          return {
            success: false,
            apartmentName,
            totalTransactions: 0,
            areaTypes: [],
            insights: ['해당 아파트의 거래 데이터를 찾을 수 없습니다.'],
            dataSource: 'none'
          };
        }

        return this.processTransactionData(rentResult.rows, apartmentName, 'rent_only', targetArea);
      }

      return this.processTransactionData(allTransactionsResult.rows, apartmentName, 'all_types', targetArea);

    } catch (error) {
      console.error('❌ 면적별 분석 오류:', error);
      return {
        success: false,
        apartmentName,
        totalTransactions: 0,
        areaTypes: [],
        insights: [`분석 중 오류가 발생했습니다: ${error.message}`],
        dataSource: 'error'
      };
    }
  }

  /**
   * 거래 데이터를 면적별로 처리하고 분석
   */
  private static processTransactionData(
    rows: any[],
    apartmentName: string,
    dataSource: string,
    targetArea?: number
  ): AreaAnalysisResult {
    console.log(`📊 데이터 처리 시작: ${rows.length}건, 소스: ${dataSource}`);

    // 면적별 그룹핑
    const areaGroups = new Map<number, any[]>();

    rows.forEach(row => {
      const area = Math.round(row.exclu_use_ar || row.exclusive_area || 0);
      if (area > 0) {
        if (!areaGroups.has(area)) {
          areaGroups.set(area, []);
        }
        areaGroups.get(area)!.push(row);
      }
    });

    // 면적별 통계 계산
    const areaTypes = Array.from(areaGroups.entries())
      .map(([area, transactions]) => {
        const sales = transactions.filter(t => t.deal_amount && t.deal_amount > 0);
        const rents = transactions.filter(t => !t.deal_amount && (!t.monthly_rent || t.monthly_rent === 0));
        const monthlyRents = transactions.filter(t => !t.deal_amount && t.monthly_rent && t.monthly_rent > 0);

        const areaLabel = this.getAreaLabel(area);

        // 최근 거래 (최대 5건)
        const recentTransactions = transactions
          .sort((a, b) => {
            const aDate = (a.deal_year || 2020) * 100 + (a.deal_month || 1);
            const bDate = (b.deal_year || 2020) * 100 + (b.deal_month || 1);
            return bDate - aDate;
          })
          .slice(0, 5);

        return {
          area,
          areaLabel,
          saleCount: sales.length,
          rentCount: rents.length,
          monthlyRentCount: monthlyRents.length,
          avgSalePrice: sales.length > 0 ? Math.round(sales.reduce((sum, t) => sum + (t.deal_amount || 0), 0) / sales.length) : undefined,
          avgRentDeposit: rents.length > 0 ? Math.round(rents.reduce((sum, t) => sum + (t.deposit || 0), 0) / rents.length) : undefined,
          avgMonthlyRent: monthlyRents.length > 0 ? Math.round(monthlyRents.reduce((sum, t) => sum + (t.monthly_rent || 0), 0) / monthlyRents.length) : undefined,
          recentTransactions
        };
      })
      .sort((a, b) => b.saleCount + b.rentCount + b.monthlyRentCount - (a.saleCount + a.rentCount + a.monthlyRentCount)); // 거래량 순 정렬

    // 인사이트 생성
    const insights = this.generateInsights(areaTypes, apartmentName, targetArea, dataSource);

    return {
      success: true,
      apartmentName,
      totalTransactions: rows.length,
      areaTypes,
      insights,
      dataSource
    };
  }

  /**
   * 면적에 따른 라벨 생성
   */
  private static getAreaLabel(area: number): string {
    const pyeong = Math.round(area * 0.3025);

    if (area < 60) return `${area}㎡ (${pyeong}평) - 소형`;
    if (area < 85) return `${area}㎡ (${pyeong}평) - 중형`;
    if (area < 120) return `${area}㎡ (${pyeong}평) - 대형`;
    return `${area}㎡ (${pyeong}평) - 특대형`;
  }

  /**
   * 의미있는 인사이트 생성
   */
  private static generateInsights(
    areaTypes: any[],
    apartmentName: string,
    targetArea?: number,
    dataSource: string
  ): string[] {
    const insights: string[] = [];

    if (areaTypes.length === 0) {
      insights.push('거래 데이터가 충분하지 않습니다.');
      return insights;
    }

    // 1. 가장 인기있는 면적대
    const mostPopular = areaTypes[0];
    const totalTransactions = mostPopular.saleCount + mostPopular.rentCount + mostPopular.monthlyRentCount;
    insights.push(`가장 거래가 활발한 면적은 ${mostPopular.areaLabel}으로 총 ${totalTransactions}건의 거래가 있었습니다.`);

    // 2. 타겟 면적 분석 (지정된 경우)
    if (targetArea) {
      const targetAreaData = areaTypes.find(at => Math.abs(at.area - targetArea) <= 2);
      if (targetAreaData) {
        const targetTotal = targetAreaData.saleCount + targetAreaData.rentCount + targetAreaData.monthlyRentCount;
        insights.push(`요청하신 ${targetArea}㎡ 면적의 거래는 ${targetTotal}건이며, ${targetAreaData.areaLabel} 범주에 속합니다.`);

        if (targetAreaData.avgSalePrice) {
          insights.push(`${targetArea}㎡ 매매 평균가는 ${targetAreaData.avgSalePrice.toLocaleString()}만원입니다.`);
        }
        if (targetAreaData.avgRentDeposit) {
          insights.push(`${targetArea}㎡ 전세 평균 보증금은 ${targetAreaData.avgRentDeposit.toLocaleString()}만원입니다.`);
        }
      } else {
        insights.push(`요청하신 ${targetArea}㎡ 면적의 최근 거래 데이터는 없습니다. 유사한 면적대를 참고해보세요.`);
      }
    }

    // 3. 면적별 가격 트렌드
    const areasWithSales = areaTypes.filter(at => at.avgSalePrice);
    if (areasWithSales.length >= 2) {
      const pricePerSqm = areasWithSales.map(at => ({
        area: at.area,
        pricePerSqm: Math.round(at.avgSalePrice! / at.area)
      })).sort((a, b) => b.pricePerSqm - a.pricePerSqm);

      insights.push(`㎡당 가격이 가장 높은 면적은 ${pricePerSqm[0].area}㎡(${pricePerSqm[0].pricePerSqm.toLocaleString()}만원/㎡)입니다.`);
    }

    // 4. 전세/월세 비율 분석
    const totalRent = areaTypes.reduce((sum, at) => sum + at.rentCount, 0);
    const totalMonthlyRent = areaTypes.reduce((sum, at) => sum + at.monthlyRentCount, 0);
    const totalSale = areaTypes.reduce((sum, at) => sum + at.saleCount, 0);

    if (totalRent + totalMonthlyRent > 0) {
      const rentRatio = Math.round((totalRent / (totalRent + totalMonthlyRent)) * 100);
      insights.push(`임대 거래 중 전세는 ${rentRatio}%, 월세는 ${100 - rentRatio}%의 비율을 보입니다.`);
    }

    // 5. 데이터 소스별 추가 정보
    if (dataSource === 'rent_only') {
      insights.push('※ 매매 데이터가 부족하여 전세/월세 데이터 위주로 분석했습니다.');
    } else if (dataSource === 'all_types') {
      insights.push('※ 매매, 전세, 월세 모든 거래유형을 종합하여 분석했습니다.');
    }

    return insights;
  }

  /**
   * 면적별 비교 분석 (여러 아파트)
   */
  static async compareApartmentsByArea(
    apartmentNames: string[],
    targetArea?: number,
    userProfile?: any
  ): Promise<{
    success: boolean;
    comparisons: AreaAnalysisResult[];
    crossInsights: string[];
  }> {
    console.log(`🔄 면적별 비교 분석: ${apartmentNames.join(' vs ')}`);

    const results: AreaAnalysisResult[] = [];

    for (const apartmentName of apartmentNames) {
      const analysis = await this.analyzeByArea(apartmentName, targetArea, userProfile);
      results.push(analysis);
    }

    // 교차 인사이트 생성
    const crossInsights = this.generateCrossInsights(results, targetArea);

    return {
      success: results.some(r => r.success),
      comparisons: results,
      crossInsights
    };
  }

  /**
   * 여러 아파트 간 교차 인사이트 생성
   */
  private static generateCrossInsights(results: AreaAnalysisResult[], targetArea?: number): string[] {
    const insights: string[] = [];
    const successfulResults = results.filter(r => r.success && r.areaTypes.length > 0);

    if (successfulResults.length < 2) {
      insights.push('비교할 수 있는 충분한 데이터가 없습니다.');
      return insights;
    }

    // 가장 거래가 많은 아파트
    const transactionCounts = successfulResults.map(r => ({
      name: r.apartmentName,
      total: r.totalTransactions
    })).sort((a, b) => b.total - a.total);

    insights.push(`거래량 기준으로 ${transactionCounts[0].name}이 가장 활발하며(${transactionCounts[0].total}건), ${transactionCounts[transactionCounts.length - 1].name}이 가장 적습니다(${transactionCounts[transactionCounts.length - 1].total}건).`);

    // 타겟 면적 비교 (지정된 경우)
    if (targetArea) {
      const targetComparisons = successfulResults.map(r => {
        const targetData = r.areaTypes.find(at => Math.abs(at.area - targetArea) <= 2);
        return {
          name: r.apartmentName,
          data: targetData
        };
      }).filter(tc => tc.data);

      if (targetComparisons.length >= 2) {
        const priceComparisons = targetComparisons
          .filter(tc => tc.data.avgSalePrice)
          .sort((a, b) => b.data.avgSalePrice! - a.data.avgSalePrice!);

        if (priceComparisons.length >= 2) {
          insights.push(`${targetArea}㎡ 매매가 기준으로 ${priceComparisons[0].name}이 가장 높고(${priceComparisons[0].data.avgSalePrice!.toLocaleString()}만원), ${priceComparisons[priceComparisons.length - 1].name}이 가장 낮습니다(${priceComparisons[priceComparisons.length - 1].data.avgSalePrice!.toLocaleString()}만원).`);
        }
      }
    }

    return insights;
  }
}