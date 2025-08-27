import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

type TopBarProps = {
    onOpen3D?: () => void;
    onSearchResult?: (results: AptInfo[]) => void;
};

export type AptInfo = {
    id: number;
    apt_nm: string;
    // ❌ apt_dong: string | null; 제거 (칼럼 삭제됨)
    jibun_address: string;
    lon: number;
    lat: number;
};

const TopBar: React.FC<TopBarProps> = ({ onOpen3D, onSearchResult }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<AptInfo[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

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
                        <div className="w-8 h-8 bg-teal-500 rounded-lg items-center justify-center hidden">
                            <span className="text-white font-bold text-sm">OI</span>
                        </div>
                        <span className="font-bold text-xl text-gray-800">OpenImjang</span>
                    </div>

                    {/* 검색창 */}
                    <div className="relative w-96">
                        <input
                            type="text"
                            placeholder="주소나 아파트 이름을 입력하세요"
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            onFocus={() => suggestions.length && setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        />
                        <button
                            onClick={handleSubmit}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500"
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
                <div className="flex items-center">
                    <button
                        onClick={onOpen3D}
                        className="px-4 py-2 text-sm font-medium border border-blue-400 text-blue-600 hover:bg-blue-600 hover:text-white rounded-l-lg transition-colors"
                    >
                        3D지도 보기
                    </button>
                    <button className="px-4 py-2 text-sm font-medium border-t border-b border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
                        프로필
                    </button>
                    <button className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-r-lg transition-colors">
                        설정
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
