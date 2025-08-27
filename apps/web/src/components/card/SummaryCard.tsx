import React, { useState, useEffect } from "react";
import RealEstateDealsTable from "./RealEstateDealsTable";

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
};

export default function SummaryCard({ point, selectedApt, onMore, onExpandChange }: SummaryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("실거래가");

    // ✅ 확장 상태 변경 시 부모에게 알림
    useEffect(() => {
        onExpandChange?.(isExpanded);
    }, [isExpanded, onExpandChange]);

    const tabs = [
        { id: "실거래가", label: "실거래가", icon: "💰" }
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
                                    <h2 className="text-lg font-semibold text-gray-800 mb-1">
                                        {selectedApt.apt_nm || "아파트명 없음"}
                                    </h2>
                                    <p className="text-sm text-gray-600 mb-2">
                                        📍 {selectedApt.jibun_address || "주소 정보 없음"}
                                    </p>
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

                            <button
                                onClick={handleMoreClick}
                                className="w-full mt-3 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                실거래가 보기
                            </button>
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
                            <h2 className="text-xl font-bold text-gray-800">
                                {selectedApt?.apt_nm}
                            </h2>
                            <button
                                onClick={handleCloseExpanded}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            📍 {selectedApt?.jibun_address}
                        </p>

                        {/* ✅ 탭 네비게이션 */}
                        <div className="flex border-b border-gray-200">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <span>{tab.icon}</span>
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
                    </div>
                </div>
            )}
        </div>
    );
}
