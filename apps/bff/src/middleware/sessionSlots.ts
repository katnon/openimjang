// apps/bff/src/middleware/sessionSlots.ts
// 세션 기반 슬롯 저장 및 관리 미들웨어

import { Context, Next } from 'hono';
import * as iconv from 'iconv-lite';
import { 
  UserSession, 
  ConversationSlots, 
  SessionMessage, 
  SessionStorage, 
  SlotUpdateOptions,
  SlotMiddlewareConfig,
  DEFAULT_SLOT_CONFIG 
} from '../ai/types/slots';
import { extractSlotsFromMessage } from '../ai/extractors/infoExtractor';
import { resolveReferences, mergeSlots } from '../ai/resolvers/referenceResolver';
import { v4 as uuidv4 } from 'uuid';

/**
 * 메모리 기반 세션 저장소 (개발용)
 * 프로덕션에서는 Redis나 DB로 교체 가능
 */
class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, UserSession>();
  private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds

  async getSession(userId: string, sessionId?: string): Promise<UserSession | null> {
    if (!sessionId) {
      // 가장 최근 세션 반환
      const userSessionIds = this.userSessions.get(userId);
      if (!userSessionIds || userSessionIds.size === 0) {
        return null;
      }
      
      const sessions = Array.from(userSessionIds)
        .map(id => this.sessions.get(this.makeKey(userId, id)))
        .filter(Boolean) as UserSession[];
        
      if (sessions.length === 0) return null;
      
      // 가장 최근 접근한 세션 반환
      return sessions.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())[0];
    }

    const key = this.makeKey(userId, sessionId);
    return this.sessions.get(key) || null;
  }

  async saveSession(session: UserSession): Promise<void> {
    const key = this.makeKey(session.userId, session.sessionId);
    this.sessions.set(key, { ...session, lastAccessedAt: new Date() });
    
    // 사용자별 세션 목록 업데이트
    if (!this.userSessions.has(session.userId)) {
      this.userSessions.set(session.userId, new Set());
    }
    this.userSessions.get(session.userId)!.add(session.sessionId);
  }

  async updateSlots(
    userId: string, 
    sessionId: string, 
    slots: Partial<ConversationSlots>, 
    options?: SlotUpdateOptions
  ): Promise<void> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return;

    const strategy = options?.mergeStrategy || 'merge';
    session.slots = mergeSlots(session.slots, slots, [], strategy);
    session.lastAccessedAt = new Date();
    
    await this.saveSession(session);
  }

  async cleanupExpiredSessions(maxAge: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [key, session] of this.sessions.entries()) {
      if (session.lastAccessedAt < cutoff) {
        this.sessions.delete(key);
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
          userSessionIds.delete(session.sessionId);
          if (userSessionIds.size === 0) {
            this.userSessions.delete(session.userId);
          }
        }
        cleaned++;
      }
    }

    return cleaned;
  }

  async listUserSessions(userId: string): Promise<string[]> {
    const sessionIds = this.userSessions.get(userId);
    return sessionIds ? Array.from(sessionIds) : [];
  }

  private makeKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  // 디버깅용 메서드
  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }
}

// 글로벌 세션 저장소 인스턴스
const sessionStorage = new MemorySessionStorage();

// 정리 작업 스케줄러 (24시간마다 실행)
setInterval(async () => {
  const cleaned = await sessionStorage.cleanupExpiredSessions(DEFAULT_SLOT_CONFIG.sessionTTL);
  if (cleaned > 0) {
    console.log(`🧹 만료된 세션 ${cleaned}개 정리 완료`);
  }
}, 24 * 60 * 60 * 1000);

/**
 * Context에 슬롯 관련 정보 추가
 */
declare module 'hono' {
  interface Context {
    session?: UserSession;
    slots?: ConversationSlots;
    slotUpdateCount?: number;
  }
}

/**
 * 슬롯 미들웨어 팩토리
 */
export function createSlotMiddleware(config: Partial<SlotMiddlewareConfig> = {}) {
  const finalConfig = { ...DEFAULT_SLOT_CONFIG, ...config };

  return async (c: Context, next: Next) => {
    try {
      // 인증된 사용자만 처리 (user 정보는 authMiddleware에서 설정)
      // 테스트 환경에서는 임시 사용자 ID 사용
      
      // 🔧 강제로 고정 사용자 ID 사용 (세션 메모리 문제 해결)
      const userId = 'test-user-default';
      console.log('⚠️ 슬롯 미들웨어: 강제 고정 사용자 ID 사용:', userId);
      
      // 요청에서 메시지와 세션 정보 추출
      let body: any = {};
      let message = '';
      
      try {
        // 🌟 근본적 해결: 원본 바이너리 데이터부터 올바르게 처리
        
        // Step 1: 원본 ArrayBuffer 받기
        const rawBuffer = await c.req.arrayBuffer();
        console.log('📡 원본 데이터 크기:', rawBuffer.byteLength, 'bytes');
        
        const uint8Array = new Uint8Array(rawBuffer);
        console.log('🔍 첫 20바이트 (hex):', Array.from(uint8Array.slice(0, 20))
          .map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Step 2: 다양한 인코딩으로 디코딩 시도
        const encodings = ['utf-8', 'euc-kr', 'cp949', 'iso-8859-1'];
        let decodedSuccess = false;
        
        for (const encoding of encodings) {
          try {
            console.log(`🔄 ${encoding} 디코딩 시도...`);
            
            let decodedText: string;
            if (encoding === 'utf-8') {
              // UTF-8 기본 디코딩
              decodedText = new TextDecoder('utf-8').decode(uint8Array);
            } else if (['euc-kr', 'cp949'].includes(encoding)) {
              // iconv-lite로 한국어 인코딩 처리  
              decodedText = iconv.decode(Buffer.from(rawBuffer), encoding);
            } else {
              // 기타 인코딩
              decodedText = iconv.decode(Buffer.from(rawBuffer), encoding);
            }
            
            console.log(`📝 ${encoding} 결과:`, {
              length: decodedText.length,
              sample: decodedText.substring(0, 50),
              hasKorean: /[가-힣]/.test(decodedText),
              hasGarbled: decodedText.includes('�')
            });
            
            // JSON 파싱 시도
            const testBody = JSON.parse(decodedText);
            const testMessage = testBody.message as string;
            
            // 성공 조건: JSON 파싱 성공 + � 문자 없음 + 한글 포함 OR 영어만
            const hasNoGarbled = !testMessage.includes('�');
            const hasKoreanOrValidText = /[가-힣]/.test(testMessage) || /^[a-zA-Z0-9@\s!?.]+$/.test(testMessage);
            
            if (testMessage && hasNoGarbled && hasKoreanOrValidText) {
              console.log(`✅ ${encoding} 디코딩 성공! 메시지: "${testMessage}"`);
              body = testBody;
              message = testMessage;
              decodedSuccess = true;
              break;
            }
          } catch (err) {
            console.log(`❌ ${encoding} 디코딩 실패:`, (err as Error).message.substring(0, 40));
          }
        }
        
        if (!decodedSuccess) {
          console.log('⚠️ 모든 디코딩 실패, 기본 방식으로 폴백');
          body = await c.req.json();
          message = body.message as string;
        }
        
        // 처리된 메시지를 다음 미들웨어에 전달
        c.set('processedMessage', message);
        
        if (finalConfig.debugMode && message) {
          console.log('📝 메시지 파싱 성공:', {
            message: message,
            messageLength: message.length,
            hasAtMention: message.includes('@')
          });
        }
      } catch (parseError) {
        console.error('❌ JSON 파싱 오류:', parseError);
        // 기본 방식으로 fallback
        body = await c.req.json().catch(() => ({}));
        message = body.message as string;
      }
      const requestedSessionId = body.sessionId as string;
      const apartmentMetadata = body.context?.apartmentMetadata || {};

      // 디버깅을 위한 message 값 확인
      console.log('🔍 message 변수 상태:', {
        message,
        messageType: typeof message,
        messageLength: message?.length,
        isEmpty: !message,
        bodyMessage: body.message
      });

      if (!message) {
        if (finalConfig.debugMode) {
          console.log('⚠️ 슬롯 미들웨어: 메시지 없음, 건너뛰기');
        }
        await next();
        return;
      }

      // 기존 세션 로드 또는 새 세션 생성
      let session = await sessionStorage.getSession(userId, requestedSessionId);
      
      if (!session) {
        const sessionId = requestedSessionId || uuidv4();
        session = createNewSession(userId, sessionId, body.context?.userProfile);
        if (finalConfig.debugMode) {
          console.log(`🆕 새 세션 생성: ${userId}:${sessionId}`);
        }
      }

      // 슬롯 추출 및 참조 해석
      const extractionResult = extractSlotsFromMessage(message);
      const resolvedReferences = resolveReferences(
        extractionResult.references,
        session.slots,
        session.messageHistory
      );

      if (finalConfig.debugMode) {
        console.log('🔍 슬롯 추출 결과:', {
          extractedSlots: extractionResult.slots,
          confidence: extractionResult.confidence.toFixed(2),
          references: extractionResult.references.length,
          resolved: resolvedReferences.filter(r => r.resolvedValue !== null).length
        });
      }

      // 슬롯 업데이트 (신뢰도 필터링)
      let slotUpdateCount = 0;
      if (extractionResult.confidence >= finalConfig.confidenceThreshold) {
        const previousSlots = { ...session.slots };
        
        // 기본 슬롯 병합
        session.slots = mergeSlots(session.slots, extractionResult.slots, resolvedReferences);
        
        // @멘션 메타데이터 병합 (아파트명이 있을 때만)
        if (session.slots.apartmentName && apartmentMetadata[session.slots.apartmentName]) {
          const metadata = apartmentMetadata[session.slots.apartmentName];
          session.slots.apartmentMetadata = {
            id: metadata.id,
            address: metadata.address,
            lat: metadata.lat,
            lon: metadata.lon,
            extractedAt: new Date()
          };
          
          // 좌표 정보도 업데이트
          if (metadata.lat && metadata.lon) {
            session.slots.coordinates = {
              lat: metadata.lat,
              lng: metadata.lon
            };
          }
          
          if (finalConfig.debugMode) {
            console.log(`🏠 아파트 메타데이터 저장됨: ${session.slots.apartmentName}`, {
              id: metadata.id,
              address: metadata.address,
              coordinates: metadata.lat && metadata.lon ? [metadata.lat, metadata.lon] : null
            });
          }
        }
        
        // 변경사항 카운트
        slotUpdateCount = countSlotChanges(previousSlots, session.slots);
        
        if (finalConfig.debugMode && slotUpdateCount > 0) {
          console.log(`✅ 슬롯 업데이트: ${slotUpdateCount}개 필드 변경`);
          console.log('현재 슬롯 상태:', session.slots);
        }
      }

      // 메시지 히스토리 업데이트
      const newMessage: SessionMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
        extractedSlots: extractionResult.slots
      };

      session.messageHistory.push(newMessage);
      
      // 히스토리 크기 제한
      if (session.messageHistory.length > finalConfig.maxMessagesInHistory) {
        session.messageHistory = session.messageHistory.slice(-finalConfig.maxMessagesInHistory);
      }

      // 세션 저장
      await sessionStorage.saveSession(session);

      // Context에 정보 첨부
      c.session = session;
      c.slots = session.slots;
      c.slotUpdateCount = slotUpdateCount;

      // 기존 context에 slots 정보 추가 (기존 코드와의 호환성)
      if (body.context) {
        body.context.slots = session.slots;
        body.context.sessionId = session.sessionId;
      }

      await next();

    } catch (error: any) {
      console.error('❌ 슬롯 미들웨어 오류:', error);
      // 오류가 발생해도 요청은 계속 진행
      await next();
    }
  };
}

