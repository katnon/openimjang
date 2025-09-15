// 단순하고 효과적인 제너럴 LLM 기반 부동산 AI 엔드포인트

import { Hono } from 'hono';
import { ConversationSession } from '../services/conversationSession';
import { SimpleLLMProcessor } from '../services/simpleLLMProcessor';
import { SafeBinaryJsonParser } from '../utils/safeBinaryJsonParser';

const simpleAIRoute = new Hono();

// 세션 관리 (메모리 기반)
const activeSessions = new Map<string, ConversationSession>();
const sessionTTL = 30 * 60 * 1000; // 30분

// 세션 정리
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    const status = session.getSessionStatus();
    if (now - status.lastActivity.getTime() > sessionTTL) {
      session.close();
      activeSessions.delete(sessionId);
      console.log(`🧹 Simple AI 세션 정리: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

/**
 * 단순한 제너럴 LLM 기반 부동산 질의응답
 * POST /simple-chat
 */
simpleAIRoute.post('/simple-chat', async (c) => {
  try {
    // 바이너리 안전 JSON 파싱 사용
    const parseResult = await SafeBinaryJsonParser.safeJsonFromContext(c);
    
    if (!parseResult.success) {
      console.error('❌ JSON 파싱 실패:', parseResult.error);
      return c.json({ 
        success: false, 
        error: `요청 데이터 파싱 실패: ${parseResult.error}` 
      }, 400);
    }
    
    const { message, sessionId } = parseResult.data;
    console.log(`🔍 바이너리 안전 파싱 성공 (${parseResult.encoding}):`, { message: message?.substring(0, 50) });

    if (!message || typeof message !== 'string') {
      return c.json({ 
        success: false, 
        error: 'message는 필수이며 문자열이어야 합니다' 
      }, 400);
    }

    console.log(`🤖 Simple AI 요청: "${message.substring(0, 50)}..."`);

    // 세션 관리
    let session: ConversationSession;
    const finalSessionId = sessionId || `simple_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    if (sessionId && activeSessions.has(sessionId)) {
      session = activeSessions.get(sessionId)!;
      console.log(`♻️ 기존 세션 재사용: ${sessionId}`);
    } else {
      session = new ConversationSession(finalSessionId);
      activeSessions.set(finalSessionId, session);
      console.log(`🆕 새 세션 생성: ${finalSessionId}`);
    }

    // API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return c.json({
        success: false,
        error: 'OpenAI API key가 설정되지 않았습니다'
      }, 500);
    }

    // Simple LLM Processor로 처리
    const processor = new SimpleLLMProcessor(session, apiKey);
    const startTime = Date.now();
    
    const result = await processor.processUserQuery(message);
    const processingTime = Date.now() - startTime;

    console.log(`✅ Simple AI 처리 완료: ${processingTime}ms`);

    // 성공 응답
    return c.json({
      success: true,
      reply: result.reply,
      sessionId: finalSessionId,
      needsMoreInfo: result.needsMoreInfo,
      suggestedQuestions: result.suggestedQuestions,
      dataUsed: result.dataUsed,
      processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Simple AI 처리 오류:', error);
    
    return c.json({
      success: false,
      error: '처리 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * 세션 상태 조회
 * GET /session/:sessionId
 */
simpleAIRoute.get('/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  if (!activeSessions.has(sessionId)) {
    return c.json({ 
      success: false, 
      error: '세션을 찾을 수 없습니다' 
    }, 404);
  }

  const session = activeSessions.get(sessionId)!;
  const status = session.getSessionStatus();

  return c.json({
    success: true,
    session: {
      id: sessionId,
      messageCount: status.messageCount,
      lastActivity: status.lastActivity,
      totalDuration: Date.now() - status.createdAt.getTime()
    }
  });
});

/**
 * 세션 삭제
 * DELETE /session/:sessionId
 */
simpleAIRoute.delete('/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId)!;
    session.close();
    activeSessions.delete(sessionId);
    
    console.log(`🗑️ 세션 삭제: ${sessionId}`);
    
    return c.json({
      success: true,
      message: '세션이 삭제되었습니다'
    });
  }

  return c.json({
    success: false,
    error: '세션을 찾을 수 없습니다'
  }, 404);
});

/**
 * 시스템 상태 조회
 * GET /status
 */
simpleAIRoute.get('/status', async (c) => {
  return c.json({
    success: true,
    system: 'Simple LLM AI',
    version: '1.0.0',
    activeSessions: activeSessions.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default simpleAIRoute;