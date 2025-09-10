import { useEffect, useRef, useState } from "react";
import { use3DEqbHighlight } from "@/hooks/use3DEqbHighlight";
import { useWindowView } from "@/hooks/useWindowView";
import { useFirstPersonLook } from "@/hooks/useFirstPersonLook";
import { useWalkingMode } from "@/hooks/useWalkingMode";
import { useShadeAnalysis, type SeasonPreset } from "@/hooks/useShadeAnalysis";
import { useResizable } from "@/hooks/useResizable";

declare global {
    interface Window {
        Cesium: any;
        MapPrime3DExtension: any;
    }
}

type Props = {
    visible: boolean;
    onClose: () => void;
    selectedLocation?: {
        lat: number;
        lon: number;
    } | null;
    // ✅ 선택된 아파트 정보 추가
    selectedApt?: {
        apt_nm: string;
        jibun_address: string;
    } | null;
};

export default function MapPrime3DViewer({ visible, onClose, selectedLocation, selectedApt }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const prevLocationRef = useRef<{lat: number, lon: number} | null>(null); // ✅ 이전 좌표 저장용
    const [isFull, setIsFull] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWindowViewMode, setIsWindowViewMode] = useState(false);
    const [isFirstPersonMode, setIsFirstPersonMode] = useState(false);

    // ✅ 3D 단지 하이라이트 훅
    const { highlightApartment, clearHighlight } = use3DEqbHighlight(viewerRef.current, abortControllerRef.current);

    // ✅ 창가 뷰 훅
    useWindowView(viewerRef.current, isWindowViewMode, () => setIsWindowViewMode(false));

    // ✅ 1인칭 시점 둘러보기 훅 (마우스 휠 클릭)
    useFirstPersonLook(viewerRef.current);

    // ✅ 주변 둘러보기 훅 (WASD 걷기 모드)
    useWalkingMode(viewerRef.current, isFirstPersonMode, () => setIsFirstPersonMode(false));

    // ✅ 음영분석 훅
    const {
        isAnalyzing,
        startShadeAnalysis,
        clearShadeAnalysis,
        clearShadeResults,
        error: shadeError,
        setSeasonPreset
    } = useShadeAnalysis(viewerRef.current, abortControllerRef.current);

    // ✅ 음영분석 결과가 화면에 표시되고 있는지 상태 관리
    const [hasShadeResult, setHasShadeResult] = useState(false);
    // ✅ 마지막 음영분석 옵션 저장 (계절 변경 시 재실행용)
    const [lastShadeOptions, setLastShadeOptions] = useState<any>(null);

    // 리사이즈 기능
    const { width, height, resizeHandle } = useResizable({
        initialWidth: 320, // w-80 (20rem = 320px)
        initialHeight: 240, // h-60 (15rem = 240px)
        minWidth: 200,
        minHeight: 150,
        maxWidth: typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800,
        maxHeight: typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600,
        direction: 'bottom-left'
    });

    // ✅ 카메라 이동 함수 (MapPrime3D API 사용)
    const flyToLocation = (lat: number, lon: number) => {
        if (!viewerRef.current || !viewerRef.current._setCameraView) {
            console.warn('⚠️ 뷰어가 준비되지 않음');
            return;
        }

        // 헤딩 340도의 반대 방향으로 카메라를 뒤로 이동
        const offsetLat = -0.002;  // 남쪽으로 약 200m
        const offsetLon = 0.0007;  // 동쪽으로 약 70m

        const cameraLat = lat + offsetLat;
        const cameraLon = lon + offsetLon;

        console.log(`📹 카메라 이동: ${lat}, ${lon} → ${cameraLat}, ${cameraLon}`);

        // MapPrime3D의 _setCameraView API 사용
        const cameraView = {
            longitude: cameraLon,
            latitude: cameraLat,
            height: 400,
            heading: 340,
            pitch: -50,
            roll: 0
        };

        viewerRef.current._setCameraView(cameraView);
    };

    // ✅ 뷰어 생성 (visible만 의존성으로 설정 - 한 번만 실행)
    useEffect(() => {
        if (!visible || !containerRef.current || viewerRef.current) return;

        // AbortController 초기화
        abortControllerRef.current = new AbortController();
        console.log('🎮 AbortController 초기화됨');

        // MapPrime3D 라이브러리 로딩 대기 함수
        const waitForLibraries = () => {
            return new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50; // 5초 대기

                const checkLibraries = () => {
                    attempts++;

                    // Cesium과 MapPrime3DExtension 모두 확인
                    if (window.Cesium &&
                        window.Cesium.Viewer &&
                        typeof window.Cesium.Viewer === 'function' &&
                        window.MapPrime3DExtension) {
                        resolve();
                        return;
                    }

                    if (attempts >= maxAttempts) {
                        reject(new Error(
                            `라이브러리 로딩 실패. ` +
                            `Cesium: ${!!window.Cesium}, ` +
                            `Cesium.Viewer: ${!!window.Cesium?.Viewer}, ` +
                            `MapPrime3DExtension: ${!!window.MapPrime3DExtension}`
                        ));
                        return;
                    }

                    setTimeout(checkLibraries, 100);
                };

                checkLibraries();
            });
        };

        // ✅ 기본 카메라 위치 (서울)
        const getDefaultCamera = () => {
            console.log("📍 기본 위치로 3D 카메라 설정: 서울");
            return {
                longitude: 127.035,
                latitude: 37.519,
                height: 400,
                heading: 340,
                pitch: -50,
                roll: 0,
            };
        };

        // 라이브러리 로딩 대기 후 뷰어 초기화
        waitForLibraries()
            .then(() => {
                // 중간에 취소되었는지 확인
                if (abortControllerRef.current?.signal.aborted) {
                    console.log('🚫 뷰어 초기화 취소됨');
                    return;
                }

                setError(null);
                console.log('라이브러리 로딩 완료, 뷰어 생성 시작');

                try {
                    // 1. Cesium 뷰어 생성
                    const cesiumViewer = new window.Cesium.Viewer(containerRef.current, {
                        // Cesium 기본 UI 모두 숨기기
                        homeButton: false,
                        sceneModePicker: false,
                        baseLayerPicker: false,
                        navigationHelpButton: false,
                        animation: false,
                        timeline: false,
                        fullscreenButton: false,
                        geocoder: false,
                        infoBox: false,
                        selectionIndicator: false,
                        vrButton: false,
                        // 토큰 관련 요청 방지
                        requestRenderMode: false,
                    });

                    // Cesium Ion 관련 기능 비활성화 (토큰 에러 방지)
                    if (cesiumViewer.cesiumWidget.creditContainer) {
                        cesiumViewer.cesiumWidget.creditContainer.style.display = "none";
                    }

                    // Cesium Ion 서비스 비활성화
                    if (window.Cesium.Ion) {
                        window.Cesium.Ion.defaultAccessToken = undefined;
                    }

                    // 2. MapPrime3D 확장 적용
                    cesiumViewer.extend(window.MapPrime3DExtension, {
                        terrain: "https://mapprime.synology.me:15289/seoul/data/terrain/1m_v1.1/",
                        tileset: "https://mapprime.synology.me:15289/seoul/data/all_ktx2/tileset.json",
                        // tileset: "https://mapprime.synology.me:15289/MapPrimeServer/map/wmts?LAYER=mapprime:ecw_12cm&STYLE=&TILEMATRIXSET=google_tms&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&FORMAT=image/png&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}",
                        controls: [],
                        credit: "<i>MapPrime</i>",
                        imageries: [
                            {
                                title: "Arcgis",
                                credit: "Arcgis",
                                type: "TMS",
                                epsg: "EPSG:3857",
                                url: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                                format: "jpeg",
                                maximumLevel: 18,
                                current: false,
                            },
                            {
                                // title: "Arcgis",
                                // credit: "Arcgis",
                                // type: "TMS",
                                epsg: "EPSG:3857",
                                url: "https://mapprime.synology.me:15289/MapPrimeServer/map/wmts?LAYER=mapprime:ecw_12cm&STYLE=&TILEMATRIXSET=google_tms&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&FORMAT=image/png&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}",
                                format: "jpeg",
                                maximumLevel: 18,
                                current: true,
                            },
                        ],
                        // ✅ 기본 카메라 위치만 설정 (동적 이동은 별도 처리)
                        initialCamera: getDefaultCamera(),
                    });

                    // 뷰어 생성 후 다시 한 번 취소 확인
                    if (abortControllerRef.current?.signal.aborted) {
                        console.log('🚫 뷰어 생성 완료 후 취소 감지 - 뷰어 파괴');
                        cesiumViewer.destroy();
                        return;
                    }

                    viewerRef.current = cesiumViewer;
                    setIsLoading(false);
                    console.log('MapPrime3D 뷰어 생성 성공!');

                    // ✅ 초기 위치로 카메라 이동 (selectedLocation이 있는 경우)
                    if (selectedLocation) {
                        console.log('🎯 초기 위치로 카메라 이동:', selectedLocation);
                        setTimeout(() => {
                            flyToLocation(selectedLocation.lat, selectedLocation.lon);
                            setTimeout(() => {
                                console.log('✅ 초기 하이라이트 시작');
                                highlightApartment(selectedLocation.lat, selectedLocation.lon);
                            }, 300);
                        }, 500); // 뷰어 안정화를 위한 짧은 지연
                    }

                } catch (createError: unknown) {
                    // ✅ 타입 오류 수정
                    console.error('뷰어 생성 실패:', createError);
                    const errorMessage = createError instanceof Error ? createError.message : '알 수 없는 오류';
                    setError(`뷰어 생성 실패: ${errorMessage}`);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                setError(err.message);
                setIsLoading(false);
                console.error('MapPrime3D 초기화 오류:', err);
            });

        return () => {
            console.log('🧹 3D 뷰어 cleanup 시작');

            // 1. 모든 진행 중인 요청 취소
            if (abortControllerRef.current) {
                console.log('❌ 진행 중인 모든 요청 취소');
                abortControllerRef.current.abort('Component unmounting');
                abortControllerRef.current = null;
            }

            // 2. 하이라이트 및 음영분석 정리 (뷰어 파괴 전에)
            try {
                console.log('🧹 3D 하이라이트 정리 시작');
                clearHighlight();
            } catch (e) {
                console.warn('⚠️ 하이라이트 정리 중 오류:', e);
            }

            try {
                console.log('🧹 3D 음영분석 정리 시작');
                clearShadeAnalysis();
            } catch (e) {
                console.warn('⚠️ 음영분석 정리 중 오류:', e);
            }

            // 3. 뷰어 파괴
            if (viewerRef.current) {
                try {
                    // 뷰어가 이미 파괴되었는지 확인
                    if (!viewerRef.current.isDestroyed()) {
                        console.log('🧹 3D 뷰어 정리 시작');
                        viewerRef.current.destroy();
                        console.log('✅ 3D 뷰어 정리 완료');
                    }
                } catch (e) {
                    console.warn('⚠️ 뷰어 정리 중 오류:', e);
                } finally {
                    // 어떤 경우든 참조 정리 (맨 마지막에)
                    viewerRef.current = null;
                }
            }

            console.log('✅ 3D 뷰어 cleanup 완료');
        };
    }, [visible]); // ✅ selectedLocation 의존성 제거 - 뷰어는 한 번만 생성

    // ✅ 카메라 이동 및 하이라이트 처리 (selectedLocation 변경 시)
    useEffect(() => {
        // visible이 false일 때는 처리하지 않음 (POI 호버 시 불필요한 처리 방지)
        if (!visible) {
            return;
        }

        if (!viewerRef.current || isLoading || error) {
            console.log('⏳ 3D 뷰어 준비 대기 중...', {
                hasViewer: !!viewerRef.current,
                isLoading,
                hasError: !!error
            });
            return;
        }

        if (selectedLocation) {
            // ✅ 좌표가 실제로 변경된 경우에만 실행
            const prev = prevLocationRef.current;
            const isSameLocation = prev && 
                Math.abs(prev.lat - selectedLocation.lat) < 0.000001 && 
                Math.abs(prev.lon - selectedLocation.lon) < 0.000001;
            
            if (!isSameLocation) {
                console.log('🎯 3D 카메라 이동 및 하이라이트:', selectedLocation);

                // 1. 카메라 이동 (즉시 실행)
                flyToLocation(selectedLocation.lat, selectedLocation.lon);

                // 2. 짧은 지연 후 하이라이트 적용
                setTimeout(() => {
                    console.log('✅ 하이라이트 시작');
                    highlightApartment(selectedLocation.lat, selectedLocation.lon);
                }, 300); // 300ms 지연
                
                // 3. 현재 좌표를 이전 좌표로 저장
                prevLocationRef.current = { lat: selectedLocation.lat, lon: selectedLocation.lon };
            } else {
                console.log('🔄 동일한 좌표 - 카메라 이동 및 하이라이트 생략');
            }
        } else {
            console.log('🧹 3D 하이라이트 제거');
            // 선택 해제 시 하이라이트 제거 (카메라는 그대로)
            clearHighlight();
            prevLocationRef.current = null; // 이전 좌표 초기화
        }
    }, [visible, selectedLocation, highlightApartment, clearHighlight, isLoading, error]);

    if (!visible) return null;

    return (
        <>
            {/* 확대 시 전체 화면 오버레이 */}
            {isFull && (
                <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={() => setIsFull(false)} />
            )}

            {/* ✅ 3D 뷰어 컨테이너 - TopBar 아래 우측으로 이동 */}
            <div
                className={`fixed bg-white border shadow-lg transition-all duration-300 ${isFull
                    ? "inset-4 z-[9999]" // 확대 시 전체 화면
                    : "top-20 right-12 z-50" // TopBar(h-16) 아래 + 우측 버튼 왼쪽
                    }`}
                style={{
                    borderRadius: isFull ? '12px' : '8px',
                    width: isFull ? 'auto' : `${width}px`,
                    height: isFull ? 'auto' : `${height}px`,
                }}
            >
                {/* 리사이즈 핸들 - 좌측 하단 (축소 모드에서만 표시) */}
                {!isFull && (
                    <div 
                        className={`absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-10 ${
                            resizeHandle.isDragging ? 'bg-[#3D7D7B]' : 'bg-gray-300 hover:bg-[#14E3DC]'
                        } rounded-bl-lg opacity-60 hover:opacity-100 transition-all duration-200`}
                        onMouseDown={resizeHandle.onMouseDown}
                        title="크기 조절"
                    >
                        {/* 리사이즈 아이콘 */}
                        <div className="absolute bottom-1 left-1 text-white text-xs">
                            ⤢
                        </div>
                    </div>
                )}
                {/* 기본 제어 버튼들 (항상 표시) */}
                <div className={`absolute flex gap-2 z-10 ${isFull
                    ? "top-4 right-4"
                    : "top-2 right-2"
                    }`}>
                    {/* ✅ 아파트 단지명 표시 (좌표 대신) */}
                    {selectedApt && (
                        <div className={`bg-blue-500/90 text-white rounded shadow-sm ${isFull
                            ? "px-3 py-2 text-xs max-w-xs"
                            : "px-2 py-1 text-xs max-w-48"
                            }`}>
                            🏠 <span className="font-medium">{selectedApt.apt_nm}</span>
                        </div>
                    )}
                    <button
                        className={`bg-white/90 hover:bg-white border border-gray-300 text-gray-700 rounded shadow-sm transition-all ${isFull
                            ? "px-4 py-2 text-sm"
                            : "px-3 py-1 text-xs"
                            }`}
                        onClick={() => setIsFull(!isFull)}
                        disabled={isLoading || !!error}
                    >
                        {isFull ? "축소" : "확대"}
                    </button>
                    <button
                        className={`bg-red-500/90 hover:bg-red-600 text-white rounded shadow-sm transition-all ${isFull
                            ? "px-4 py-2 text-sm"
                            : "px-3 py-1 text-xs"
                            }`}
                        onClick={() => {
                            // 즉시 로딩 취소
                            if (isLoading && abortControllerRef.current) {
                                console.log('🛑 사용자가 로딩 중 닫기 요청 - 모든 작업 취소');
                                abortControllerRef.current.abort('User requested close');
                                setIsLoading(false);
                            }
                            onClose();
                        }}
                    >
                        닫기
                    </button>
                </div>

                {/* 3D 지도 조작 버튼들 (확대 시에만 표시, 우측 배치) */}
                {isFull && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-10">
                        <button
                            className={`${isWindowViewMode
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                } rounded-lg shadow-md transition-all px-4 py-3 text-sm border backdrop-blur-sm`}
                            onClick={() => setIsWindowViewMode(!isWindowViewMode)}
                            disabled={isLoading || !!error}
                            title="창가 뷰 모드"
                        >
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-lg">🪟</span>
                                <span className="text-xs">창가뷰</span>
                            </div>
                        </button>
                        <button
                            className={`${isFirstPersonMode
                                ? "bg-green-500 text-white border-green-500"
                                : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                } rounded-lg shadow-md transition-all px-4 py-3 text-sm border backdrop-blur-sm`}
                            onClick={() => setIsFirstPersonMode(!isFirstPersonMode)}
                            disabled={isLoading || !!error}
                            title="1인칭 걷기 모드 (WASD)"
                        >
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-lg">🚶</span>
                                <span className="text-xs">둘러보기</span>
                            </div>
                        </button>
                        <div className="flex flex-col gap-2">
                            <button
                                className={`${isAnalyzing
                                    ? "bg-orange-500 text-white border-orange-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-4 py-3 text-sm border backdrop-blur-sm ${isAnalyzing ? "opacity-75 cursor-not-allowed" : ""
                                    }`}
                                onClick={async () => {
                                    // shade.html처럼 바로 분석 시작
                                    const options = { interval: 15 }; // 기본 옵션
                                    await startShadeAnalysis(options);
                                    setLastShadeOptions(options); // 마지막 분석 옵션 저장
                                    setHasShadeResult(true); // 분석 완료 시 결과 표시 상태 활성화
                                }}
                                disabled={isLoading || !!error || isAnalyzing}
                                title="음영분석"
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-lg">
                                        {isAnalyzing ? "⏳" : "☀️"}
                                    </span>
                                    <span className="text-xs">
                                        {isAnalyzing ? "분석중" : "음영분석"}
                                    </span>
                                </div>
                            </button>
                            <button
                                className="bg-gray-500/90 hover:bg-gray-600 text-white rounded-lg shadow-md transition-all px-3 py-2 text-xs border backdrop-blur-sm"
                                onClick={() => {
                                    clearShadeAnalysis();
                                    setHasShadeResult(false); // 초기화 시 결과 표시 상태 비활성화
                                    setLastShadeOptions(null); // 마지막 분석 옵션도 초기화
                                }}
                                disabled={isLoading || !!error}
                                title="음영분석 결과 초기화"
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-sm">🧹</span>
                                    <span className="text-xs">초기화</span>
                                </div>
                            </button>

                            {/* 계절 프리셋 드롭다운 (음영분석 결과가 있을 때만 표시) */}
                            {hasShadeResult && (
                                <div className="bg-white/90 border border-gray-300 rounded-lg shadow-md backdrop-blur-sm">
                                    <select
                                        className="w-full px-3 py-2 text-xs text-gray-700 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onChange={async (e) => {
                                            const season = e.target.value as SeasonPreset;
                                            if (season && lastShadeOptions) {

                                                // 1. 기존 음영분석 결과만 제거 (포인트는 유지)
                                                clearShadeResults();

                                                // 2. 계절 프리셋 시간 설정
                                                setSeasonPreset(season);

                                                // 3. 짧은 지연 후 새로운 계절로 음영분석 재실행
                                                setTimeout(async () => {
                                                    const newOptions = {
                                                        ...lastShadeOptions,
                                                        seasonPreset: season,
                                                        useStoredPosition: true // 저장된 포인트 사용
                                                    };
                                                    await startShadeAnalysis(newOptions);
                                                    setLastShadeOptions(newOptions); // 옵션 업데이트
                                                }, 500); // viewer 시간 설정 후 잠시 대기
                                            }
                                        }}
                                        defaultValue=""
                                        title="계절 프리셋 선택"
                                    >
                                        <option value="">🌅 계절 선택</option>
                                        <option value="spring">🌸 춘분 (3/20)</option>
                                        <option value="summer">🌞 하지 (6/21)</option>
                                        <option value="autumn">🍂 추분 (9/23)</option>
                                        <option value="winter">❄️ 동지 (12/22)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 창가뷰 모드 가이드 메시지 */}
                {isWindowViewMode && (
                    <div className="absolute bottom-4 left-4 right-4 bg-blue-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🪟</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">창가뷰 모드</p>
                                <p className="text-xs opacity-90">건물을 클릭하여 창가에서 바라본 뷰를 확인하세요</p>
                            </div>
                            <button
                                onClick={() => setIsWindowViewMode(false)}
                                className="text-white/80 hover:text-white text-lg"
                                title="창가뷰 모드 해제"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* 둘러보기 모드 가이드 메시지 */}
                {isFirstPersonMode && (
                    <div className="absolute bottom-4 left-4 right-4 bg-green-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🚶</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">둘러보기 모드</p>
                                <p className="text-xs opacity-90">WASD 키로 이동하고 마우스로 시점을 조작하세요</p>
                            </div>
                            <button
                                onClick={() => setIsFirstPersonMode(false)}
                                className="text-white/80 hover:text-white text-lg"
                                title="둘러보기 모드 해제"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* 음영분석 가이드 메시지 (분석 중일 때만) */}
                {isAnalyzing && (
                    <div className="absolute bottom-4 left-4 right-4 bg-orange-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">☀️</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">음영분석</p>
                                <p className="text-xs opacity-90">지도를 클릭하여 음영분석할 지점을 선택하세요</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 음영분석 에러 표시 */}
                {shadeError && (
                    <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">⚠️</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">음영분석 오류</p>
                                <p className="text-xs opacity-90">{shadeError}</p>
                            </div>
                            <button
                                onClick={() => clearShadeAnalysis()}
                                className="text-white/80 hover:text-white text-lg"
                                title="오류 메시지 닫기"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* 로딩 상태 표시 */}
                {isLoading && (
                    <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-20 rounded-lg">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">
                                MapPrime3D 뷰어 로딩 중...
                                {selectedApt && (
                                    <span className="block text-xs text-blue-600 mt-1">
                                        {selectedApt.apt_nm}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {/* 에러 상태 표시 */}
                {error && (
                    <div className="absolute inset-0 bg-red-50/95 flex items-center justify-center z-20 rounded-lg p-4">
                        <div className="text-center max-w-md">
                            <p className="text-red-600 text-sm mb-2">3D 뷰어 로딩 실패</p>
                            <p className="text-xs text-gray-500 mb-3 break-words">{error}</p>
                            <button
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                                onClick={() => window.location.reload()}
                            >
                                페이지 새로고침
                            </button>
                        </div>
                    </div>
                )}

                {/* 3D 뷰어 컨테이너 */}
                <div
                    ref={containerRef}
                    className="w-full h-full rounded-lg overflow-hidden"
                />
            </div>
        </>
    );
}
