// apps/bff/src/routes/aiSummary.ts
import { Hono } from 'hono';
import { ApartmentSummaryService } from '../services/apartmentSummaryService';

const app = new Hono();

// ApartmentSummaryService 인스턴스 생성
const summaryService = new ApartmentSummaryService();

// POST /api/ai/apartment-summary - 아파트 종합 분석
app.post('/apartment-summary', async (c) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 === 아파트 종합 분석 API 시작 ===');
    
    const requestData = await c.req.json();
    console.log('📥 요청 데이터 수신:', {
      type: requestData.type,
      hasData: !!requestData.data,
      aptName: requestData.data?.aptInfo?.name || 'unknown'
    });

    // 요청 데이터 검증
    if (!requestData.data) {
      console.error('❌ 분석 데이터가 없습니다');
      return c.json({
        success: false,
        error: 'Analysis data is required',
        message: '분석할 데이터가 필요합니다.'
      }, 400);
    }

    const apartmentData = requestData.data;

    // 입력 데이터 검증
    const validation = summaryService.validateInputData(apartmentData);
    if (!validation.isValid) {
      console.error('❌ 데이터 검증 실패:', validation.errors);
      return c.json({
        success: false,
        error: 'Invalid input data',
        message: validation.errors.join(', '),
        validationErrors: validation.errors
      }, 400);
    }

    console.log('✅ 데이터 검증 통과');
    console.log('📊 분석할 아파트:', apartmentData.aptInfo.name);
    console.log('📍 주소:', apartmentData.aptInfo.address);
    console.log('📈 수집된 데이터:');
    console.log('  - 실거래가:', apartmentData.deals?.length || 0, '건');
    console.log('  - 건물정보:', apartmentData.building ? '있음' : '없음');
    console.log('  - 토지이용:', apartmentData.landuse?.landuse_zones?.length || 0, '개');
    console.log('  - 주변시설:', apartmentData.nearby?.pois?.length || 0, '개');
    console.log('  - PNU정보:', apartmentData.pnu ? '있음' : '없음');

    // AI 종합 분석 실행
    console.log('\n🤖 AI 종합 분석 실행 중...');
    const analysisResult = await summaryService.generateSummary(apartmentData);

    const processingTime = Date.now() - startTime;

    if (!analysisResult.success) {
      console.error('❌ AI 분석 실패:', analysisResult.error);
      return c.json({
        success: false,
        error: 'AI analysis failed',
        message: analysisResult.error || 'AI 분석 중 오류가 발생했습니다.',
        dataQuality: analysisResult.dataQuality,
        processingTime: `${processingTime}ms`
      }, 500);
    }

    console.log('✅ AI 분석 완료');
    console.log('📝 요약 길이:', analysisResult.summary?.length || 0, '자');

    const result = {
      success: true,
      data: {
        summary: analysisResult.summary,
        aptInfo: apartmentData.aptInfo,
        dataQuality: analysisResult.dataQuality,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      },
      meta: {
        apiVersion: '1.0.0',
        model: 'gpt-4o-mini',
        dataSourcesUsed: {
          deals: !!apartmentData.deals?.length,
          building: !!apartmentData.building,
          landuse: !!apartmentData.landuse?.landuse_zones?.length,
          nearby: !!apartmentData.nearby?.pois?.length,
          pnu: !!apartmentData.pnu
        }
      }
    };

    console.log(`🏁 === 아파트 종합 분석 완료 (${processingTime}ms) ===\n`);
    
    return c.json(result);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('💥 아파트 종합 분석 API 오류:', error);
    console.error('⏱️ 오류 발생 시점:', `${processingTime}ms`);
    
    return c.json({
      success: false,
      error: 'Internal server error',
      message: '아파트 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      debug: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      }
    }, 500);
  }
});

