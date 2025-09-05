import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/auth/AuthProvider";

type TopBarProps = {
    onOpen3D?: () => void;
    onSearchResult?: (results: AptInfo[]) => void;
    onOpenAuth?: () => void;
    onOpenMyImjang?: () => void;
    onOpenProfile?: () => void;
    onOpenChatbot?: () => void;
};

export type AptInfo = {
    id: number;
    apt_nm: string;
    // ❌ apt_dong: string | null; 제거 (칼럼 삭제됨)
    jibun_address: string;
    lon: number;
    lat: number;
};

const TopBar: React.FC<TopBarProps> = ({ onOpen3D, onSearchResult, onOpenAuth, onOpenMyImjang, onOpenProfile, onOpenChatbot }) => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<AptInfo[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (query.length < 1) {
                setSuggestions([]);
                setShowDropdown(false);
                return;
            }

            axios
                .get(`/api/search?q=${encodeURIComponent(query)}`)
                .then((res) => {
                    setSuggestions(res.data.slice(0, 10));
                    setShowDropdown(res.data.length > 0);
                })
                .catch((err) => {
                    console.error("❌ 검색 요청 실패:", err);
                    setSuggestions([]);
                    setShowDropdown(false);
                });
        }, 200);
        return () => clearTimeout(delayDebounce);
    }, [query]);

    // 사용자 메뉴 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            // 로그아웃 버튼이 아닌 경우에만 메뉴 닫기
            if (showUserMenu && !target.closest('.user-menu-dropdown')) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUserMenu]);

    const handleSubmit = async () => {
        if (!query.trim()) return;

        try {
            const res = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
            // ❌ apt_dong 필터링 제거 (칼럼 삭제됨)
            const list = res.data;

            if (list.length > 0) {
                console.log("🔍 검색 결과 선택:", list[0]);
                setQuery(`${list[0].apt_nm}`);
                setShowDropdown(false);
                onSearchResult?.([list[0]]);
            } else {
                console.log("❌ 검색 결과 없음");
            }
        } catch (e) {
            console.error("❌ 검색 제출 실패:", e);
        }
    };

    const handleSelectApt = (apt: AptInfo) => {
        console.log("🏠 아파트 선택:", apt);
        setQuery(`${apt.apt_nm}`);
        setShowDropdown(false);
        onSearchResult?.([apt]);
    };

    const handleSignOut = async () => {
        console.log('🔄 로그아웃 버튼 클릭됨');
        
        if (isLoggingOut) {
            console.log('⚠️ 이미 로그아웃 처리 중');
            return;
        }

        try {
            console.log('🔄 로그아웃 시작');
            setIsLoggingOut(true);
            setShowUserMenu(false);
            
            await signOut();
            console.log('✅ 로그아웃 성공');
        } catch (error) {
            console.error('❌ 로그아웃 오류:', error);
            alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoggingOut(false);
            console.log('🔄 로그아웃 처리 완료');
        }
    };

    return (
        <header className="bg-white shadow-sm border-b border-gray-200 h-16 px-6">
            <div className="flex items-center justify-between h-full">

                {/* 왼쪽 박스: 로고 + 브랜드명 + 검색창 */}
                <div className="flex items-center gap-6">
                    {/* 로고 + 브랜드명 */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/icon-192.png"
                            alt="OpenImjang 로고"
                            className="w-8 h-8"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div className="w-8 h-8 bg-primary-500 rounded-lg items-center justify-center hidden">
                            <span className="text-white font-bold text-sm">OI</span>
                        </div>
                        <span className="font-bold text-xl text-gray-800">OpenImjang</span>
                    </div>

                    {/* 검색창 */}
                    <div className="relative w-96">
                        <input
                            type="text"
                            placeholder="주소나 아파트 이름을 입력하세요"
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            onFocus={() => suggestions.length && setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        />
                        <button
                            onClick={handleSubmit}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary-500"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>

                        {/* 검색 드롭다운 */}
                        {showDropdown && suggestions.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                                {suggestions.map((apt) => (
                                    <li
                                        key={apt.id}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                        onClick={() => handleSelectApt(apt)}
                                    >
                                        <div className="font-medium text-gray-800">{apt.apt_nm}</div>
                                        <div className="text-xs text-gray-500 mt-1">{apt.jibun_address}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* 오른쪽 박스: 버튼들 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpen3D}
                        className="px-4 py-2 text-sm font-medium border border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white rounded-lg transition-colors"
                    >
                        3D지도 보기
                    </button>
                    
                    {user && onOpenMyImjang && (
                        <button
                            onClick={onOpenMyImjang}
                            className="px-4 py-2 text-sm font-medium border border-secondary-500 text-secondary-600 hover:bg-secondary-500 hover:text-white rounded-lg transition-colors"
                        >
                            내 임장
                        </button>
                    )}
                    
                    {user && onOpenChatbot && (
                        <button
                            onClick={onOpenChatbot}
                            className="px-4 py-2 text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
                        >
                            🏠 임장봇
                        </button>
                    )}
                    
                    {user ? (
                        /* 로그인된 상태 */
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="프로필 사진"
                                        className="w-6 h-6 rounded-full object-cover"
                                        onError={(e) => {
                                            // 프로필 사진 로드 실패 시 이니셜로 대체
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback = target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div 
                                    className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
                                    style={{ display: user.photoURL ? 'none' : 'flex' }}
                                >
                                    <span className="text-white text-xs font-bold">
                                        {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <span>{user.displayName || user.email?.split('@')[0]}</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            {showUserMenu && (
                                <div className="user-menu-dropdown absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            onOpenProfile?.();
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                                    >
                                        프로필
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            // TODO: 설정 페이지로 이동
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        설정
                                    </button>
                                    <hr className="my-1" />
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('🔄 로그아웃 버튼 직접 클릭됨');
                                            handleSignOut();
                                        }}
                                        disabled={isLoggingOut}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {isLoggingOut ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                로그아웃 중...
                                            </>
                                        ) : (
                                            '로그아웃'
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 로그인되지 않은 상태 */
                        <button
                            onClick={onOpenAuth}
                            className="px-4 py-2 text-sm font-medium border border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white rounded-lg transition-colors"
                        >
                            로그인
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
