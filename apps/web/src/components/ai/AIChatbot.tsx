import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import axios from "axios";

type AIChatbotProps = {
    isOpen: boolean;
    onClose: () => void;
    selectedApt: {
        id: number;
        apt_nm: string;
        jibun_address: string;
        lat: number;
        lon: number;
    } | null;
};

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

const AIChatbot: React.FC<AIChatbotProps> = ({ isOpen, onClose, selectedApt }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [memos, setMemos] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 메모 데이터 가져오기
    useEffect(() => {
        if (isOpen && selectedApt && user) {
            fetchMemos();
            // 초기 인사 메시지
            if (messages.length === 0) {
                setMessages([{
                    role: "assistant",
                    content: `안녕하세요! ${selectedApt.apt_nm}에 대해 궁금하신 점이 있으신가요? 실거래 정보, 시세 분석, 투자 조언 등 무엇이든 물어보세요.`,
                    timestamp: new Date()
                }]);
            }
        }
    }, [isOpen, selectedApt, user]);

    // 메시지 추가 시 스크롤 하단으로
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMemos = async () => {
        if (!user || !selectedApt) return;

        try {
            const memosRef = collection(db, 'users', user.uid, 'memos');
            const snapshot = await getDocs(memosRef);
            
            const userMemos = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.aptId === selectedApt.id.toString();
                })
                .map(doc => ({
                    id: doc.id,
                    title: doc.data().title,
                    body: doc.data().body,
                    updatedAt: doc.data().updatedAt?.toDate().toLocaleString('ko-KR') || '',
                }));

            setMemos(userMemos);
        } catch (error) {
            console.error('메모 가져오기 오류:', error);
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() || loading || !selectedApt) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: inputMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage("");
        setLoading(true);

        try {
            // 채팅 히스토리 준비 (최근 10개만)
            const chatHistory = messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const response = await axios.post('/api/ai/chat', {
                message: inputMessage,
                memos: memos,
                aptData: {
                    aptName: selectedApt.apt_nm,
                    address: selectedApt.jibun_address,
                    lat: selectedApt.lat,
                    lon: selectedApt.lon
                },
                aptId: selectedApt.id,
                chatHistory: chatHistory
            });

            if (response.data.success) {
                const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: response.data.reply,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (error: any) {
            console.error('채팅 오류:', error);
            const errorMessage: ChatMessage = {
                role: "assistant",
                content: "죄송합니다. 응답을 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([{
            role: "assistant",
            content: `대화를 초기화했습니다. ${selectedApt?.apt_nm}에 대해 궁금하신 점이 있으신가요?`,
            timestamp: new Date()
        }]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-2xl z-[9999] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <h3 className="font-bold">AI 임장 어시스턴트</h3>
                        {selectedApt && (
                            <p className="text-xs opacity-90">{selectedApt.apt_nm}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearChat}
                        className="p-1.5 hover:bg-white/20 rounded transition-colors"
                        title="대화 초기화"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/20 rounded transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                                msg.role === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="text-xs font-semibold">AI</span>
                                </div>
                            )}
                            <div className="whitespace-pre-wrap break-words text-sm">
                                {msg.content}
                            </div>
                            <div className={`text-xs mt-1 ${
                                msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                                {msg.timestamp.toLocaleTimeString('ko-KR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                                </div>
                                <span className="text-xs text-gray-500">AI가 답변 중...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 메모 정보 표시 */}
            {memos.length > 0 && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs text-blue-600">
                        💡 {memos.length}개의 임장 메모를 참고하여 답변합니다
                    </p>
                </div>
            )}

            {/* 입력 영역 */}
            <div className="border-t p-4">
                <div className="flex gap-2">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                        className="flex-1 p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={2}
                        disabled={loading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !inputMessage.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatbot;