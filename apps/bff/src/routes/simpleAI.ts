// apps/bff/src/routes/simpleAI.ts
import { Hono } from 'hono';
import { SimpleLLMProcessor } from '../services/simpleLLMProcessor';
import { SafeBinaryJsonParser } from '../utils/safeBinaryJsonParser';

const app = new Hono();

// SimpleLLMProcessor 인스턴스 생성
const llmProcessor = new SimpleLLMProcessor();
const jsonParser = new SafeBinaryJsonParser();

// 세션 ID 생성 유틸리티
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// POST /api/ai/simple-chat - Simple LLM 기반 채팅
app.post('/simple-chat', async (c) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 === Simple AI Chat API 시작 ===');
    
    // 요청 바디를 Buffer로 읽기 (인코딩 문제 해결)
    const rawBuffer = await c.req.arrayBuffer();
    const buffer = Buffer.from(rawBuffer);
    
    console.log(`📦 Raw Request Buffer: ${buffer.length} bytes`);
    console.log(`🔍 Buffer Preview: ${buffer.subarray(0, 100).toString('hex')}`);
    
    // SafeBinaryJsonParser로 파싱
    const parseResult = jsonParser.parseFromBuffer(buffer);
    
    if (!parseResult.success) {
      console.error('❌ JSON 파싱 실패:', parseResult.error);
      return c.json({
        success: false,
        error: 'Invalid JSON format',
        details: parseResult.error,
        debug: {
          originalLength: parseResult.originalLength,
          encoding: parseResult.encoding,
        }
      }, 400);
    }
    
    console.log(`✅ JSON 파싱 성공 (${parseResult.encoding})`);
    console.log('📝 파싱된 데이터:', parseResult.data);
    
    const { query, sessionId: clientSessionId } = parseResult.data;
    
    // 입력 검증
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.error('❌ 질문이 없습니다');
      return c.json({
        success: false,
        error: 'Query is required',
        message: '질문을 입력해주세요.'
      }, 400);
    }
    
    // 세션 ID 처리 (클라이언트에서 제공하지 않으면 새로 생성)
    const sessionId = clientSessionId || generateSessionId();
    
    console.log(`👤 사용자 질문: "${query}"`);
    console.log(`🔑 세션 ID: ${sessionId}`);
    
    // SimpleLLMProcessor로 처리
    const response = await llmProcessor.processUserQuery(query, sessionId);
    
    const processingTime = Date.now() - startTime;
    
    const result = {
      success: true,
      data: {
        query: query.trim(),
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      },
      meta: {
        encoding: parseResult.encoding,
        originalBufferSize: parseResult.originalLength,
        parsedTextLength: parseResult.parsedLength,
        sessionInfo: llmProcessor.getSessionInfo(sessionId),
      }
    };
    
    console.log(`✅ Simple AI 처리 완료 (${processingTime}ms)`);
    console.log(`📤 응답 길이: ${response.length}자`);
    console.log('🏁 === Simple AI Chat API 완료 ===\n');
    
    return c.json(result);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('💥 Simple AI Chat API 오류:', error);
    console.error('⏱️ 오류 발생 시점:', `${processingTime}ms`);
    
    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      debug: {
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      }
    }, 500);
  }
});

// GET /api/ai/simple-stats - Simple AI 통계 조회
app.get('/simple-stats', async (c) => {
  try {
    const stats = {
      activeSessionCount: llmProcessor.getActiveSessionCount(),
      systemStatus: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
    
    return c.json({
      success: true,
      data: stats,
    });
    
  } catch (error) {
    console.error('❌ Stats 조회 오류:', error);
    return c.json({
      success: false,
      error: 'Failed to get stats',
    }, 500);
  }
});

// GET /api/ai/simple-health - 헬스체크
app.get('/simple-health', async (c) => {
  try {
    // 기본 헬스체크
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        llmProcessor: 'ok',
        jsonParser: 'ok',
        database: 'ok', // 실제로는 DB 연결 확인 필요
        openai: process.env.OPENAI_API_KEY ? 'ok' : 'missing_api_key',
      },
      memory: {
        activeSessionCount: llmProcessor.getActiveSessionCount(),
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      },
    };
    
    const hasErrors = Object.values(health.services).some(status => status !== 'ok');
    
    return c.json({
      success: !hasErrors,
      data: health,
    }, hasErrors ? 503 : 200);
    
  } catch (error) {
    console.error('❌ Health check 오류:', error);
    return c.json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// GET /api/ai/simple-session/:sessionId - 세션 정보 조회
app.get('/simple-session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID is required',
      }, 400);
    }
    
    const sessionInfo = llmProcessor.getSessionInfo(sessionId);
    
    if (!sessionInfo) {
      return c.json({
        success: false,
        error: 'Session not found',
        message: '세션이 존재하지 않거나 만료되었습니다.',
      }, 404);
    }
    
    return c.json({
      success: true,
      data: sessionInfo,
    });
    
  } catch (error) {
    console.error('❌ Session 조회 오류:', error);
    return c.json({
      success: false,
      error: 'Failed to get session info',
    }, 500);
  }
});

// POST /api/ai/simple-test - 테스트용 엔드포인트
app.post('/simple-test', async (c) => {
  try {
    // 테스트 질문들
    const testQueries = [
      '잠실 래미안 가격 알려줘',
      '목동에서 어떤 아파트가 좋아?',
      '84형 시세 어때?',
      '강남구 아파트 추천해줘',
    ];
    
    const randomQuery = testQueries[Math.floor(Math.random() * testQueries.length)];
    const testSessionId = `test_${Date.now()}`;
    
    console.log(`🧪 테스트 질문: "${randomQuery}"`);
    
    const response = await llmProcessor.processUserQuery(randomQuery, testSessionId);
    
    return c.json({
      success: true,
      data: {
        testQuery: randomQuery,
        response,
        sessionId: testSessionId,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('❌ Test 실행 오류:', error);
    return c.json({
      success: false,
      error: 'Test failed',
      details: (error as Error).message,
    }, 500);
  }
});

// POST /api/ai/simple-encoding-test - 인코딩 테스트
app.post('/simple-encoding-test', async (c) => {
  try {
    const rawBuffer = await c.req.arrayBuffer();
    const buffer = Buffer.from(rawBuffer);
    
    // Buffer 분석
    const analysis = jsonParser.analyzeBuffer(buffer);
    
    // 파싱 시도
    const parseResult = jsonParser.parseFromBuffer(buffer);
    
    return c.json({
      success: true,
      data: {
        bufferAnalysis: analysis,
        parseResult: {
          success: parseResult.success,
          encoding: parseResult.encoding,
          error: parseResult.error,
          originalLength: parseResult.originalLength,
          parsedLength: parseResult.parsedLength,
          dataPreview: parseResult.success ? 
            JSON.stringify(parseResult.data).slice(0, 200) + '...' : 
            null,
        },
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('❌ Encoding test 오류:', error);
    return c.json({
      success: false,
      error: 'Encoding test failed',
      details: (error as Error).message,
    }, 500);
  }
});

export default app;