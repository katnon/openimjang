import React, { useState, useEffect } from "react";

type Deal = {
    deal_year: number;
    deal_month: number;
    deal_day: number;
    deal_amount: number | null;
    deposit: number | null;
    monthly_rent: number | null;
    exclu_use_ar: number;
    floor: number | null;
    apt_dong: string | null; // 🆕 동 정보 추가
};

type Props = {
    aptId: number;
    aptName: string;
    onClose: () => void;
    isEmbedded?: boolean;
};

export default function RealEstateDealsTable({ aptId, aptName, onClose, isEmbedded = false }: Props) {
    const [allDeals, setAllDeals] = useState<Deal[]>([]);           // ✅ 전체 데이터
    const [displayedDeals, setDisplayedDeals] = useState<Deal[]>([]); // ✅ 화면에 표시할 데이터
    const [areas, setAreas] = useState<number[]>([]);
    const [selectedDealTypes, setSelectedDealTypes] = useState<string[]>(["매매", "전세", "월세"]);
    const [selectedArea, setSelectedArea] = useState<string>("전체");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("1년");
    const [useAreaRange, setUseAreaRange] = useState<boolean>(false); // 🆕 ±1m² 토글
    const [isLoading, setIsLoading] = useState(true);

    // ✅ 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const ITEMS_PER_PAGE = 20;

    const dealTypes = ["매매", "전세", "월세"];
    const periods = ["3개월", "6개월", "1년", "3년", "전체"];

    // 전용면적 목록 조회
    useEffect(() => {
        const fetchAreas = async () => {
            try {
                const res = await fetch(`/api/search/areas/${aptId}`);
                const areasData = await res.json();
                setAreas(areasData);
            } catch (err) {
                console.error("전용면적 조회 실패:", err);
            }
        };
        fetchAreas();
    }, [aptId]);

    // ✅ 실거래가 데이터 조회 부분만 수정 (fetchDeals 함수)

    // 실거래가 데이터 조회
    useEffect(() => {
        const fetchDeals = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedArea !== "전체") {
                    params.append("area", selectedArea);
                    if (useAreaRange) params.append("useRange", "true"); // 🆕 ±1m² 토글 파라미터
                }
                params.append("period", selectedPeriod);

                console.log(`🔍 선택된 기간: "${selectedPeriod}"`);
                console.log(`🔍 API 호출: /api/search/deals/${aptId}?${params}`);
                console.log(`🔍 전체 파라미터: area=${selectedArea}, period=${selectedPeriod}, dealTypes=${selectedDealTypes.join(',')}`);

                const res = await fetch(`/api/search/deals/${aptId}?${params}`);
                const dealsData = await res.json();

                console.log(`📬 API 응답 상태: ${res.status}`);
                console.log(`📬 백엔드 응답:`, dealsData);
                console.log(`📬 데이터 타입:`, typeof dealsData, Array.isArray(dealsData));
                
                if (!res.ok) {
                    console.error(`❌ API 에러: ${res.status}`, dealsData);
                    setAllDeals([]);
                    return;
                }
                
                if (!Array.isArray(dealsData)) {
                    console.error(`❌ 예상과 다른 데이터 형식:`, dealsData);
                    setAllDeals([]);
                    return;
                }

                console.log(`📥 백엔드에서 받은 원시 데이터: ${dealsData.length}건`);

                // 클라이언트에서 거래유형 필터링
                const filteredDeals = dealsData.filter((deal: Deal) => {
                    const dealType = getDealType(deal);
                    return selectedDealTypes.includes(dealType);
                });

                console.log(`🔧 클라이언트 필터링 후: ${filteredDeals.length}건`);
                console.log(`📊 선택된 거래유형: ${selectedDealTypes.join(', ')}`);

                setAllDeals(filteredDeals);
                setCurrentPage(1); // 페이지 리셋

            } catch (err) {
                console.error("❌ 실거래가 조회 실패:", err);
            }
            setIsLoading(false);
        };
        fetchDeals();
    }, [aptId, selectedDealTypes, selectedArea, selectedPeriod, useAreaRange]);

    // ✅ 표시할 데이터 계산 로그 강화
    useEffect(() => {
        const startIndex = 0;
        const endIndex = currentPage * ITEMS_PER_PAGE;
        const newDisplayedDeals = allDeals.slice(startIndex, endIndex);

        setDisplayedDeals(newDisplayedDeals);
        setHasMore(endIndex < allDeals.length);

        console.log(`📄 페이지네이션 상태:`);
        console.log(`   - 전체 데이터: ${allDeals.length}건`);
        console.log(`   - 현재 페이지: ${currentPage}`);
        console.log(`   - 표시 중: ${newDisplayedDeals.length}건 (0 ~ ${endIndex})`);
        console.log(`   - 더보기 가능: ${hasMore} (${allDeals.length - endIndex}건 남음)`);
    }, [allDeals, currentPage]);

    // ✅ 더보기 버튼 클릭
    const handleLoadMore = () => {
        setCurrentPage(prev => prev + 1);
    };

    // 거래유형 토글 핸들러
    const toggleDealType = (type: string) => {
        setSelectedDealTypes(prev => {
            if (prev.includes(type)) {
                return prev.length > 1 ? prev.filter(t => t !== type) : prev;
            } else {
                return [...prev, type];
            }
        });
    };

    // 거래 유형 판단
    const getDealType = (deal: Deal): string => {
        if (deal.deal_amount !== null) return "매매";
        if (deal.deposit !== null && deal.monthly_rent !== null) {
            return deal.monthly_rent === 0 ? "전세" : "월세";
        }
        return "기타";
    };

    // 거래유형별 색상 클래스
    const getDealTypeColorClass = (dealType: string): string => {
        switch (dealType) {
            case "매매": return "bg-red-100 text-red-800 border-red-200";
            case "전세": return "bg-blue-100 text-blue-800 border-blue-200";
            case "월세": return "bg-green-100 text-green-800 border-green-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // 정확한 가격 포맷팅
    const formatPrice = (deal: Deal): string => {
        if (deal.deal_amount !== null) {
            const eok = Math.floor(deal.deal_amount / 10000);
            const man = deal.deal_amount % 10000;

            if (eok > 0 && man > 0) {
                return `${eok}억 ${man}만`;
            } else if (eok > 0) {
                return `${eok}억`;
            } else {
                return `${man}만`;
            }
        } else {
            const deposit = deal.deposit || 0;
            const eok = Math.floor(deposit / 10000);
            const man = deposit % 10000;

            let depositStr = "";
            if (eok > 0 && man > 0) {
                depositStr = `${eok}억 ${man}만`;
            } else if (eok > 0) {
                depositStr = `${eok}억`;
            } else if (man > 0) {
                depositStr = `${man}만`;
            } else {
                depositStr = "0";
            }

            const rent = deal.monthly_rent && deal.monthly_rent > 0 ? `/${deal.monthly_rent}만` : "";
            return `${depositStr}${rent}`;
        }
    };

    // 거래일 포맷팅
    const formatDate = (deal: Deal): string => {
        const year = deal.deal_year;
        const month = String(deal.deal_month).padStart(2, '0');
        const day = String(deal.deal_day).padStart(2, '0');
        return `${year}.${month}.${day}`;
    };

    // 🆕 동 표시 포맷팅 (매매가만 표시, "동" 제거)
    const formatDong = (deal: Deal): string => {
        // 매매가가 있는 경우에만 동 표시
        if (deal.deal_amount !== null && deal.apt_dong) {
            // "101동" → "101" (끝의 "동" 제거)
            return deal.apt_dong.replace(/동$/, '');
        }
        return "-"; // 전월세는 빈칸
    };

    // ✅ 컨텐츠 렌더링
    const content = (
        <>
            {/* 필터 컨트롤 */}
            <div className={`${isEmbedded ? 'p-4' : 'p-6'} border-b border-gray-200 flex-shrink-0`}>
                {!isEmbedded && (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800">{aptName} 실거래가</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-4 flex-wrap">
                    {/* 기간 선택 버튼 */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">기간:</span>
                        <div className="flex gap-1">
                            {periods.map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setSelectedPeriod(period)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                        selectedPeriod === period
                                            ? "bg-cyan-100 text-cyan-800 border-cyan-200"
                                            : "bg-white text-gray-600 border-gray-300 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
                                    }`}
                                >
                                    {selectedPeriod === period && "✓ "}
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 거래 유형 토글 */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">거래유형:</span>
                        <div className="flex gap-2">
                            {dealTypes.map((type) => (
                                <button
                                    key={type}
                                    onClick={() => toggleDealType(type)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${selectedDealTypes.includes(type)
                                        ? getDealTypeColorClass(type)
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200'
                                        }`}
                                >
                                    {selectedDealTypes.includes(type) && "✓ "}
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 전용면적 드롭다운 */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">전용면적:</span>
                        <select
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                            className="px-3 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="전체">전체</option>
                            {areas.map((area) => (
                                <option key={area} value={area.toString()}>
                                    {area}㎡
                                </option>
                            ))}
                        </select>

                        {/* 🆕 ±1m² 토글 버튼 */}
                        {selectedArea !== "전체" && (
                            <button
                                onClick={() => setUseAreaRange(!useAreaRange)}
                                className={`px-2 py-1 text-xs font-medium rounded border transition-all ${
                                    useAreaRange
                                        ? "bg-blue-100 text-blue-800 border-blue-200"
                                        : "bg-white text-gray-600 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                                }`}
                                title="전용면적 ±1㎡ 범위로 검색"
                            >
                                {useAreaRange && "✓ "}±1㎡
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-gray-600">실거래가 조회 중...</p>
                    </div>
                ) : (
                    <div className="overflow-auto h-full">
                        <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-20">거래일</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-14">거래</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">가격</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-16">면적</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-12">동</th>
                                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-12">층</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedDeals.map((deal, index) => {
                                    const dealType = getDealType(deal);
                                    return (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">
                                                {formatDate(deal)}
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                <span className={`inline-flex px-1 py-0.5 text-xs font-medium rounded-full border ${getDealTypeColorClass(dealType)}`}>
                                                    {dealType}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-xs font-medium text-gray-900 whitespace-nowrap">
                                                {formatPrice(deal)}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">
                                                {deal.exclu_use_ar}㎡
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap text-center">
                                                {formatDong(deal)}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap text-center">
                                                {deal.floor ? `${deal.floor}층` : "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* ✅ 더보기 버튼 */}
                        {hasMore && (
                            <div className="p-4 text-center border-t border-gray-200">
                                <button
                                    onClick={handleLoadMore}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <span>▽</span>
                                    더보기 ({allDeals.length - displayedDeals.length}건 남음)
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {!isLoading && allDeals.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        선택한 조건에 맞는 실거래가 데이터가 없습니다.
                    </div>
                )}
            </div>

            {/* ✅ 푸터 (전체 건수 표시) */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <p className="text-xs text-gray-500 text-center">
                    총 {allDeals.length}건의 거래 내역 (최근 {selectedPeriod}) • 현재 {displayedDeals.length}건 표시 • 데이터 출처: 국토교통부 실거래가 공개시스템
                </p>
            </div>
        </>
    );

    // 임베디드 모드와 모달 모드 분기
    if (isEmbedded) {
        return (
            <div className="h-full flex flex-col bg-white">
                {content}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {content}
            </div>
        </div>
    );
}
