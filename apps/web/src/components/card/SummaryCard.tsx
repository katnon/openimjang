import { useState, useEffect } from "react";
import RealEstateDealsTable from "./RealEstateDealsTable";
import BuildingLandInfo from "./BuildingLandInfo";
import NearbyInfoPanel from "./NearbyInfoPanel";
import AiSummaryPanel from "./AiSummaryPanel";
import type { POIItem } from "@/types/poi";
import { useAuth } from "@/auth/AuthProvider";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

type PNUData = {
    pnu: string | null;
    error?: string;
};

type MemoPreview = {
    id: string;
    title: string;
    createdAt: Date;
    photoUrl?: string;
};

type SummaryCardProps = {
    point?: { lat: number; lng: number } | null;
    selectedApt?: {
        id: number;
        apt_nm: string;
        jibun_address: string;
        lat: number;
        lon: number;
    } | null;
    onMore?: () => void;
    onExpandChange?: (isExpanded: boolean) => void; // ✅ 확장 상태 변경 콜백 추가
    onPOIHover?: (poi: POIItem | null) => void; // POI 호버 콜백
    onFavoriteToggle?: (apt: { id: number; apt_nm: string; jibun_address: string; lat: number; lon: number }) => void; // 즐겨찾기 토글 콜백
    isFavorited?: boolean; // 즐겨찾기 상태
    onOpenChatbot?: (contextData: { aptId: number; aptName: string; aptAddress: string; type: 'apartment' }) => void; // 챗봇 열기 콜백
    onWriteMemo?: () => void; // 임장하기 (메모 작성) 콜백
    onOpenMyImjang?: () => void; // 내 임장 모달 열기 콜백
};