// POST /api/ai/summary/save - AI 요약 결과 저장
app.post('/summary/save', async (c) => {
  try {
    console.log('💾 AI 요약 저장 요청');
    
    const { aptId, aptName, jibunAddress, summary, userId } = await c.req.json();

    // 입력 검증
    if (!aptId || !aptName || !jibunAddress || !summary || !userId) {
      console.error('❌ 필수 필드 누락');
      return c.json({
        success: false,
        error: 'Missing required fields',
        message: '필수 필드가 누락되었습니다.',
        required: ['aptId', 'aptName', 'jibunAddress', 'summary', 'userId']
      }, 400);
    }

    console.log('📝 저장할 요약 정보:');
    console.log('  - 아파트 ID:', aptId);
    console.log('  - 아파트명:', aptName);
    console.log('  - 사용자 ID:', userId);
    console.log('  - 요약 길이:', summary.length, '자');

    const saveResult = await summaryService.saveSummaryToDatabase(
      aptId,
      aptName,
      jibunAddress,
      summary,
      userId
    );

    if (saveResult) {
      console.log('✅ AI 요약 저장 완료');
      return c.json({
        success: true,
        message: 'AI 요약이 성공적으로 저장되었습니다.',
        data: {
          aptId,
          aptName,
          savedAt: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ AI 요약 저장 실패');
      return c.json({
        success: false,
        error: 'Save failed',
        message: 'AI 요약 저장에 실패했습니다.'
      }, 500);
    }

  } catch (error) {
    console.error('💥 AI 요약 저장 API 오류:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: '저장 중 오류가 발생했습니다.',
      debug: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, 500);
  }
});

// GET /api/ai/summary/:aptId - 저장된 AI 요약 조회
app.get('/summary/:aptId', async (c) => {
  try {
    const aptId = parseInt(c.req.param('aptId'));
    
    if (isNaN(aptId)) {
      console.error('❌ 잘못된 아파트 ID:', c.req.param('aptId'));
      return c.json({
        success: false,
        error: 'Invalid apartment ID',
        message: '유효하지 않은 아파트 ID입니다.'
      }, 400);
    }

    console.log('🔍 저장된 AI 요약 조회:', aptId);

    const savedSummary = await summaryService.getSavedSummary(aptId);

    if (savedSummary.summary) {
      console.log('✅ 저장된 요약 발견');
      return c.json({
        success: true,
        data: {
          summary: savedSummary.summary,
          createdAt: savedSummary.createdAt,
          userId: savedSummary.userId,
          aptId: aptId
        }
      });
    } else {
      console.log('ℹ️ 저장된 요약 없음');
      return c.json({
        success: false,
        error: 'Summary not found',
        message: '저장된 AI 요약이 없습니다.'
      }, 404);
    }

  } catch (error) {
    console.error('💥 AI 요약 조회 API 오류:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: '조회 중 오류가 발생했습니다.',
      debug: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, 500);
  }
});

// GET /api/ai/summary-health - AI 요약 시스템 헬스체크
app.get('/summary-health', async (c) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        apartmentSummaryService: 'ok',
        database: 'ok',
        openai: process.env.OPENAI_API_KEY ? 'ok' : 'missing_api_key',
      },
      features: {
        comprehensiveAnalysis: 'enabled',
        dataValidation: 'enabled',
        summaryStorage: 'enabled',
        model: 'gpt-4o-mini'
      }
    };
    
    const hasErrors = Object.values(health.services).some(status => status !== 'ok');
    
    return c.json({
      success: !hasErrors,
      data: health,
    }, hasErrors ? 503 : 200);
    
  } catch (error) {
    console.error('❌ AI 요약 헬스체크 오류:', error);
    return c.json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// POST /api/ai/summary-test - AI 요약 테스트용 엔드포인트
app.post('/summary-test', async (c) => {
  try {
    console.log('🧪 AI 요약 시스템 테스트 실행');

    // 테스트용 더미 데이터
    const testData = {
      aptInfo: {
        name: '테스트아파트',
        address: '서울특별시 강남구 테스트동 123',
        lat: 37.5665,
        lon: 126.9780
      },
      deals: [
        {
          apt_nm: '테스트아파트',
          deal_amount: 150000, // 15억
          exclu_use_ar: 84.99,
          deal_year: 2024,
          deal_month: 9,
          floor: 10
        }
      ],
      building: {
        total_count: 1,
        hhldcnt: 500,
        totpkngcnt: 600,
        grndflrcnt: 25,
        ugrndflrcnt: 3
      },
      landuse: {
        landuse_zones: [
          { zone_type: '제2종일반주거지역', area: 1000 }
        ]
      },
      nearby: {
        pois: [
          { name: '테스트역', category: '지하철', distance: 200 },
          { name: '테스트초등학교', category: '교육시설', distance: 300 }
        ]
      },
      pnu: {
        pnu: '1168012345'
      }
    };

    const analysisResult = await summaryService.generateSummary(testData);
    
    return c.json({
      success: true,
      data: {
        testData: testData,
        analysisResult: analysisResult,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('❌ AI 요약 테스트 오류:', error);
    return c.json({
      success: false,
      error: 'Test failed',
      details: (error as Error).message,
    }, 500);
  }
});

export default app;