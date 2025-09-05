import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import axios from "axios";
import { chatbotService } from "@/services/chatbotService";
import type { ChatMessage, ChatSession, ChatSessionType } from "@/types/chatbot";

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
    const [userProfile, setUserProfile] = useState<any>(null);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showApartmentSearch, setShowApartmentSearch] = useState(false);
    const [showMemoSearch, setShowMemoSearch] = useState(false);
    const [attachedApartment, setAttachedApartment] = useState<{id: number; name: string; address: string} | null>(null);
    const [attachedMemo, setAttachedMemo] = useState<{id: string; title: string; content: string} | null>(null);
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

    // 사용자 프로필 정보 가져오기
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (isOpen && user) {
                try {
                    console.log('🔍 프로필 로드 시도 중... User UID:', user.uid);
                    const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'basic'));
                    console.log('🔍 프로필 문서 존재 여부:', profileDoc.exists());
                    
                    if (profileDoc.exists()) {
                        const profileData = profileDoc.data();
                        setUserProfile(profileData);
                        console.log('✅ 사용자 프로필 로드됨:', profileData);
                        
                        // 전역에서 접근 가능하도록 설정 (디버깅용)
                        (window as any).userProfile = profileData;
                    } else {
                        console.log('📝 사용자 프로필이 없음 - 온보딩이 완료되지 않았을 수 있습니다');
                        
                        // 임시 테스트용 더미 데이터 (실제 온보딩 없이 테스트하기 위해)
                        const dummyProfile = {
                            purpose: ['매매', '투자'],
                            workLocation: '강남역',
                            commutingRadius: 30,
                            budgetRange: [500000000, 1000000000],
                            monthlyRent: [0, 0],
                            preferredBuildingAge: '10년 이내',
                            familyType: '신혼부부',
                            priorities: ['교통', '교육환경']
                        };
                        
                        console.log('🧪 테스트용 더미 프로필 사용:', dummyProfile);
                        setUserProfile(dummyProfile);
                        (window as any).userProfile = dummyProfile;
                    }
                } catch (error) {
                    console.error('❌ 프로필 로드 오류:', error);
                    setUserProfile(null);
                    (window as any).userProfile = null;
                }
            }
        };

        fetchUserProfile();
    }, [isOpen, user]);

    // 모달 열릴 때 초기 세팅
    useEffect(() => {
        if (isOpen && user) {
            initializeChatSession();
            loadChatHistory();
        } else if (!isOpen) {
            // 모달 닫힐 때 상태 초기화
            setCurrentSession(null);
            setMessages([]);
            setShowHistory(false);
        }
    }, [isOpen, user, contextData]);

    // 채팅 세션 초기화
    const initializeChatSession = async () => {
        if (!user) return;

        try {
            setIsLoadingHistory(true);
            
            // 활성 세션 확인
            let activeSession = await chatbotService.getActiveSession(user.uid);
            
            // 컨텍스트가 변경되었거나 활성 세션이 없으면 새 세션 생성
            const needNewSession = !activeSession || 
                (contextData && (
                    activeSession.type !== contextData.type ||
                    activeSession.contextData?.apartmentId !== contextData.aptId?.toString()
                ));

            if (needNewSession) {
                const sessionType: ChatSessionType = contextData?.type || 'general';
                const contextDataForSession = contextData ? {
                    apartmentId: contextData.aptId?.toString(),
                    apartmentName: contextData.aptName,
                    apartmentAddress: contextData.aptAddress,
                    memoContent: contextData.memoContent
                } : undefined;

                const sessionId = await chatbotService.createChatSession(user.uid, {
                    type: sessionType,
                    contextData: contextDataForSession,
                    initialMessage: '새 대화'
                });

                activeSession = await chatbotService.getChatSession(user.uid, sessionId);
            }

            if (activeSession) {
                setCurrentSession(activeSession);
                
                // 기존 메시지가 있으면 로드, 없으면 환영 메시지 추가
                if (activeSession.messages.length > 0) {
                    setMessages(activeSession.messages);
                } else {
                    const welcomeMessage = createWelcomeMessage();
                    setMessages([welcomeMessage]);
                    
                    // 환영 메시지를 Firebase에 저장
                    await chatbotService.addMessage(user.uid, activeSession.id, welcomeMessage);
                }
            }
        } catch (error) {
            console.error('❌ 채팅 세션 초기화 오류:', error);
            // 오류 시 기본 환영 메시지만 표시
            setMessages([createWelcomeMessage()]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // 환영 메시지 생성
    const createWelcomeMessage = (): ChatMessage => {
        let welcomeMessage = '';
        switch (contextData?.type) {
            case 'apartment':
                welcomeMessage = `${contextData.aptName}에 대해 궁금한 것이 있으시면 언제든 물어보세요! 실거래가, 교통, 생활편의시설 등 다양한 정보를 제공해드릴 수 있습니다.`;
                break;
            case 'memo':
                welcomeMessage = `작성하신 임장 메모를 바탕으로 추가 질문에 답변해드리겠습니다. 궁금한 점이 있으시면 언제든 물어보세요!`;
                break;
            default:
                welcomeMessage = `안녕하세요! OpenImjang 임장봇입니다. 부동산 관련 궁금한 점이 있으시면 언제든 물어보세요.`;
        }

        return {
            id: Date.now().toString(),
            role: 'assistant',
            content: welcomeMessage,
            timestamp: new Date()
        };
    };

    // 채팅 이력 로드
    const loadChatHistory = async () => {
        if (!user) return;

        try {
            const sessions = await chatbotService.getChatSessions(user.uid, 10);
            setChatSessions(sessions);
        } catch (error) {
            console.error('❌ 채팅 이력 로드 오류:', error);
        }
    };

    // 이전 세션 로드
    const loadPreviousSession = async (sessionId: string) => {
        if (!user) return;

        try {
            setIsLoadingHistory(true);
            
            // 세션 활성화
            await chatbotService.activateSession(user.uid, sessionId);
            
            // 세션 데이터 로드
            const session = await chatbotService.getChatSession(user.uid, sessionId);
            if (session) {
                setCurrentSession(session);
                setMessages(session.messages);
                setShowHistory(false);
            }
        } catch (error) {
            console.error('❌ 이전 세션 로드 오류:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // 아파트 첨부 관련 함수들
    const handleAttachApartment = (apartment: {id: number; apt_nm: string; jibun_address: string}) => {
        setAttachedApartment({
            id: apartment.id,
            name: apartment.apt_nm,
            address: apartment.jibun_address
        });
        setShowApartmentSearch(false);
    };

    const removeAttachedApartment = () => {
        setAttachedApartment(null);
    };

    const handleAttachMemo = (memo: {id: string; title: string; body: string}) => {
        setAttachedMemo({
            id: memo.id,
            title: memo.title,
            content: memo.body
        });
        setShowMemoSearch(false);
    };

    const removeAttachedMemo = () => {
        setAttachedMemo(null);
    };

    if (!isOpen || !user) return null;

    const sendMessage = async () => {
        if (!inputValue.trim() || isLoading || !currentSession) return;

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
            // Firebase에 사용자 메시지 저장
            await chatbotService.addMessage(user.uid, currentSession.id, userMessage);

            // 새로운 /api/ai/chat-with-data 엔드포인트 사용
            console.log('🔍 임장봇 요청 전송 데이터:', {
                message: userMessage.content,
                apartmentId: currentSession.contextData?.apartmentId,
                memoData: currentSession.contextData?.memoContent ? {
                    content: currentSession.contextData.memoContent,
                    createdAt: new Date().toISOString()
                } : null,
                hasUserProfile: !!userProfile,
                chatHistory: messages.slice(-10).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            });

            const response = await axios.post('/api/ai/chat-with-data', {
                message: userMessage.content,
                apartmentId: attachedApartment?.id || currentSession.contextData?.apartmentId,
                memoData: attachedMemo ? {
                    content: `${attachedMemo.title}\n${attachedMemo.content}`,
                    createdAt: new Date().toISOString()
                } : currentSession.contextData?.memoContent ? {
                    content: currentSession.contextData.memoContent,
                    createdAt: new Date().toISOString(),
                    photos: currentSession.contextData.memoPhotos || []
                } : null,
                chatHistory: messages.slice(-10).map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                userProfile,
                userId: user.uid
            });

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.reply,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
            
            // Firebase에 어시스턴트 메시지 저장
            await chatbotService.addMessage(user.uid, currentSession.id, assistantMessage);
            
            // 메시지 전송 후 첨부 제거
            if (attachedApartment) {
                setAttachedApartment(null);
            }
            if (attachedMemo) {
                setAttachedMemo(null);
            }

        } catch (error) {
            console.error('임장봇 오류:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            
            // 에러 메시지도 Firebase에 저장
            await chatbotService.addMessage(user.uid, currentSession.id, errorMessage);
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
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                🏠 임장봇
                            </h2>
                            {currentSession && (
                                <p className="text-sm text-gray-600 mt-1">
                                    {currentSession.type === 'apartment' && currentSession.contextData?.apartmentName && 
                                        `${currentSession.contextData.apartmentName} 관련 대화`
                                    }
                                    {currentSession.type === 'memo' && 
                                        '임장 메모 분석 대화'
                                    }
                                    {currentSession.type === 'general' && 
                                        '일반 상담 대화'
                                    }
                                </p>
                            )}
                        </div>
                        
                        {/* 대화 관리 버튼들 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                title="대화 이력"
                            >
                                📚
                            </button>
                            <button
                                onClick={async () => {
                                    if (user) {
                                        await initializeChatSession();
                                        setShowHistory(false);
                                    }
                                }}
                                className="p-2 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                title="새 대화 시작"
                            >
                                ➕
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-hidden flex">
                    {/* 대화 이력 사이드바 */}
                    {showHistory && (
                        <div className="w-1/3 border-r border-gray-200 p-4 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-800">최근 대화</h3>
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {isLoadingHistory ? (
                                <div className="flex justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-primary-500"></div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {chatSessions.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            아직 대화 이력이 없습니다.
                                        </p>
                                    ) : (
                                        chatSessions.map((session) => (
                                            <button
                                                key={session.id}
                                                onClick={() => loadPreviousSession(session.id)}
                                                className={`w-full text-left p-3 rounded-lg transition-colors ${
                                                    currentSession?.id === session.id
                                                        ? 'bg-primary-100 border border-primary-300'
                                                        : 'hover:bg-gray-100'
                                                }`}
                                            >
                                                <div className="font-medium text-sm text-gray-800 truncate">
                                                    {session.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {session.type === 'apartment' && '🏠 아파트'}
                                                    {session.type === 'memo' && '📝 임장메모'}
                                                    {session.type === 'general' && '💬 일반상담'}
                                                    {' • '}
                                                    {session.messageCount}개 메시지
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {session.updatedAt.toLocaleDateString('ko-KR')}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* 메인 채팅 영역 */}
                    <div className={`${showHistory ? 'w-2/3' : 'w-full'} flex flex-col`}>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                    message.role === 'user'
                                        ? 'bg-primary-500 text-white'
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
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary-500"></div>
                                    <span className="text-sm">답변을 생성하는 중...</span>
                                </div>
                            </div>
                        </div>
                    )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* 입력 영역 */}
                        <div className="p-4 border-t border-gray-200">
                            {/* 첨부된 아파트 표시 */}
                            {attachedApartment && (
                                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-sm font-medium text-blue-800">첨부된 아파트:</span>
                                            <span className="text-sm text-blue-700">{attachedApartment.name}</span>
                                        </div>
                                        <button
                                            onClick={removeAttachedApartment}
                                            className="text-blue-400 hover:text-blue-600 p-1"
                                            title="아파트 첨부 해제"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1 pl-4">{attachedApartment.address}</div>
                                </div>
                            )}
                            
                            {/* 첨부된 메모 표시 */}
                            {attachedMemo && (
                                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <span className="text-sm font-medium text-green-800">첨부된 메모:</span>
                                            <span className="text-sm text-green-700">{attachedMemo.title}</span>
                                        </div>
                                        <button
                                            onClick={removeAttachedMemo}
                                            className="text-green-400 hover:text-green-600 p-1"
                                            title="메모 첨부 해제"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="text-xs text-green-600 mt-1 pl-4 line-clamp-2">{attachedMemo.content}</div>
                                </div>
                            )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowApartmentSearch(true)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center justify-center"
                            title="아파트 첨부하기"
                            disabled={isLoading}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setShowMemoSearch(true)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center justify-center"
                            title="메모 첨부하기"
                            disabled={isLoading}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="질문을 입력하세요..."
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !inputValue.trim()}
                            className={`px-6 py-2 rounded-lg transition-colors ${
                                isLoading || !inputValue.trim()
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-primary-500 text-white hover:bg-primary-600'
                            }`}
                        >
                            {isLoading ? '전송 중...' : '전송'}
                        </button>
                    </div>
                    
                            <div className="text-xs text-gray-500 mt-2 text-center">
                                임장봇이 생성한 답변은 참고용으로만 사용하시고, 중요한 결정은 전문가와 상담하세요.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 아파트 검색 모달 */}
            {showApartmentSearch && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <ApartmentSearchModal
                        onClose={() => setShowApartmentSearch(false)}
                        onSelectApartment={handleAttachApartment}
                    />
                </div>
            )}

            {/* 메모 검색 모달 */}
            {showMemoSearch && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <MemoSearchModal
                        onClose={() => setShowMemoSearch(false)}
                        onSelectMemo={handleAttachMemo}
                        userId={user.uid}
                    />
                </div>
            )}
        </div>
    );
}

// 아파트 검색 모달 컴포넌트
function ApartmentSearchModal({ 
    onClose, 
    onSelectApartment 
}: { 
    onClose: () => void; 
    onSelectApartment: (apt: {id: number; apt_nm: string; jibun_address: string}) => void; 
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const searchApartments = async () => {
        if (!query.trim()) return;
        
        setLoading(true);
        try {
            const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
            setResults(response.data.slice(0, 10));
        } catch (error) {
            console.error('아파트 검색 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            searchApartments();
        }
    };

    return (
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">아파트 검색</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="아파트명 또는 주소를 입력하세요"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                    />
                    <button
                        onClick={searchApartments}
                        disabled={loading || !query.trim()}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            loading || !query.trim()
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-primary-500 text-white hover:bg-primary-600'
                        }`}
                    >
                        {loading ? '검색 중...' : '검색'}
                    </button>
                </div>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
                {results.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        아파트를 검색하여 첨부하세요
                    </div>
                ) : (
                    <div className="space-y-2">
                        {results.map((apt) => (
                            <button
                                key={apt.id}
                                onClick={() => onSelectApartment(apt)}
                                className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                            >
                                <div className="font-medium text-gray-800">{apt.apt_nm}</div>
                                <div className="text-sm text-gray-600 mt-1">{apt.jibun_address}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// 메모 검색 모달 컴포넌트
function MemoSearchModal({ 
    onClose, 
    onSelectMemo,
    userId
}: { 
    onClose: () => void; 
    onSelectMemo: (memo: {id: string; title: string; body: string}) => void;
    userId: string;
}) {
    const [memos, setMemos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMemos();
    }, []);

    const loadMemos = async () => {
        setLoading(true);
        try {
            const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
            const { db } = await import('@/firebase');
            
            const memosRef = collection(db, 'users', userId, 'memos');
            const q = query(memosRef, orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);

            const memosData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            }));

            setMemos(memosData);
        } catch (error) {
            console.error('메모 로드 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">임장 메모 선택</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
                        <span className="ml-2 text-gray-600">메모를 불러오는 중...</span>
                    </div>
                ) : memos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        아직 작성된 임장 메모가 없습니다
                    </div>
                ) : (
                    <div className="space-y-2">
                        {memos.map((memo) => (
                            <button
                                key={memo.id}
                                onClick={() => onSelectMemo(memo)}
                                className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                            >
                                <div className="font-medium text-gray-800 mb-1">{memo.title}</div>
                                {memo.aptName && (
                                    <div className="text-xs text-blue-600 mb-1">🏠 {memo.aptName}</div>
                                )}
                                <div className="text-sm text-gray-600 line-clamp-2 mb-2">{memo.body}</div>
                                <div className="text-xs text-gray-500">
                                    {memo.updatedAt.toLocaleDateString('ko-KR')}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}