export default function SummaryCard({ point, selectedApt, onMore, onExpandChange, onPOIHover, onFavoriteToggle, isFavorited, onOpenChatbot, onWriteMemo, onOpenMyImjang }: SummaryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("실거래가");
    const [pnuData, setPnuData] = useState<PNUData | null>(null);
    const [isPnuLoading, setIsPnuLoading] = useState(false);
    const [aptMemos, setAptMemos] = useState<MemoPreview[]>([]);
    const [hasMoreMemos, setHasMoreMemos] = useState(false);
    const { user } = useAuth();

    // ✅ 확장 상태 변경 시 부모에게 알림
    useEffect(() => {
        onExpandChange?.(isExpanded);
    }, [isExpanded, onExpandChange]);

    // PNU 조회
    useEffect(() => {
        if (selectedApt?.id) {
            const fetchPNU = async () => {
                setIsPnuLoading(true);
                try {
                    const res = await fetch(`/api/search/pnu/${selectedApt.id}`);
                    const data = await res.json();
                    
                    if (res.ok) {
                        setPnuData(data);
                    } else {
                        setPnuData({ pnu: null, error: data.error || "PNU 조회 실패" });
                    }
                } catch (err) {
                    console.error("❌ PNU 조회 오류:", err);
                    setPnuData({ pnu: null, error: "네트워크 오류" });
                }
                setIsPnuLoading(false);
            };

            fetchPNU();
        } else {
            setPnuData(null);
        }
    }, [selectedApt?.id]);

    // 임장 메모 로딩
    useEffect(() => {
        const loadAptMemos = async () => {
            if (!user || !selectedApt) {
                setAptMemos([]);
                setHasMoreMemos(false);
                return;
            }

            try {
                const memosRef = collection(db, 'users', user.uid, 'memos');
                // 임시 해결책: 인덱스 없이 클라이언트에서 필터링
                const q = query(
                    memosRef,
                    orderBy('createdAt', 'desc'),
                    limit(20) // 더 많이 가져와서 클라이언트에서 필터링
                );
                
                const snapshot = await getDocs(q);
                const docs = snapshot.docs;
                
                // 클라이언트에서 아파트명으로 필터링
                const filteredDocs = docs.filter(doc => {
                    const data = doc.data();
                    return data.aptName === selectedApt.apt_nm;
                });
                
                setHasMoreMemos(filteredDocs.length >= 4);

                // 상위 3개만 상태에 저장
                const memosData = filteredDocs.slice(0, 3).map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: data.title || '(제목 없음)',
                        createdAt: data.createdAt?.toDate() || new Date(),
                        photoUrl: data.photoUrl || undefined
                    };
                });
                setAptMemos(memosData);
            } catch (error) {
                console.error('메모 불러오기 오류:', error);
                setAptMemos([]);
                setHasMoreMemos(false);
            }
        };

        loadAptMemos();
    }, [user, selectedApt]);

    const tabs = [
        { id: "실거래가", label: "실거래가" },
        { id: "건물/토지정보", label: "건물/토지정보" },
        { id: "주변정보", label: "주변정보" },
        { id: "AI스마트요약", label: "AI 스마트 요약" }
    ];

    const handleMoreClick = () => {
        if (selectedApt) {
            setIsExpanded(true);
            setActiveTab("실거래가");
        } else if (onMore) {
            onMore();
        }
    };

    const handleCloseExpanded = () => {
        setIsExpanded(false);
    };

    const handleFavoriteClick = () => {
        if (selectedApt && onFavoriteToggle) {
            onFavoriteToggle(selectedApt);
        }
    };

    const handleChatbotClick = () => {
        if (selectedApt && onOpenChatbot) {
            onOpenChatbot({
                aptId: selectedApt.id,
                aptName: selectedApt.apt_nm,
                aptAddress: selectedApt.jibun_address,
                type: 'apartment'
            });
        }
    };

    return (
        <div className={`absolute left-4 z-50 bg-white shadow-xl rounded-xl border border-gray-200 transition-all duration-300 ${isExpanded
                ? 'w-[29rem] h-[calc(100vh-8rem)] top-20' // ✅ 폭 20% 감소 (36rem→29rem), TopBar 아래 여유공간 확보 (top-4→top-20)
                : 'w-80 p-4 bottom-4'
            }`}>
            {!isExpanded ? (
                // ✅ 기본 상태 (축소형)
                <>
                    {selectedApt ? (
                        <>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-semibold text-gray-800">
                                                {selectedApt.apt_nm || "아파트명 없음"}
                                            </h2>
                                            <button
                                                onClick={handleFavoriteClick}
                                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                                title={isFavorited ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                            >
                                                <svg className="w-5 h-5" fill={isFavorited ? "#FCD34D" : "none"} stroke={isFavorited ? "#FCD34D" : "#6B7280"} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                </svg>
                                            </button>
                                            {onWriteMemo && (
                                                <button
                                                    onClick={onWriteMemo}
                                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                                    title="임장하기"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        {onOpenChatbot && (
                                            <button
                                                onClick={handleChatbotClick}
                                                className="px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                                                style={{ backgroundColor: '#14E3DC' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#12D4CC'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#14E3DC'}
                                                title="임장봇으로 질문하기"
                                            >
                                                🤖
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1 mb-2">
                                        <p className="text-sm text-gray-600">
                                            📍 {selectedApt.jibun_address || "주소 정보 없음"}
                                        </p>
                                        {isPnuLoading ? (
                                            <p className="text-xs text-gray-500">PNU: 조회 중...</p>
                                        ) : pnuData?.pnu ? (
                                            <p className="text-xs text-gray-600">PNU: {pnuData.pnu}</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 mb-3">
                                <p className="text-xs text-gray-500">
                                    위도: {selectedApt.lat?.toFixed(5) || "정보 없음"}
                                </p>
                                <p className="text-xs text-gray-500">
                                    경도: {selectedApt.lon?.toFixed(5) || "정보 없음"}
                                </p>
                            </div>

                            {/* 임장 메모 미리보기 */}
                            {aptMemos.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <strong className="text-sm text-gray-800">📝 내 임장 메모</strong>
                                        {hasMoreMemos && onOpenMyImjang && (
                                            <button 
                                                onClick={onOpenMyImjang} 
                                                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                전체 보기 →
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {aptMemos.map(memo => (
                                            <div key={memo.id} className="flex items-center gap-2 p-1">
                                                {memo.photoUrl && (
                                                    <img 
                                                        src={memo.photoUrl} 
                                                        alt="메모 사진" 
                                                        className="w-6 h-6 object-cover rounded border"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-800 truncate">
                                                        {memo.title}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {memo.createdAt.toLocaleDateString('ko-KR')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleMoreClick}
                                    className="flex-1 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                                >
                                    자세히 보기
                                </button>
                            </div>
                        </>
                    ) : point ? (
                        <>
                            <h2 className="text-lg font-semibold text-gray-800 mb-1">선택 지점</h2>
                            <p className="text-sm text-gray-600">
                                위도: {point.lat.toFixed(5)} / 경도: {point.lng.toFixed(5)}
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-lg font-semibold text-gray-800 mb-1">요약 카드</h2>
                            <p className="text-sm text-gray-600">
                                지도를 클릭하면 간단 요약을 표시합니다.
                            </p>
                        </>
                    )}
                </>
            ) : (
                // ✅ 확장 상태 (탭 구조)
                <div className="h-full flex flex-col">
                    {/* 헤더 */}
                    <div className="p-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {selectedApt?.apt_nm}
                                </h2>
                                <button
                                    onClick={handleFavoriteClick}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                    title={isFavorited ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                >
                                    <svg className="w-5 h-5" fill={isFavorited ? "#FCD34D" : "none"} stroke={isFavorited ? "#FCD34D" : "#6B7280"} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                </button>
                                {onWriteMemo && (
                                    <button
                                        onClick={onWriteMemo}
                                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        title="임장하기"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {onOpenChatbot && (
                                    <button
                                        onClick={handleChatbotClick}
                                        className="px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                                        style={{ backgroundColor: '#14E3DC' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#12D4CC'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#14E3DC'}
                                        title="임장봇으로 질문하기"
                                    >
                                        🤖 임장봇
                                    </button>
                                )}
                                <button
                                    onClick={handleCloseExpanded}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 mb-4">
                            <p className="text-sm text-gray-600">
                                📍 {selectedApt?.jibun_address}
                            </p>
                            {isPnuLoading ? (
                                <p className="text-xs text-gray-500">PNU: 조회 중...</p>
                            ) : pnuData?.pnu ? (
                                <p className="text-xs text-gray-600">PNU: {pnuData.pnu}</p>
                            ) : null}
                        </div>

                        {/* ✅ 탭 네비게이션 */}
                        <div className="flex border-b border-gray-200">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                            ? 'text-white bg-primary-500 rounded-t-lg border-b-2 border-primary-500'
                                            : 'text-gray-600 hover:text-gray-800 hover:bg-primary-50 rounded-t-lg'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ✅ 탭 콘텐츠 영역 */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === "실거래가" && selectedApt && (
                            <RealEstateDealsTable
                                aptId={selectedApt.id}
                                aptName={selectedApt.apt_nm}
                                onClose={() => { }}
                                isEmbedded={true}
                            />
                        )}
                        {activeTab === "건물/토지정보" && selectedApt && (
                            <BuildingLandInfo
                                aptId={selectedApt.id}
                                aptName={selectedApt.apt_nm}
                                lat={selectedApt.lat}
                                lon={selectedApt.lon}
                                jibunAddress={selectedApt.jibun_address}
                            />
                        )}
                        {activeTab === "주변정보" && selectedApt && (
                            <NearbyInfoPanel
                                lat={selectedApt.lat}
                                lon={selectedApt.lon}
                                aptName={selectedApt.apt_nm}
                                onPOIHover={onPOIHover}
                            />
                        )}
                        {activeTab === "AI스마트요약" && selectedApt && (
                            <AiSummaryPanel
                                aptId={selectedApt.id}
                                aptName={selectedApt.apt_nm}
                                lat={selectedApt.lat}
                                lon={selectedApt.lon}
                                jibunAddress={selectedApt.jibun_address}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