/**
 * 새 세션 생성
 */
function createNewSession(userId: string, sessionId: string, userProfile?: any): UserSession {
  return {
    userId,
    sessionId,
    slots: {},
    messageHistory: [],
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    userProfile
  };
}

/**
 * 슬롯 변경사항 카운트
 */
function countSlotChanges(before: ConversationSlots, after: ConversationSlots): number {
  let changes = 0;
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    const beforeValue = (before as any)[key];
    const afterValue = (after as any)[key];
    
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes++;
    }
  }
  
  return changes;
}

/**
 * 슬롯 상태 조회 엔드포인트 (디버깅용)
 */
export async function getSlotStatus(c: Context) {
  const userId = c.user?.uid;
  if (!userId) {
    return c.json({ error: '인증이 필요합니다.' }, 401);
  }

  const sessionIds = await sessionStorage.listUserSessions(userId);
  const sessions = await Promise.all(
    sessionIds.map(id => sessionStorage.getSession(userId, id))
  );

  return c.json({
    userId,
    totalSessions: sessionIds.length,
    sessions: sessions.filter(Boolean).map(session => ({
      sessionId: session!.sessionId,
      createdAt: session!.createdAt,
      lastAccessedAt: session!.lastAccessedAt,
      messageCount: session!.messageHistory.length,
      slots: session!.slots
    }))
  });
}

/**
 * 특정 세션 삭제 엔드포인트 (디버깅용)
 */
export async function deleteSession(c: Context) {
  const userId = c.user?.uid;
  const sessionId = c.req.param('sessionId');
  
  if (!userId || !sessionId) {
    return c.json({ error: '사용자 ID와 세션 ID가 필요합니다.' }, 400);
  }

  // 메모리에서 직접 삭제 (실제 구현에서는 storage 인터페이스에 delete 메서드 추가 필요)
  const key = `${userId}:${sessionId}`;
  const success = (sessionStorage as any).sessions.delete(key);
  
  return c.json({ success, deleted: sessionId });
}

// 스토리지 인스턴스 export (테스트용)
export { sessionStorage };

// 기본 슬롯 미들웨어 export
export const slotMiddleware = createSlotMiddleware();