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