import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import axios from "axios";

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: string[];
};

type ChatbotModalProps = {
    isOpen: boolean;
    onClose: () => void;
    contextData?: {
        aptId?: number | string;
        aptName?: string;
        aptAddress?: string;
        memoContent?: string;
        type: 'general' | 'apartment' | 'memo';
    };
};

export default function ChatbotModal({ isOpen, onClose, contextData }: ChatbotModalProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 메시지 자동 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 모달이 열릴 때 입력창에 포커스
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // 컨텍스트에 따른 초기 메시지 설정
    useEffect(() => {
        if (isOpen && contextData) {
            let welcomeMessage = '';
            switch (contextData.type) {
                case 'apartment':
                    welcomeMessage = `${contextData.aptName}에 대해 궁금한 것이 있으시면 언제든 물어보세요! 실거래가, 교통, 생활편의시설 등 다양한 정보를 제공해드릴 수 있습니다.`;
                    break;
                case 'memo':
                    welcomeMessage = `작성하신 임장 메모를 바탕으로 추가 질문에 답변해드리겠습니다. 궁금한 점이 있으시면 언제든 물어보세요!`;
                    break;
                default:
                    welcomeMessage = `안녕하세요! OpenImjang AI 어시스턴트입니다. 부동산 관련 궁금한 점이 있으시면 언제든 물어보세요.`;
            }

            setMessages([{
                id: '1',
                role: 'assistant',
                content: welcomeMessage,
                timestamp: new Date()
            }]);
        } else if (isOpen && !contextData) {
            setMessages([{
                id: '1',
                role: 'assistant',
                content: '안녕하세요! OpenImjang AI 어시스턴트입니다. 부동산 관련 궁금한 점이 있으시면 언제든 물어보세요.',
                timestamp: new Date()
            }]);
        }
    }, [isOpen, contextData]);

    if (!isOpen || !user) return null;

    const sendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // 채팅 히스토리 준비 (최근 10개만)
            const chatHistory = messages
                .slice(-10)
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            // 아파트 데이터와 메모 데이터 준비
            const aptData = (contextData?.type === 'apartment' || contextData?.type === 'memo') ? {
                aptName: contextData.aptName,
                address: contextData.aptAddress,
                lat: null, // TODO: 위치 정보가 필요하다면 추가
                lon: null
            } : null;

            // 메모 컨텍스트인 경우 메모 데이터 준비
            const memos = contextData?.type === 'memo' && contextData.memoContent ? [
                {
                    title: contextData.memoContent.split('\n')[0] || '임장 메모',
                    body: contextData.memoContent.split('\n').slice(1).join('\n') || '',
                    updatedAt: new Date().toISOString()
                }
            ] : [];

            const response = await axios.post('/api/ai/chat', {
                message: inputValue.trim(),
                aptId: contextData?.aptId ? 
                    (typeof contextData.aptId === 'string' ? parseInt(contextData.aptId) : contextData.aptId) 
                    : null,
                aptData,
                memos,
                chatHistory,
                userId: user.uid
            });

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.reply,
                timestamp: new Date(),
                sources: response.data.sources || []
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('챗봇 오류:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            🤖 AI 챗봇
                        </h2>
                        {contextData && contextData.type !== 'general' && (
                            <p className="text-sm text-gray-600 mt-1">
                                {contextData.type === 'apartment' && contextData.aptName && 
                                    `현재 ${contextData.aptName}에 대해 질문하는 중입니다.`
                                }
                                {contextData.type === 'memo' && 
                                    '임장 메모를 바탕으로 답변해드리겠습니다.'
                                }
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                    message.role === 'user'
                                        ? 'bg-[#14e3dc] text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                </div>
                                <div className={`text-xs mt-1 opacity-70 ${
                                    message.role === 'user' ? 'text-white' : 'text-gray-500'
                                }`}>
                                    {formatTime(message.timestamp)}
                                </div>
                                
                                {/* 출처 표시 */}
                                {message.sources && message.sources.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="text-xs text-gray-500 mb-1">참고 자료:</div>
                                        {message.sources.map((source, index) => (
                                            <a
                                                key={index}
                                                href={source}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline block"
                                            >
                                                🔗 {source}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* 로딩 표시 */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 text-gray-800 max-w-[80%] p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#14e3dc]"></div>
                                    <span className="text-sm">답변을 생성하는 중...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* 입력 영역 */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="질문을 입력하세요..."
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#14e3dc] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !inputValue.trim()}
                            className={`px-6 py-2 rounded-lg transition-colors ${
                                isLoading || !inputValue.trim()
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#14e3dc] text-white hover:bg-[#12d4cc]'
                            }`}
                        >
                            {isLoading ? '전송 중...' : '전송'}
                        </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2 text-center">
                        AI가 생성한 답변은 참고용으로만 사용하시고, 중요한 결정은 전문가와 상담하세요.
                    </div>
                </div>
            </div>
        </div>
    );
}