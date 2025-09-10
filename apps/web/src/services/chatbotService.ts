import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    limit,
    where,
    Timestamp,
    arrayUnion
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { 
    ChatSession, 
    ChatMessage, 
    CreateChatSessionParams, 
    ChatSessionType 
} from '@/types/chatbot';

class ChatbotService {
    private getUserChatSessionsRef(userId: string) {
        return collection(db, 'users', userId, 'chatSessions');
    }

    private getChatSessionRef(userId: string, sessionId: string) {
        return doc(db, 'users', userId, 'chatSessions', sessionId);
    }

    // 제목 생성 (첫 메시지 기반)
    private generateTitle(message: string, type: ChatSessionType, contextData?: any): string {
        const maxLength = 50;
        
        if (type === 'apartment' && contextData?.apartmentName) {
            return `${contextData.apartmentName} 관련 문의`;
        }
        
        if (type === 'memo') {
            return '임장 메모 분석';
        }
        
        // 일반 대화의 경우 첫 메시지에서 제목 생성
        let title = message.length > maxLength 
            ? message.substring(0, maxLength) + '...' 
            : message;
            
        return title;
    }

    // 새 채팅 세션 생성
    async createChatSession(userId: string, params: CreateChatSessionParams): Promise<string> {
        try {
            const now = new Date();
            const title = this.generateTitle(
                params.initialMessage || '새 대화', 
                params.type, 
                params.contextData
            );

            // 기존 활성 세션들을 비활성화
            await this.deactivateAllSessions(userId);

            // undefined 값 제거하여 Firebase 오류 방지
            const sessionData: any = {
                title,
                type: params.type,
                messages: [],
                createdAt: now,
                updatedAt: now,
                isActive: true,
                messageCount: 0
            };

            // contextData가 있을 때만 추가
            if (params.contextData && Object.keys(params.contextData).length > 0) {
                sessionData.contextData = params.contextData;
            }

            // undefined 필드 제거
            Object.keys(sessionData).forEach(key => {
                if (sessionData[key] === undefined) {
                    delete sessionData[key];
                }
            });

            const docRef = await addDoc(this.getUserChatSessionsRef(userId), {
                ...sessionData,
                createdAt: Timestamp.fromDate(now),
                updatedAt: Timestamp.fromDate(now)
            });

            console.log('✅ 새 채팅 세션 생성:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ 채팅 세션 생성 오류:', error);
            throw error;
        }
    }

    // 모든 세션 비활성화
    private async deactivateAllSessions(userId: string): Promise<void> {
        try {
            const sessionsRef = this.getUserChatSessionsRef(userId);
            const activeQuery = query(sessionsRef, where('isActive', '==', true));
            const snapshot = await getDocs(activeQuery);

            const updatePromises = snapshot.docs.map(doc => 
                updateDoc(doc.ref, { isActive: false })
            );

            await Promise.all(updatePromises);
        } catch (error) {
            console.error('❌ 세션 비활성화 오류:', error);
        }
    }

    // 채팅 세션에 메시지 추가
    async addMessage(userId: string, sessionId: string, message: ChatMessage): Promise<void> {
        try {
            const sessionRef = this.getChatSessionRef(userId, sessionId);
            const now = new Date();

            // undefined 값 제거하여 Firebase 오류 방지
            const cleanMessage: any = {
                id: message.id,
                role: message.role,
                content: message.content,
                timestamp: Timestamp.fromDate(message.timestamp)
            };

            // 선택적 필드들 추가 (undefined가 아닐 때만)
            if (message.images && message.images.length > 0) {
                cleanMessage.images = message.images;
            }
            if (message.attachments && message.attachments.length > 0) {
                cleanMessage.attachments = message.attachments;
            }
            if (message.sources && message.sources.length > 0) {
                cleanMessage.sources = message.sources;
            }
            if (message.metadata) {
                cleanMessage.metadata = message.metadata;
            }

            await updateDoc(sessionRef, {
                messages: arrayUnion(cleanMessage),
                updatedAt: Timestamp.fromDate(now),
                messageCount: (await this.getMessageCount(userId, sessionId)) + 1
            });

            console.log('✅ 메시지 추가 완료:', message.id);
        } catch (error) {
            console.error('❌ 메시지 추가 오류:', error);
            throw error;
        }
    }

