// apps/bff/src/ai/planner/bridge.ts
// 플래너와 기존 AI 함수들을 연결하는 브리지

import { ActionHandler, ActionResult } from './executor';
import { PlanAction, PlanContext } from './types';

// 기존 핸들러들 import
import { searchRealEstateDeals } from '../handlers/searchRealEstateDeals';
import { searchNearbyPOI } from '../handlers/searchNearbyPOI';
import { getBuildingInfo } from '../handlers/getBuildingInfo';
import { getPriceTrends } from '../handlers/getPriceTrends';
import { getDealStatsSummary } from '../handlers/getDealStatsSummary';

/**
 * 기존 함수들과 연결하는 브리지 핸들러들
 */

/**
 * 부동산 검색 브리지
 */
export class RealEstateSearchBridge implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots, userProfile } = context;
    const { includeHistory, maxResults, includeComparables, includeMarketData } = action.parameters || {};

    try {
      // 기존 searchRealEstateDeals 함수 호출
      const params = {
        apartmentName: slots.apartmentName,
        region: slots.region,
        dealType: slots.dealType || '매매',
        period: slots.period,
        area: slots.area,
        areaRange: slots.areaRange,
        priceRange: slots.priceRange,
        limit: maxResults || 50,
        userProfile
      };

      console.log('🏠 기존 함수 호출: searchRealEstateDeals', params);
      const result = await searchRealEstateDeals(params);

      return {
        ...result,
        source: 'existing_function',
        functionName: 'searchRealEstateDeals'
      };

    } catch (error: any) {
      console.error('❌ 부동산 검색 브리지 오류:', error);
      return {
        success: false,
        error: error.message,
        deals: [],
        totalCount: 0
      };
    }
  }
}

/**
 * POI 검색 브리지
 */
export class POISearchBridge implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots } = context;
    const { radius, categories } = action.parameters || {};

    try {
      // searchNearbyPOI 함수가 있다고 가정하고 호출
      // 실제 함수가 없으면 스켈레톤으로 처리
      if (typeof searchNearbyPOI === 'function') {
        const params = {
          apartmentName: slots.apartmentName,
          region: slots.region,
          radius: radius || 1000,
          categories: categories || ['subway', 'bus', 'school', 'hospital', 'mart']
        };

        console.log('📍 기존 함수 호출: searchNearbyPOI', params);
        const result = await searchNearbyPOI(params);

        return {
          ...result,
          source: 'existing_function',
          functionName: 'searchNearbyPOI'
        };
      } else {
        // 함수가 없으면 스켈레톤 반환
        return {
          success: true,
          pois: [],
          message: 'POI 검색 기능이 아직 구현되지 않았습니다.',
          source: 'skeleton'
        };
      }

    } catch (error: any) {
      console.error('❌ POI 검색 브리지 오류:', error);
      return {
        success: false,
        error: error.message,
        pois: []
      };
    }
  }
}

/**
 * 건물 정보 브리지
 */
export class BuildingInfoBridge implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots } = context;

    try {
      if (typeof getBuildingInfo === 'function') {
        const params = {
          apartmentName: slots.apartmentName,
          region: slots.region
        };

        console.log('🏢 기존 함수 호출: getBuildingInfo', params);
        const result = await getBuildingInfo(params);

        return {
          ...result,
          source: 'existing_function',
          functionName: 'getBuildingInfo'
        };
      } else {
        return {
          success: true,
          buildingInfo: {},
          message: '건물 정보 조회 기능이 아직 구현되지 않았습니다.',
          source: 'skeleton'
        };
      }

    } catch (error: any) {
      console.error('❌ 건물 정보 브리지 오류:', error);
      return {
        success: false,
        error: error.message,
        buildingInfo: {}
      };
    }
  }
}

/**
 * 가격 트렌드 브리지
 */
export class PriceTrendsBridge implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots, userProfile } = context;
    const { extendedPeriod } = action.parameters || {};

    try {
      if (typeof getPriceTrends === 'function') {
        const params = {
          apartmentName: slots.apartmentName,
          region: slots.region,
          dealType: slots.dealType || '매매',
          period: extendedPeriod ? '2년' : (slots.period || '1년'),
          area: slots.area,
          userProfile
        };

        console.log('📈 기존 함수 호출: getPriceTrends', params);
        const result = await getPriceTrends(params);

        return {
          ...result,
          source: 'existing_function',
          functionName: 'getPriceTrends'
        };
      } else {
        return {
          success: true,
          trends: [],
          message: '가격 트렌드 분석 기능이 아직 구현되지 않았습니다.',
          source: 'skeleton'
        };
      }

    } catch (error: any) {
      console.error('❌ 가격 트렌드 브리지 오류:', error);
      return {
        success: false,
        error: error.message,
        trends: []
      };
    }
  }
}

