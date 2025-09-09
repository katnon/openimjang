// AI Function Calling 전용 API 라우터
import { Hono } from 'hono';
import { tools } from '../ai/tools';
import { handlers } from '../ai/handlers';
import { validateOrThrow } from '../ai/tools/validation';

const apiAiToolsRoute = new Hono();

// POST /api/ai/tools/:name - 특정 AI 함수 호출
apiAiToolsRoute.post('/tools/:name', async (c) => {
  try {
    const { name } = c.req.param();
    
    // 함수 존재 여부 확인
    const tool = tools.find(t => t.function.name === name);
    if (!tool) {
      return c.json({ 
        success: false, 
        error: `알 수 없는 함수입니다: ${name}`,
        availableFunctions: tools.map(t => t.function.name)
      }, 404);
    }

    // 요청 바디 파싱
    let requestBody: any;
    try {
      requestBody = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: '유효하지 않은 JSON 형식입니다.'
      }, 400);
    }

    // JSON Schema 검증
    try {
      validateOrThrow(tool.function, requestBody);
    } catch (validationError: any) {
      return c.json({
        success: false,
        error: validationError.message || '파라미터 검증 실패',
        validationDetails: validationError.validationErrors
      }, validationError.status || 400);
    }

    // 핸들러 존재 여부 확인
    const handler = handlers[name];
    if (!handler) {
      return c.json({
        success: false,
        error: `${name} 핸들러가 아직 구현되지 않았습니다.`
      }, 501);
    }

    // 함수 실행
    console.log(`🔧 AI Function 호출: ${name}`, requestBody);
    const result = await handler(requestBody);
    
    return c.json({
      success: true,
      function: name,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ AI Function 실행 오류:', error);
    return c.json({
      success: false,
      error: error.message || 'AI 함수 실행 중 오류가 발생했습니다.'
    }, 500);
  }
});

// GET /api/ai/tools - 사용 가능한 함수 목록 조회
apiAiToolsRoute.get('/tools', async (c) => {
  return c.json({
    success: true,
    totalCount: tools.length,
    functions: tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }))
  });
});

// GET /api/ai/tools/:name - 특정 함수 정보 조회
apiAiToolsRoute.get('/tools/:name', async (c) => {
  const { name } = c.req.param();
  const tool = tools.find(t => t.function.name === name);
  
  if (!tool) {
    return c.json({
      success: false,
      error: `함수를 찾을 수 없습니다: ${name}`
    }, 404);
  }

  return c.json({
    success: true,
    function: tool.function
  });
});

export default apiAiToolsRoute;