    // 메시지 개수 조회
    private async getMessageCount(userId: string, sessionId: string): Promise<number> {
        try {
            const sessionRef = this.getChatSessionRef(userId, sessionId);
            const doc = await getDoc(sessionRef);
            const data = doc.data();
            return data?.messages?.length || 0;
        } catch (error) {
            return 0;
        }
    }

    // 채팅 세션 목록 조회 (최신순)
    async getChatSessions(userId: string, limitCount: number = 20): Promise<ChatSession[]> {
        try {
            const sessionsRef = this.getUserChatSessionsRef(userId);
            const q = query(
                sessionsRef,
                orderBy('updatedAt', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);
            const sessions: ChatSession[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                sessions.push({
                    id: doc.id,
                    title: data.title,
                    type: data.type,
                    contextData: data.contextData,
                    messages: data.messages?.map((msg: any) => ({
                        ...msg,
                        timestamp: msg.timestamp?.toDate() || new Date()
                    })) || [],
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                    isActive: data.isActive || false,
                    messageCount: data.messageCount || 0
                });
            });

            console.log('✅ 채팅 세션 목록 조회:', sessions.length, '개');
            return sessions;
        } catch (error) {
            console.error('❌ 채팅 세션 목록 조회 오류:', error);
            return [];
        }
    }

    // 특정 채팅 세션 조회
    async getChatSession(userId: string, sessionId: string): Promise<ChatSession | null> {
        try {
            const sessionRef = this.getChatSessionRef(userId, sessionId);
            const docSnap = await getDoc(sessionRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = docSnap.data();
            const session: ChatSession = {
                id: docSnap.id,
                title: data.title,
                type: data.type,
                contextData: data.contextData,
                messages: data.messages?.map((msg: any) => ({
                    ...msg,
                    timestamp: msg.timestamp?.toDate() || new Date()
                })) || [],
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                isActive: data.isActive || false,
                messageCount: data.messageCount || 0
            };

            console.log('✅ 채팅 세션 조회:', session.id, session.title);
            return session;
        } catch (error) {
            console.error('❌ 채팅 세션 조회 오류:', error);
            return null;
        }
    }

    // 채팅 세션 활성화
    async activateSession(userId: string, sessionId: string): Promise<void> {
        try {
            // 기존 활성 세션 비활성화
            await this.deactivateAllSessions(userId);

            // 새 세션 활성화
            const sessionRef = this.getChatSessionRef(userId, sessionId);
            await updateDoc(sessionRef, {
                isActive: true,
                updatedAt: Timestamp.fromDate(new Date())
            });

            console.log('✅ 세션 활성화:', sessionId);
        } catch (error) {
            console.error('❌ 세션 활성화 오류:', error);
            throw error;
        }
    }

    // 현재 활성 세션 조회
    async getActiveSession(userId: string): Promise<ChatSession | null> {
        try {
            const sessionsRef = this.getUserChatSessionsRef(userId);
            const activeQuery = query(sessionsRef, where('isActive', '==', true));
            const snapshot = await getDocs(activeQuery);

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            const data = doc.data();

            return {
                id: doc.id,
                title: data.title,
                type: data.type,
                contextData: data.contextData,
                messages: data.messages?.map((msg: any) => ({
                    ...msg,
                    timestamp: msg.timestamp?.toDate() || new Date()
                })) || [],
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                isActive: true,
                messageCount: data.messageCount || 0
            };
        } catch (error) {
            console.error('❌ 활성 세션 조회 오류:', error);
            return null;
        }
    }

    // 채팅 세션 삭제
    async deleteChatSession(userId: string, sessionId: string): Promise<void> {
        try {
            const sessionRef = this.getChatSessionRef(userId, sessionId);
            await updateDoc(sessionRef, {
                isActive: false,
                // 실제 삭제 대신 비활성화 (데이터 보존)
            });
            console.log('✅ 채팅 세션 삭제:', sessionId);
        } catch (error) {
            console.error('❌ 채팅 세션 삭제 오류:', error);
            throw error;
        }
    }
}

export const chatbotService = new ChatbotService();