/**
 * 통계 요약 브리지
 */
export class StatsCalculationBridge implements ActionHandler {
  async execute(action: PlanAction, context: PlanContext, previousResults: ActionResult[]): Promise<any> {
    const { slots, userProfile } = context;
    const { metrics } = action.parameters || {};

    try {
      if (typeof getDealStatsSummary === 'function') {
        const params = {
          apartmentName: slots.apartmentName,
          region: slots.region,
          dealType: slots.dealType || '매매',
          period: slots.period || '1년',
          area: slots.area,
          userProfile
        };

        console.log('📊 기존 함수 호출: getDealStatsSummary', params);
        const result = await getDealStatsSummary(params);

        return {
          ...result,
          source: 'existing_function',
          functionName: 'getDealStatsSummary',
          requestedMetrics: metrics
        };
      } else {
        // 이전 결과에서 데이터를 가져와서 간단한 통계 계산
        const searchResult = previousResults.find(r => 
          r.success && r.data?.deals && Array.isArray(r.data.deals)
        );

        if (searchResult?.data?.deals) {
          const deals = searchResult.data.deals;
          const statistics = this.calculateBasicStats(deals, metrics);

          return {
            success: true,
            statistics,
            source: 'calculated',
            dealCount: deals.length
          };
        } else {
          return {
            success: false,
            error: '통계 계산을 위한 데이터가 없습니다.',
            statistics: {}
          };
        }
      }

    } catch (error: any) {
      console.error('❌ 통계 계산 브리지 오류:', error);
      return {
        success: false,
        error: error.message,
        statistics: {}
      };
    }
  }

  private calculateBasicStats(deals: any[], requestedMetrics?: string[]): any {
    if (!deals || deals.length === 0) {
      return {
        count: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0
      };
    }

    // 가격 데이터 추출 (dealAmount 또는 deposit 기준)
    const prices = deals
      .map(deal => deal.dealAmount || deal.deposit || 0)
      .filter(price => price > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) {
      return {
        count: deals.length,
        message: '가격 정보가 없습니다.'
      };
    }

    const stats = {
      count: deals.length,
      priceCount: prices.length,
      average: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
      median: prices.length % 2 === 0 
        ? Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
        : prices[Math.floor(prices.length / 2)],
      min: prices[0],
      max: prices[prices.length - 1],
      trend: this.calculateTrend(deals)
    };

    // 요청된 메트릭만 반환
    if (requestedMetrics && requestedMetrics.length > 0) {
      const filtered: any = {};
      for (const metric of requestedMetrics) {
        if (metric in stats) {
          filtered[metric] = (stats as any)[metric];
        }
      }
      return filtered;
    }

    return stats;
  }

  private calculateTrend(deals: any[]): string {
    // 간단한 트렌드 계산 (시간순으로 정렬된 데이터 필요)
    if (deals.length < 2) return 'insufficient_data';

    const recentDeals = deals
      .filter(deal => deal.dealDate || deal.deal_year)
      .sort((a, b) => {
        const dateA = this.getDealDate(a);
        const dateB = this.getDealDate(b);
        return dateA.getTime() - dateB.getTime();
      });

    if (recentDeals.length < 2) return 'insufficient_data';

    const firstHalf = recentDeals.slice(0, Math.floor(recentDeals.length / 2));
    const secondHalf = recentDeals.slice(Math.floor(recentDeals.length / 2));

    const firstAvg = firstHalf.reduce((sum, deal) => 
      sum + (deal.dealAmount || deal.deposit || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, deal) => 
      sum + (deal.dealAmount || deal.deposit || 0), 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 5) return 'rising';
    if (changePercent < -5) return 'falling';
    return 'stable';
  }

  private getDealDate(deal: any): Date {
    if (deal.dealDate) {
      return new Date(deal.dealDate);
    }
    if (deal.deal_year && deal.deal_month && deal.deal_day) {
      return new Date(deal.deal_year, deal.deal_month - 1, deal.deal_day);
    }
    return new Date(); // 기본값
  }
}

/**
 * 브리지 핸들러 매핑
 */
export const bridgeHandlers = {
  'searchRealEstate': new RealEstateSearchBridge(),
  'searchPOI': new POISearchBridge(),
  'getBuildingInfo': new BuildingInfoBridge(),
  'calculateStats': new StatsCalculationBridge(),
  'getPriceTrends': new PriceTrendsBridge()
};

/**
 * 액션 실행기에 브리지 핸들러들을 등록하는 함수
 */
export function registerBridgeHandlers(executor: any) {
  for (const [actionType, handler] of Object.entries(bridgeHandlers)) {
    executor.registerHandler(actionType as any, handler);
  }
  
  console.log('🌉 브리지 핸들러 등록 완료:', Object.keys(bridgeHandlers));
}