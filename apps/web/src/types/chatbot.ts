// ChatBot Types
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: {
        type: 'apartment' | 'memo' | 'image';
        data: any;
    }[];
    // RAG 및 하이브리드 모드 관련 정보
    sources?: string[];
    metadata?: {
        ragSources?: string[];
        ragDocuments?: number;
        ragRelevanceScore?: number;
        functionsExecuted?: string[];
        toolCallsCount?: number;
        processingMode?: 'RAG-only' | 'RAG+Functions' | 'Functions-only';
    };
}

export type ChatSessionType = 'general' | 'apartment' | 'memo';

export interface ChatContextData {
    apartmentId?: string;
    apartmentName?: string;
    apartmentAddress?: string;
    memoId?: string;
    memoContent?: string;
    memoPhotos?: string[];
}

export interface ChatSession {
    id: string;
    title: string;
    type: ChatSessionType;
    contextData?: ChatContextData;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    messageCount: number; // 메시지 개수 (정렬용)
}

export interface CreateChatSessionParams {
    type: ChatSessionType;
    contextData?: ChatContextData;
    initialMessage?: string;
}