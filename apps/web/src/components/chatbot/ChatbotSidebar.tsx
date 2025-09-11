import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import axios from "axios";
import { chatbotService } from "@/services/chatbotService";
import type { ChatMessage, ChatSession, ChatSessionType } from "@/types/chatbot";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useResizable } from "@/hooks/useResizable";

type ChatbotSidebarProps = {
    contextData?: {
        aptId?: number | string;
        aptName?: string;
        aptAddress?: string;
        memoContent?: string;
        type?: 'general' | 'apartment' | 'memo';
    };
};

export default function ChatbotSidebar({ contextData }: ChatbotSidebarProps) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [attachedApartment, setAttachedApartment] = useState<{ id: number; name: string; address: string; lat: number; lon: number } | null>(null);
    const [attachedImages, setAttachedImages] = useState<{ id: string; file: File; preview: string }[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 리사이즈 기능
    const { width, height, resizeHandle } = useResizable({
        initialWidth: 400, // 기본 사이드바 너비
        initialHeight: typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500,
        minWidth: 300,
        minHeight: 400,
        maxWidth: typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800,
        maxHeight: typeof window !== 'undefined' ? window.innerHeight * 0.9 : 800,
        direction: 'top-left' // 우측 하단 위치에서 좌측 상단으로 확장
    });

    // 메시지 자동 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 사이드바 열릴 때 입력창에 포커스
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (showDropdown && !target.closest('.dropdown-container')) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    // 사용자 프로필 정보 가져오기
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (isOpen && user) {
                try {
                    console.log('🔍 프로필 로드 시도 중... User UID:', user.uid);
                    const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'basic'));

                    if (profileDoc.exists()) {
                        const profileData = profileDoc.data();
                        setUserProfile(profileData);
                        console.log('✅ 사용자 프로필 로드됨:', profileData);
                    } else {
                        console.log('📝 사용자 프로필이 없음 - 온보딩이 완료되지 않았을 수 있습니다');

                        // 임시 테스트용 더미 데이터
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
                    }
                } catch (error) {
                    console.error('❌ 프로필 로드 오류:', error);
                    setUserProfile(null);
                }
            }
        };

        fetchUserProfile();
    }, [isOpen, user]);

    // 사이드바 열릴 때 초기 세팅
    useEffect(() => {
        if (isOpen && user) {
            initializeChatSession();
            loadChatHistory();
        } else if (!isOpen) {
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
                // contextData가 있는 경우: 타입이나 아파트ID가 다르면 새 세션
                (contextData && (
                    activeSession.type !== contextData.type ||
                    activeSession.contextData?.apartmentId !== contextData.aptId?.toString()
                )) ||
                // contextData가 없는 경우: 기존 세션이 아파트나 메모 타입이면 새 세션 생성
                (!contextData && (activeSession.type !== 'general' || activeSession.contextData?.apartmentId || activeSession.contextData?.memoContent));

            if (needNewSession) {
                const sessionType: ChatSessionType = contextData?.type || 'general';
                
                // contextData 정리 - undefined 값 제거
                let contextDataForSession: any = undefined;
                if (contextData) {
                    const cleanContextData: any = {};
                    if (contextData.aptId) cleanContextData.apartmentId = contextData.aptId.toString();
                    if (contextData.aptName) cleanContextData.apartmentName = contextData.aptName;
                    if (contextData.aptAddress) cleanContextData.apartmentAddress = contextData.aptAddress;
                    if (contextData.memoContent) cleanContextData.memoContent = contextData.memoContent;
                    
                    // 빈 객체가 아닐 때만 설정
                    if (Object.keys(cleanContextData).length > 0) {
                        contextDataForSession = cleanContextData;
                    }
                }

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

        // undefined 값을 제거하여 Firebase 오류 방지
        const message: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: welcomeMessage,
            timestamp: new Date()
        };

        // undefined 필드 제거
        Object.keys(message).forEach(key => {
            if ((message as any)[key] === undefined) {
                delete (message as any)[key];
            }
        });

        return message;
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

    // 새 대화 시작
    const startNewChat = async () => {
        if (!user) return;

        try {
            setIsLoadingHistory(true);

            // 강제로 새 세션 생성 (현재 contextData와 상관없이)
            const sessionType: ChatSessionType = contextData?.type || 'general';
            
            // contextData 정리 - undefined 값 제거
            let contextDataForSession: any = undefined;
            if (contextData) {
                const cleanContextData: any = {};
                if (contextData.aptId) cleanContextData.apartmentId = contextData.aptId.toString();
                if (contextData.aptName) cleanContextData.apartmentName = contextData.aptName;
                if (contextData.aptAddress) cleanContextData.apartmentAddress = contextData.aptAddress;
                if (contextData.memoContent) cleanContextData.memoContent = contextData.memoContent;
                
                // 빈 객체가 아닐 때만 설정
                if (Object.keys(cleanContextData).length > 0) {
                    contextDataForSession = cleanContextData;
                }
            }

            const sessionId = await chatbotService.createChatSession(user.uid, {
                type: sessionType,
                contextData: contextDataForSession,
                initialMessage: '새 대화'
            });

            const newSession = await chatbotService.getChatSession(user.uid, sessionId);

            if (newSession) {
                setCurrentSession(newSession);

                // 새 환영 메시지 생성 및 표시
                const welcomeMessage = createWelcomeMessage();
                setMessages([welcomeMessage]);

                // 환영 메시지를 Firebase에 저장
                await chatbotService.addMessage(user.uid, newSession.id, welcomeMessage);

                // 채팅 이력 새로고침
                await loadChatHistory();
            }
        } catch (error) {
            console.error('❌ 새 대화 시작 오류:', error);
            // 오류 시 기본 환영 메시지만 표시
            setMessages([createWelcomeMessage()]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // 현재 선택된 아파트 정보 첨부
    const attachCurrentApartment = () => {
        if (contextData?.aptId && contextData?.aptName) {
            setAttachedApartment({
                id: typeof contextData.aptId === 'string' ? parseInt(contextData.aptId) : contextData.aptId,
                name: contextData.aptName,
                address: contextData.aptAddress || '',
                lat: 0, // 실제 구현에서는 contextData에서 가져와야 함
                lon: 0
            });
            setShowDropdown(false);
        }
    };

    // 아파트 정보 첨부 해제
    const removeAttachedApartment = () => {
        setAttachedApartment(null);
    };

    // 사진 첨부 핸들러
    const handleImageAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newImages: { id: string; file: File; preview: string }[] = [];

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                const preview = URL.createObjectURL(file);
                newImages.push({ id, file, preview });
            }
        });

        setAttachedImages(prev => [...prev, ...newImages]);
        setShowDropdown(false);
    };

    // 사진 첨부 해제
    const removeAttachedImage = (imageId: string) => {
        setAttachedImages(prev => {
            const updated = prev.filter(img => img.id !== imageId);
            // 메모리 누수 방지를 위해 preview URL 해제
            const removedImage = prev.find(img => img.id === imageId);
            if (removedImage) {
                URL.revokeObjectURL(removedImage.preview);
            }
            return updated;
        });
    };

    // 파일을 base64로 변환하는 함수
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    // 메시지 전송
    const sendMessage = async () => {
        if ((!inputValue.trim() && attachedImages.length === 0) || isLoading || !currentSession) return;

        try {
            // 이미지를 base64로 변환
            const imageData = attachedImages.length > 0 ? await Promise.all(
                attachedImages.map(async (img) => ({
                    name: img.file.name,
                    type: img.file.type,
                    data: await fileToBase64(img.file)
                }))
            ) : undefined;

            // undefined 값을 제거하여 Firebase 오류 방지
            const userMessage: any = {
                id: Date.now().toString(),
                role: 'user',
                content: inputValue.trim() || '사진을 첨부했습니다.',
                timestamp: new Date()
            };

            // images가 있을 때만 추가
            if (imageData && imageData.length > 0) {
                userMessage.images = imageData;
            }

            // undefined 필드 제거
            Object.keys(userMessage).forEach(key => {
                if (userMessage[key] === undefined) {
                    delete userMessage[key];
                }
            });

            setMessages(prev => [...prev, userMessage]);
            setInputValue('');
            setIsLoading(true);

            // Firebase에 사용자 메시지 저장
            await chatbotService.addMessage(user.uid, currentSession.id, userMessage);

            const response = await axios.post('/api/ai/chat', {
                message: userMessage.content,
                images: userMessage.images,
                context: {
                    messages: messages.slice(-10).map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        images: (msg as any).images
                    })),
                    apartmentId: attachedApartment?.id || currentSession.contextData?.apartmentId,
                    apartmentName: attachedApartment?.name || currentSession.contextData?.apartmentName,
                    memoData: currentSession.contextData?.memoContent ? {
                        content: currentSession.contextData.memoContent,
                        createdAt: new Date().toISOString()
                    } : null,
                    userProfile,
                    userId: user.uid
                }
            }, {
                timeout: 90000 // 이미지 처리를 위해 타임아웃 연장
            });

            // undefined 값을 제거하여 Firebase 오류 방지
            const assistantMessage: any = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.data.reply || '답변을 생성하지 못했습니다.',
                timestamp: new Date()
            };

            // undefined 필드 제거
            Object.keys(assistantMessage).forEach(key => {
                if (assistantMessage[key] === undefined) {
                    delete assistantMessage[key];
                }
            });

            setMessages(prev => [...prev, assistantMessage]);

            // Firebase에 어시스턴트 메시지 저장
            await chatbotService.addMessage(user.uid, currentSession.id, assistantMessage);

            // 메시지 전송 후 첨부 정보 제거
            if (attachedApartment) {
                setAttachedApartment(null);
            }
            if (attachedImages.length > 0) {
                // 메모리 해제
                attachedImages.forEach(img => URL.revokeObjectURL(img.preview));
                setAttachedImages([]);
            }

        } catch (error) {
            console.error('임장봇 오류:', error);
            
            // undefined 값을 제거하여 Firebase 오류 방지
            const errorMessage: any = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                timestamp: new Date()
            };

            // undefined 필드 제거
            Object.keys(errorMessage).forEach(key => {
                if (errorMessage[key] === undefined) {
                    delete errorMessage[key];
                }
            });

            setMessages(prev => [...prev, errorMessage]);

            // 에러 메시지도 Firebase에 저장
            if (currentSession) {
                try {
                    await chatbotService.addMessage(user.uid, currentSession.id, errorMessage);
                } catch (fbError) {
                    console.error('Firebase 저장 오류:', fbError);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            console.log('⌨️ 엔터키 눌림', { inputValue, attachedImages: attachedImages.length, isLoading });
            sendMessage().catch(err => {
                console.error('메시지 전송 오류:', err);
                setIsLoading(false);
            });
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!user) return null;

    return (
        <>
            {/* 플로팅 버튼 */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 text-white p-4 rounded-full shadow-lg transition-all duration-300 z-50 flex items-center justify-center"
                style={{ backgroundColor: '#14E3DC' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#12D4CC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#14E3DC'}
                title="임장봇 열기"
            >
                <span className="text-2xl">🤖</span>
            </button>

            {/* 사이드바 - 최상위 레벨로 이동 */}
            {isOpen && (
                <div
                    className="fixed bottom-0 right-4 bg-white shadow-2xl rounded-t-xl transition-all duration-300 z-50 border border-gray-200"
                    style={{
                        width: `${width}px`,
                        height: `${height}px`
                    }}
                >
                    {/* 리사이즈 핸들 - 좌측 상단 */}
                    <div
                        className={`absolute top-0 left-0 w-6 h-6 cursor-nw-resize z-10 ${resizeHandle.isDragging ? 'bg-[#3D7D7B]' : 'bg-gray-300 hover:bg-[#14E3DC]'
                            } rounded-tl-xl opacity-60 hover:opacity-100 transition-all duration-200`}
                        onMouseDown={resizeHandle.onMouseDown}
                        title="크기 조절"
                    >
                        {/* 리사이즈 아이콘 */}
                        <div className="absolute top-1 left-1 text-white text-xs">
                            ⤡
                        </div>
                    </div>

                    <div className="h-full flex flex-col">
                        {/* 헤더 */}
                        <div className="px-4 py-3 border-b border-gray-200 bg-primary-50 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">🤖</span>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">임장봇</h2>
                                        {currentSession && (
                                            <p className="text-xs text-gray-600">
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
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setShowHistory(!showHistory)}
                                        className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-white rounded-lg transition-colors"
                                        title="대화 이력"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (user) {
                                                await startNewChat();
                                                setShowHistory(false);
                                            }
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-white rounded-lg transition-colors"
                                        title="새 대화 시작"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 메시지 영역 */}
                        <div className="flex-1 overflow-hidden flex">
                            {/* 대화 이력 사이드바 */}
                            {showHistory && (
                                <div className="w-1/3 border-r border-gray-200 p-3 overflow-y-auto">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-gray-800 text-sm">최근 대화</h3>
                                        <button
                                            onClick={() => setShowHistory(false)}
                                            className="text-gray-500 hover:text-gray-700 text-xs"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {isLoadingHistory ? (
                                        <div className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-primary-500"></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {chatSessions.length === 0 ? (
                                                <p className="text-xs text-gray-500 text-center py-4">
                                                    아직 대화 이력이 없습니다.
                                                </p>
                                            ) : (
                                                chatSessions.map((session) => (
                                                    <button
                                                        key={session.id}
                                                        onClick={() => loadPreviousSession(session.id)}
                                                        className={`w-full text-left p-2 rounded-lg transition-colors ${currentSession?.id === session.id
                                                            ? 'bg-primary-100 border border-primary-300'
                                                            : 'hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        <div className="font-medium text-xs text-gray-800 truncate">
                                                            {session.title}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {session.type === 'apartment' && '🏠 아파트'}
                                                            {session.type === 'memo' && '📝 임장메모'}
                                                            {session.type === 'general' && '💬 일반상담'}
                                                            {' • '}
                                                            {session.messageCount}개
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
                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] p-3 rounded-lg ${message.role === 'user'
                                                    ? 'bg-primary-500 text-white'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                <div className="text-sm leading-relaxed">
                                                    {/* 첨부된 이미지 표시 */}
                                                    {message.images && message.images.length > 0 && (
                                                        <div className="mb-2 grid grid-cols-2 gap-2">
                                                            {message.images.map((img, index) => (
                                                                <img
                                                                    key={index}
                                                                    src={img.data}
                                                                    alt={img.name}
                                                                    className="max-w-full h-auto rounded-lg border"
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {message.role === 'assistant' ? (
                                                        <div className="prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-em:text-inherit prose-code:text-inherit prose-pre:text-inherit prose-ul:text-inherit prose-ol:text-inherit prose-li:text-inherit prose-table:text-inherit prose-th:text-inherit prose-td:text-inherit">
                                                            <ReactMarkdown 
                                                                remarkPlugins={[remarkGfm]}
                                                                rehypePlugins={[rehypeRaw]}
                                                                components={{
                                                                    table: ({ node, ...props }) => (
                                                                        <div className="overflow-x-auto my-4">
                                                                            <table className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg" {...props} />
                                                                        </div>
                                                                    ),
                                                                    thead: ({ node, ...props }) => (
                                                                        <thead className="bg-gray-50" {...props} />
                                                                    ),
                                                                    tbody: ({ node, ...props }) => (
                                                                        <tbody className="bg-white divide-y divide-gray-200" {...props} />
                                                                    ),
                                                                    tr: ({ node, ...props }) => (
                                                                        <tr className="hover:bg-gray-50" {...props} />
                                                                    ),
                                                                    th: ({ node, ...props }) => (
                                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0" {...props} />
                                                                    ),
                                                                    td: ({ node, ...props }) => (
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 last:border-r-0" {...props} />
                                                                    ),
                                                                    code: ({ node, inline, ...props }) => (
                                                                        inline ? (
                                                                            <code className="px-1 py-0.5 bg-gray-100 text-red-600 rounded text-xs font-mono" {...props} />
                                                                        ) : (
                                                                            <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto my-2">
                                                                                <code className="text-sm font-mono" {...props} />
                                                                            </pre>
                                                                        )
                                                                    ),
                                                                    blockquote: ({ node, ...props }) => (
                                                                        <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2" {...props} />
                                                                    ),
                                                                    ul: ({ node, ...props }) => (
                                                                        <ul className="list-disc list-inside my-2 space-y-1" {...props} />
                                                                    ),
                                                                    ol: ({ node, ...props }) => (
                                                                        <ol className="list-decimal list-inside my-2 space-y-1" {...props} />
                                                                    ),
                                                                    li: ({ node, ...props }) => (
                                                                        <li className="ml-2" {...props} />
                                                                    ),
                                                                    h1: ({ node, ...props }) => (
                                                                        <h1 className="text-xl font-bold my-3" {...props} />
                                                                    ),
                                                                    h2: ({ node, ...props }) => (
                                                                        <h2 className="text-lg font-bold my-2" {...props} />
                                                                    ),
                                                                    h3: ({ node, ...props }) => (
                                                                        <h3 className="text-base font-bold my-2" {...props} />
                                                                    ),
                                                                    p: ({ node, ...props }) => (
                                                                        <p className="my-1" {...props} />
                                                                    ),
                                                                    strong: ({ node, ...props }) => (
                                                                        <strong className="font-semibold" {...props} />
                                                                    ),
                                                                    em: ({ node, ...props }) => (
                                                                        <em className="italic" {...props} />
                                                                    )
                                                                }}
                                                            >
                                                                {message.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                                    )}
                                                </div>
                                                <div className={`text-xs mt-1 opacity-70 ${message.role === 'user' ? 'text-white' : 'text-gray-500'
                                                    }`}>
                                                    {formatTime(message.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* 로딩 표시 */}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 text-gray-800 max-w-[85%] p-3 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary-500"></div>
                                                    <span className="text-sm">답변을 생성하는 중...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                        </div>

                        {/* 입력 영역 */}
                        <div className="p-3 border-t border-gray-200 bg-white rounded-b-xl">
                            {/* 첨부된 아파트 표시 */}
                            {attachedApartment && (
                                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-xs font-medium text-blue-800">@{attachedApartment.name}</span>
                                        </div>
                                        <button
                                            onClick={removeAttachedApartment}
                                            className="text-blue-400 hover:text-blue-600 p-1 text-xs"
                                            title="아파트 첨부 해제"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 첨부된 이미지들 표시 */}
                            {attachedImages.length > 0 && (
                                <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-xs font-medium text-green-800">첨부된 사진 ({attachedImages.length}장)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {attachedImages.map((image) => (
                                            <div key={image.id} className="relative">
                                                <img
                                                    src={image.preview}
                                                    alt="첨부 이미지"
                                                    className="w-16 h-16 object-cover rounded-lg border border-green-200"
                                                />
                                                <button
                                                    onClick={() => removeAttachedImage(image.id)}
                                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                                                    title="사진 제거"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <div className="relative dropdown-container">
                                    <button
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center justify-center"
                                        title="첨부 메뉴"
                                        disabled={isLoading}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>

                                    {/* 숨겨진 파일 입력 */}
                                    <input
                                        type="file"
                                        ref={(ref) => {
                                            (inputRef as any).imageInput = ref;
                                        }}
                                        onChange={handleImageAttachment}
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                    />

                                    {/* 드롭다운 메뉴 */}
                                    {showDropdown && (
                                        <div className="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-40 z-10">
                                            <button
                                                onClick={() => {
                                                    const imageInput = (inputRef as any).imageInput;
                                                    if (imageInput) {
                                                        imageInput.click();
                                                    }
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                사진 첨부
                                            </button>
                                            {contextData?.aptName && (
                                                <button
                                                    onClick={attachCurrentApartment}
                                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    {contextData.aptName} 정보 첨부
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="질문을 입력하세요..."
                                    disabled={isLoading}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('🚀 전송 버튼 클릭됨', { inputValue, attachedImages: attachedImages.length, isLoading });
                                        sendMessage().catch(err => {
                                            console.error('메시지 전송 오류:', err);
                                            setIsLoading(false);
                                        });
                                    }}
                                    disabled={isLoading || (!inputValue.trim() && attachedImages.length === 0)}
                                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${isLoading || (!inputValue.trim() && attachedImages.length === 0)
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-primary-500 text-white hover:bg-primary-600'
                                        }`}
                                    type="button"
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
            )}
        </>
    );
}