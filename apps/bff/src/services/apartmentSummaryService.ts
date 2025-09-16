// apps/bff/src/services/apartmentSummaryService.ts
import OpenAI from 'openai';
import { db } from '../lib/db';
import { sql } from 'kysely';

interface ApartmentData {
  aptInfo: {
    name: string;
    address: string;
    lat: number;
    lon: number;
  };
  deals: any[];      // 실거래가 데이터
  pnu: any;          // PNU 정보
  building: any;     // 건물 상세 정보
  landuse: any;      // 토지이용계획
  nearby: any;       // 주변 환경 정보
}

interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
  dataQuality?: {
    deals: boolean;
    building: boolean;
    landuse: boolean;
    nearby: boolean;
    pnu: boolean;
  };
}

export class ApartmentSummaryService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private analyzeDataQuality(data: ApartmentData) {
    return {
      deals: Array.isArray(data.deals) && data.deals.length > 0,
      building: data.building && (data.building.total_count > 0 || data.building.hhldcnt),
      landuse: data.landuse && Array.isArray(data.landuse.landuse_zones) && data.landuse.landuse_zones.length > 0,
      nearby: data.nearby && Array.isArray(data.nearby.pois) && data.nearby.pois.length > 0,
      pnu: data.pnu && data.pnu.pnu,
    };
  }

  private analyzeRealEstateDeals(deals: any[]) {
    if (!Array.isArray(deals) || deals.length === 0) {
      return {
        매매: { count: 0, transactions: [], avgPrice: 0, minPrice: 0, maxPrice: 0, recentTrend: "데이터 부족" },
        전세: { count: 0, transactions: [], avgDeposit: 0, minDeposit: 0, maxDeposit: 0, recentTrend: "데이터 부족" },
        월세: { count: 0, transactions: [], avgDeposit: 0, avgRent: 0, recentTrend: "데이터 부족" },
        월별추이: {}
      };
    }

    // 거래 유형별 분류 (실거래가 표시 로직과 동일)
    const 매매거래 = deals.filter(d => d.deal_amount !== null);
    const 전세거래 = deals.filter(d => d.deposit !== null && d.monthly_rent === 0);
    const 월세거래 = deals.filter(d => d.deposit !== null && d.monthly_rent !== null && d.monthly_rent > 0);

    // 최근 1년 데이터 필터링
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const recent매매 = 매매거래.filter(d => d.deal_year >= lastYear);
    const recent전세 = 전세거래.filter(d => d.deal_year >= lastYear);
    const recent월세 = 월세거래.filter(d => d.deal_year >= lastYear);

    // 월별 추이 분석 (최근 12개월)
    const 월별추이: any = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const 해당월매매 = 매매거래.filter(d => d.deal_year === year && d.deal_month === month);
      const 해당월전세 = 전세거래.filter(d => d.deal_year === year && d.deal_month === month);
      
      월별추이[monthKey] = {
        매매건수: 해당월매매.length,
        매매평균만원: 해당월매매.length > 0 ? Math.round(해당월매매.reduce((sum, d) => sum + d.deal_amount, 0) / 해당월매매.length) : 0,
        전세건수: 해당월전세.length,
        전세평균만원: 해당월전세.length > 0 ? Math.round(해당월전세.reduce((sum, d) => sum + d.deposit, 0) / 해당월전세.length) : 0
      };
    }

    return {
      매매: {
        count: 매매거래.length,
        recentCount: recent매매.length,
        avgPrice: recent매매.length > 0 ? Math.round(recent매매.reduce((sum, d) => sum + d.deal_amount, 0) / recent매매.length) : 0,
        minPrice: recent매매.length > 0 ? Math.min(...recent매매.map(d => d.deal_amount)) : 0,
        maxPrice: recent매매.length > 0 ? Math.max(...recent매매.map(d => d.deal_amount)) : 0,
        transactions: recent매매.slice(0, 5)
      },
      전세: {
        count: 전세거래.length,
        recentCount: recent전세.length,
        avgDeposit: recent전세.length > 0 ? Math.round(recent전세.reduce((sum, d) => sum + d.deposit, 0) / recent전세.length) : 0,
        minDeposit: recent전세.length > 0 ? Math.min(...recent전세.map(d => d.deposit)) : 0,
        maxDeposit: recent전세.length > 0 ? Math.max(...recent전세.map(d => d.deposit)) : 0,
        transactions: recent전세.slice(0, 5)
      },
      월세: {
        count: 월세거래.length,
        recentCount: recent월세.length,
        avgDeposit: recent월세.length > 0 ? Math.round(recent월세.reduce((sum, d) => sum + d.deposit, 0) / recent월세.length) : 0,
        avgRent: recent월세.length > 0 ? Math.round(recent월세.reduce((sum, d) => sum + d.monthly_rent, 0) / recent월세.length) : 0,
        transactions: recent월세.slice(0, 5)
      },
      월별추이
    };
  }

  private generateComprehensivePrompt(data: ApartmentData): string {
    const { aptInfo, deals, building, landuse, nearby, pnu } = data;
    const dataQuality = this.analyzeDataQuality(data);
    const dealAnalysis = this.analyzeRealEstateDeals(deals);
    
    const today = new Date().toISOString().split('T')[0];
    
    return `당신은 전문 부동산 컨설턴트입니다. ${aptInfo.name} 아파트에 대한 종합적인 전문 브리핑을 작성해주세요.

📍 **기본 정보**
- 아파트명: ${aptInfo.name}
- 주소: ${aptInfo.address}
- 좌표: ${aptInfo.lat}, ${aptInfo.lon}
- 분석 기준일: ${today}

📊 **실거래가 분석 결과** (최근 1년 기준):
매매거래: ${dealAnalysis.매매.recentCount}건 (전체 ${dealAnalysis.매매.count}건)
- 평균: ${dealAnalysis.매매.avgPrice > 0 ? `${Math.floor(dealAnalysis.매매.avgPrice / 10000)}억 ${Math.floor((dealAnalysis.매매.avgPrice % 10000) / 1000)}천만원` : '거래 없음'}
- 범위: ${dealAnalysis.매매.minPrice > 0 ? `${Math.floor(dealAnalysis.매매.minPrice / 10000)}억 ${Math.floor((dealAnalysis.매매.minPrice % 10000) / 1000)}천만원` : '0'} ~ ${dealAnalysis.매매.maxPrice > 0 ? `${Math.floor(dealAnalysis.매매.maxPrice / 10000)}억 ${Math.floor((dealAnalysis.매매.maxPrice % 10000) / 1000)}천만원` : '0'}

전세거래: ${dealAnalysis.전세.recentCount}건 (전체 ${dealAnalysis.전세.count}건)
- 평균: ${dealAnalysis.전세.avgDeposit > 0 ? `${Math.floor(dealAnalysis.전세.avgDeposit / 10000)}억 ${Math.floor((dealAnalysis.전세.avgDeposit % 10000) / 1000)}천만원` : '거래 없음'}
- 범위: ${dealAnalysis.전세.minDeposit > 0 ? `${Math.floor(dealAnalysis.전세.minDeposit / 10000)}억 ${Math.floor((dealAnalysis.전세.minDeposit % 10000) / 1000)}천만원` : '0'} ~ ${dealAnalysis.전세.maxDeposit > 0 ? `${Math.floor(dealAnalysis.전세.maxDeposit / 10000)}억 ${Math.floor((dealAnalysis.전세.maxDeposit % 10000) / 1000)}천만원` : '0'}

월세거래: ${dealAnalysis.월세.recentCount}건 (전체 ${dealAnalysis.월세.count}건)
- 평균: 보증금 ${dealAnalysis.월세.avgDeposit > 0 ? `${Math.floor(dealAnalysis.월세.avgDeposit / 10000)}억 ${Math.floor((dealAnalysis.월세.avgDeposit % 10000) / 1000)}천만원` : '0'} / 월세 ${dealAnalysis.월세.avgRent || 0}만원

월별 거래 추이 (최근 12개월):
${JSON.stringify(dealAnalysis.월별추이, null, 2)}

🏗️ **건물 상세 정보**:
${JSON.stringify(building, null, 2)}

📋 **토지이용계획 정보**:
${JSON.stringify(landuse, null, 2)}

🌍 **주변 환경 정보** (반경 500m):
${JSON.stringify(nearby, null, 2)}

🗺️ **PNU 정보**:
${JSON.stringify(pnu, null, 2)}

---

${aptInfo.name}에 대한 친근하고 읽기 쉬운 브리핑을 작성해주세요:

안녕하세요! ${aptInfo.name}에 대한 브리핑을 준비했습니다 😊

**💰 실거래가 현황 (최근 1년 기준)**
매매거래가 ${dealAnalysis.매매.recentCount}건 있었고 ${dealAnalysis.매매.avgPrice > 0 ? `평균 매매가는 ${Math.floor(dealAnalysis.매매.avgPrice / 10000)}억 ${Math.floor((dealAnalysis.매매.avgPrice % 10000) / 1000)}천만원 정도입니다` : '매매 거래는 아직 확인되지 않았네요'}. 전세의 경우 ${dealAnalysis.전세.recentCount}건의 거래가 있었고 ${dealAnalysis.전세.avgDeposit > 0 ? `보증금 평균이 ${Math.floor(dealAnalysis.전세.avgDeposit / 10000)}억 ${Math.floor((dealAnalysis.전세.avgDeposit % 10000) / 1000)}천만원 선에서 형성되고 있습니다` : '전세 거래는 많지 않은 상황이에요'}. 월세는 ${dealAnalysis.월세.recentCount}건으로 ${dealAnalysis.월세.avgRent > 0 ? `보증금 ${Math.floor(dealAnalysis.월세.avgDeposit / 10000)}억 ${Math.floor((dealAnalysis.월세.avgDeposit % 10000) / 1000)}천만원에 월세 ${dealAnalysis.월세.avgRent}만원 정도가 평균적이네요` : '월세 거래는 제한적입니다'}.

**📈 최근 12개월 거래 추이**
⚠️ 중요: 아래 데이터에서 매매평균만원, 전세평균만원은 만원 단위입니다. 15794는 15,794만원(약 15.8억원)을 의미합니다.
${JSON.stringify(dealAnalysis.월별추이, null, 2)}

**🏠 건물 정보**
${JSON.stringify(building, null, 2)}

**🌍 주변 환경 (반경 500m)**
${JSON.stringify(nearby, null, 2)}

**📋 토지이용계획**
${JSON.stringify(landuse, null, 2)}

**🗺️ PNU 정보**
${JSON.stringify(pnu, null, 2)}

위 정보를 바탕으로 다음과 같이 브리핑해주세요:

1. **💰 시세 분석**: 매매/전세/월세 현황을 자연스럽게 설명하되, 단위를 정확하게 표현 (15794만원 = 15.8억원)
2. **📈 거래 동향**: 월별 추이에서 거래량 변화와 가격 변동을 구체적으로 분석
3. **🏠 단지 특징**: 건물 정보를 바탕으로 세대수, 층수, 주차 등 핵심 정보 요약
4. **🌍 입지 환경**: 주변 시설을 교통/교육/생활/문화로 구분하여 실제 검색된 시설만 언급
5. **💡 종합 의견**: 근거를 바탕으로 한 투자/거주 관점에서의 평가

길이: 1200-1800자, 상담하는 느낌의 친근한 어조로 작성`;
  }

  async generateSummary(data: ApartmentData): Promise<SummaryResult> {
    try {
      console.log('🤖 아파트 종합 분석 시작:', data.aptInfo.name);
      
      const dataQuality = this.analyzeDataQuality(data);
      console.log('📊 데이터 품질 분석:', dataQuality);

      const prompt = this.generateComprehensivePrompt(data);
      
      console.log('🔤 프롬프트 길이:', prompt.length, '자');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 한국의 친근하고 전문적인 부동산 컨설턴트입니다. 

✅ 분석 원칙:
1. 실제 데이터만 사용 (제공된 거래 데이터, 건물 정보, 주변 시설 정보만 근거로 함)
2. 매매/전세/월세 구분: deal_amount가 있으면 매매, deposit만 있으면 전세, deposit+monthly_rent가 있으면 월세
3. 최근 1년 기준: 2023년 이후 데이터를 "최근"으로 정의
4. 근거 명시: 모든 수치에 대해 "○○건 거래 기준" 등 근거 명확히 표시
5. 할루시네이션 금지: 데이터에 없는 내용은 "데이터 부족으로 확인 불가"로 표시

🎯 말투 및 스타일:
- 친근하면서도 전문적인 어조 사용
- "~했습니다", "~되고 있습니다" 등 정중하고 자연스러운 표현
- 딱딱한 리포트가 아닌 상담하는 느낌의 브리핑
- 적절한 이모지 사용으로 가독성 향상
- 구체적인 숫자와 근거를 자연스럽게 포함`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2500,
      });

      const summary = response.choices[0].message.content;
      
      if (!summary) {
        throw new Error('AI 응답이 비어있습니다.');
      }

      console.log('✅ AI 요약 생성 완료');
      console.log('📝 요약 길이:', summary.length, '자');

      return {
        success: true,
        summary,
        dataQuality,
      };

    } catch (error) {
      console.error('❌ AI 요약 생성 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '요약 생성 중 오류가 발생했습니다.',
        dataQuality: this.analyzeDataQuality(data),
      };
    }
  }

  async saveSummaryToDatabase(
    aptId: number,
    aptName: string,
    jibunAddress: string,
    summary: string,
    userId: string
  ): Promise<boolean> {
    try {
      console.log('💾 AI 요약 DB 저장 시작:', aptName);

      // 기존 요약이 있으면 업데이트, 없으면 삽입
      await sql`
        INSERT INTO oi.ai_smart_summary (apt_id, apt_nm, jibun_address, summary, user_id, created_at, updated_at)
        VALUES (${aptId}, ${aptName}, ${jibunAddress}, ${summary}, ${userId}, NOW(), NOW())
        ON CONFLICT (apt_id, user_id) 
        DO UPDATE SET 
          summary = EXCLUDED.summary,
          updated_at = NOW()
      `.execute(db);

      console.log('✅ AI 요약 DB 저장 완료');
      return true;

    } catch (error) {
      console.error('❌ AI 요약 DB 저장 오류:', error);
      return false;
    }
  }

  async getSavedSummary(aptId: number): Promise<{ summary?: string; createdAt?: string; userId?: string }> {
    try {
      console.log('🔍 저장된 AI 요약 조회:', aptId);

      const result = await sql`
        SELECT summary, created_at, user_id
        FROM oi.ai_smart_summary
        WHERE apt_id = ${aptId}
        ORDER BY updated_at DESC
        LIMIT 1
      `.execute(db);

      if (result.length > 0) {
        console.log('✅ 저장된 요약 발견');
        return {
          summary: result[0].summary as string,
          createdAt: result[0].created_at as string,
          userId: result[0].user_id as string,
        };
      } else {
        console.log('ℹ️ 저장된 요약 없음');
        return {};
      }

    } catch (error) {
      console.error('❌ 저장된 요약 조회 오류:', error);
      return {};
    }
  }

  // 데이터 검증 헬퍼
  validateInputData(data: ApartmentData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.aptInfo?.name) {
      errors.push('아파트명이 없습니다.');
    }

    if (!data.aptInfo?.address) {
      errors.push('주소 정보가 없습니다.');
    }

    if (!data.aptInfo?.lat || !data.aptInfo?.lon) {
      errors.push('좌표 정보가 없습니다.');
    }

    const dataQuality = this.analyzeDataQuality(data);
    const hasAnyData = Object.values(dataQuality).some(v => v);

    if (!hasAnyData) {
      errors.push('분석할 수 있는 데이터가 충분하지 않습니다.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}