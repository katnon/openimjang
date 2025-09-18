import React, { useState, useEffect } from 'react';

// 프리셋 포인트 데이터 타입
interface PresetPoint {
    id: number;
    lat: number;
    lon: number;
    apt_nm: string;
    jibun_address: string;
    dong: string;
    ho: string;
    exclu_use_ar: number;
    apt_id: number; // 🆕 아파트 ID 추가
    floorplan_image_url?: string;
    created_at: string;
}

// 실거래 정보 타입
interface RealEstateQuickInfo {
    sale?: {
        price: number;
        date: string;
    };
    jeonse?: {
        deposit: number;
        date: string;
    };
    monthly?: {
        deposit: number;
        rent: number;
        date: string;
    };
}

interface FloatingPresetLabelProps {
    preset: PresetPoint;
    position: { x: number; y: number }; // 화면상 위치
    isExpanded: boolean;
    onToggleExpanded: () => void;
    onFloorplanToggle?: () => void;
    showFloorplan?: boolean;
}

const FloatingPresetLabel: React.FC<FloatingPresetLabelProps> = ({
    preset,
    position,
    isExpanded,
    onToggleExpanded,
    onFloorplanToggle,
    showFloorplan = false
}) => {
    const [realEstateInfo, setRealEstateInfo] = useState<RealEstateQuickInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);
    const [floorplanLoadError, setFloorplanLoadError] = useState(false);

    // 평면도 이미지 URL 정규화 (BFF 서버 주소 포함)
    const getFloorplanImageUrl = (imageUrl: string | undefined): string | undefined => {
        if (!imageUrl) return undefined;

        // 이미 전체 URL인 경우 그대로 반환
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        // 상대 경로인 경우 BFF 서버 주소와 조합
        const bffBaseUrl = import.meta.env.VITE_BFF_URL || 'http://localhost:8787';
        const normalizedUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return `${bffBaseUrl}${normalizedUrl}`;
    };

    const floorplanImageUrl = getFloorplanImageUrl(preset.floorplan_image_url);

    // 실거래 정보 조회 (확장 시에만, 중복 호출 방지)
    useEffect(() => {
        const fetchRealEstateInfo = async () => {
            // 필수 조건 확인
            if (!isExpanded || !preset.apt_id || !preset.exclu_use_ar) {
                console.log(`⚠️ 실거래 정보 조회 건너뜀: 확장=${isExpanded}, apt_id=${preset.apt_id}, 면적=${preset.exclu_use_ar}`);
                return;
            }

            // 이미 로딩 중이거나 정보가 있으면 중복 호출 방지
            if (isLoadingInfo || realEstateInfo) {
                console.log(`⚠️ 이미 로딩 중이거나 정보 있음: 로딩=${isLoadingInfo}, 정보=${!!realEstateInfo}`);
                return;
            }

            setIsLoadingInfo(true);
            console.log(`🔍 프리셋 ${preset.id}의 실거래 정보 조회 시작 (apt_id: ${preset.apt_id}, 면적: ${preset.exclu_use_ar}㎡)`);

            try {
                // 각 거래 유형별로 최신 1건씩 조회 (타임아웃 설정)
                const promises = [
                    // 매매가
                    fetch(`/api/search/deals/${preset.apt_id}?area=${preset.exclu_use_ar}&period=1년&limit=1&dealType=매매`, {
                        signal: AbortSignal.timeout(10000) // 10초 타임아웃
                    }),
                    // 전세가
                    fetch(`/api/search/deals/${preset.apt_id}?area=${preset.exclu_use_ar}&period=1년&limit=1&dealType=전세`, {
                        signal: AbortSignal.timeout(10000)
                    }),
                    // 월세가
                    fetch(`/api/search/deals/${preset.apt_id}?area=${preset.exclu_use_ar}&period=1년&limit=1&dealType=월세`, {
                        signal: AbortSignal.timeout(10000)
                    })
                ];

                const responses = await Promise.allSettled(promises);

                // 응답 데이터 처리 (실패한 요청은 빈 배열로 처리)
                const [saleResult, jeonseResult, monthlyResult] = responses.map(result =>
                    result.status === 'fulfilled' && result.value.ok
                        ? result.value.json()
                        : Promise.resolve([])
                );

                const [saleData, jeonseData, monthlyData] = await Promise.all([saleResult, jeonseResult, monthlyResult]);

                const info: RealEstateQuickInfo = {};

                // 매매가 정보 처리
                if (Array.isArray(saleData) && saleData.length > 0) {
                    const sale = saleData[0];
                    if (sale.deal_amount) {
                        info.sale = {
                            price: sale.deal_amount,
                            date: `${sale.deal_year}.${String(sale.deal_month).padStart(2, '0')}`
                        };
                    }
                }

                // 전세가 정보 처리
                if (Array.isArray(jeonseData) && jeonseData.length > 0) {
                    const jeonse = jeonseData[0];
                    if (jeonse.deposit) {
                        info.jeonse = {
                            deposit: jeonse.deposit,
                            date: `${jeonse.deal_year}.${String(jeonse.deal_month).padStart(2, '0')}`
                        };
                    }
                }

                // 월세가 정보 처리
                if (Array.isArray(monthlyData) && monthlyData.length > 0) {
                    const monthly = monthlyData[0];
                    if (monthly.deposit && monthly.monthly_rent) {
                        info.monthly = {
                            deposit: monthly.deposit,
                            rent: monthly.monthly_rent,
                            date: `${monthly.deal_year}.${String(monthly.deal_month).padStart(2, '0')}`
                        };
                    }
                }

                setRealEstateInfo(info);
                console.log('✅ 실거래 정보 조회 완료:', info);

            } catch (error) {
                console.error('❌ 실거래 정보 조회 실패:', error);
                setRealEstateInfo({});  // 빈 객체로 설정해서 재시도 방지
            } finally {
                setIsLoadingInfo(false);
            }
        };

        // 약간의 지연을 둬서 중복 호출 방지
        const timeoutId = setTimeout(fetchRealEstateInfo, 200);
        return () => clearTimeout(timeoutId);
    }, [isExpanded, preset.apt_id, preset.exclu_use_ar]);

    // 가격 포맷팅 함수
    const formatPrice = (amount: number): string => {
        const eok = Math.floor(amount / 10000);
        const man = amount % 10000;

        if (eok > 0 && man > 0) {
            return `${eok}억 ${man}만`;
        } else if (eok > 0) {
            return `${eok}억`;
        } else {
            return `${man}만`;
        }
    };

    console.log(`🏷️ FloatingPresetLabel 렌더링: ID ${preset.id}, 위치 (${position.x}, ${position.y}), 확장됨: ${isExpanded}`);

    return (
        <div
            className="fixed pointer-events-auto transition-all duration-150 ease-out"
            style={{
                left: `${position.x - (isExpanded ? 88 : 48)}px`, // 확장 시 중앙 정렬 (더 큰 크기에 맞춤)
                top: `${position.y - 30}px`, // 포인트 더 가깝게 표시
                transform: `translate3d(0, 0, 0)`, // GPU 가속 활성화
                zIndex: 99999, // 매우 높은 z-index
                willChange: 'transform', // 브라우저 최적화 힌트
            }}
        >
            {/* 메인 라벨 */}
            <div
                className={`relative transition-all duration-300 ease-out cursor-pointer
                    ${isExpanded
                        ? 'w-44 h-auto' // 확장된 크기 (더 크게)
                        : 'w-24 h-10'    // 컴팩트 크기 (더 크게)
                    }`}
                onClick={onToggleExpanded}
                onMouseEnter={() => !isExpanded && onToggleExpanded()}
                onMouseLeave={() => isExpanded && onToggleExpanded()}
            >
                {/* 컴팩트 모드 */}
                {!isExpanded && (
                    <div className="w-full h-full bg-gradient-to-r from-cyan-400 to-teal-500 text-white rounded-lg shadow-lg flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-xs font-bold leading-tight">
                                {preset.dong || '?동'} {preset.ho || '?호'}
                            </div>
                            {preset.exclu_use_ar && (
                                <div className="text-xs">
                                    {preset.exclu_use_ar}㎡
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 확장 모드 */}
                {isExpanded && (
                    <div className="bg-white border-l-4 border-cyan-400 shadow-xl rounded-lg overflow-hidden">
                        {/* 헤더 */}
                        <div className="bg-gradient-to-r from-cyan-50 to-teal-50 p-3 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-sm text-gray-900">
                                        {preset.dong} {preset.ho}
                                    </div>
                                    {preset.exclu_use_ar && (
                                        <div className="text-xs text-gray-900">
                                            {preset.exclu_use_ar}㎡
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 실거래 정보 */}
                        <div className="p-3 space-y-2">
                            {isLoadingInfo ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <div className="animate-spin w-3 h-3 border border-gray-300 border-t-cyan-500 rounded-full"></div>
                                    실거래 조회 중...
                                </div>
                            ) : realEstateInfo ? (
                                <div className="space-y-1">
                                    {/* 매매가 */}
                                    {realEstateInfo.sale && (
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-gray-900 font-medium">매매:</span>
                                            <span className="text-gray-900">
                                                {formatPrice(realEstateInfo.sale.price)} ({realEstateInfo.sale.date})
                                            </span>
                                        </div>
                                    )}

                                    {/* 전세가 */}
                                    {realEstateInfo.jeonse && (
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-gray-900 font-medium">전세:</span>
                                            <span className="text-gray-900">
                                                {formatPrice(realEstateInfo.jeonse.deposit)} ({realEstateInfo.jeonse.date})
                                            </span>
                                        </div>
                                    )}

                                    {/* 월세가 */}
                                    {realEstateInfo.monthly && (
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-gray-900 font-medium">월세:</span>
                                            <span className="text-gray-900">
                                                {formatPrice(realEstateInfo.monthly.deposit)}/{realEstateInfo.monthly.rent}만 ({realEstateInfo.monthly.date})
                                            </span>
                                        </div>
                                    )}

                                    {/* 데이터가 없는 경우 */}
                                    {!realEstateInfo.sale && !realEstateInfo.jeonse && !realEstateInfo.monthly && (
                                        <div className="text-xs text-gray-500 text-center py-1">
                                            최근 거래 정보 없음
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 text-center py-1">
                                    실거래 정보 없음
                                </div>
                            )}
                        </div>

                        {/* 평면도 버튼 */}
                        {floorplanImageUrl && (
                            <div className="px-3 pb-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log(`📐 평면도 버튼 클릭: ID ${preset.id}, URL: ${floorplanImageUrl}`);
                                        onFloorplanToggle?.();
                                    }}
                                    className={`w-full text-xs px-2 py-1 rounded border transition-colors ${
                                        showFloorplan
                                            ? 'bg-indigo-100 text-gray-900 border-indigo-200'
                                            : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-indigo-50'
                                    }`}
                                >
                                    평면도 {showFloorplan ? '닫기' : '보기'}
                                    {floorplanLoadError && <span className="text-red-500 ml-1">⚠️</span>}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 포인터 화살표 */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white drop-shadow-sm"></div>
            </div>

            {/* 평면도 팝업 (라벨 우측에 슬라이드 확장) */}
            {showFloorplan && floorplanImageUrl && (
                <div className="absolute left-full top-0 ml-2 w-48 h-64 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-10">
                    <div className="h-8 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-3">
                        <span className="text-xs font-medium text-gray-700">평면도</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onFloorplanToggle?.();
                            }}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                    <div className="h-56 p-2">
                        {floorplanLoadError ? (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded border border-gray-200">
                                <div className="text-center text-gray-500">
                                    <div className="text-xs">평면도를 불러올 수 없습니다</div>
                                    <button
                                        onClick={() => {
                                            console.log(`🔄 평면도 재시도: ${floorplanImageUrl}`);
                                            setFloorplanLoadError(false);
                                        }}
                                        className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                                    >
                                        다시 시도
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={floorplanImageUrl}
                                alt={`${preset.dong} ${preset.ho} 평면도`}
                                className="w-full h-full object-contain rounded border border-gray-200"
                                onError={(e) => {
                                    console.log(`❌ 평면도 이미지 로딩 실패: ${floorplanImageUrl}`);
                                    setFloorplanLoadError(true);
                                }}
                                onLoad={() => {
                                    console.log(`✅ 평면도 이미지 로딩 성공: ${floorplanImageUrl}`);
                                    setFloorplanLoadError(false);
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingPresetLabel;