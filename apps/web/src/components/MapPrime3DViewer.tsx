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
    mapViewMode?: '2D' | '3D'; // 현재 맵 뷰 모드
    onToggleMapView?: () => void; // 맵 뷰 모드 전환 함수
};

export default function MapPrime3DViewer({ visible, onClose, selectedLocation, selectedApt, mapViewMode = '2D', onToggleMapView }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const prevLocationRef = useRef<{ lat: number, lon: number } | null>(null); // ✅ 이전 좌표 저장용
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

    // ✅ 뷰어 생성/파괴 관리
    useEffect(() => {
        if (!visible) {
            // 뷰어가 존재하면 정리
            if (viewerRef.current) {
                console.log('🧹 3D 뷰어 정리 시작');

                // 🔧 안전한 뷰어 파괴
                try {
                    // 1. 모든 이벤트 핸들러 정리
                    if (viewerRef.current.cesiumWidget?.screenSpaceEventHandler) {
                        const handler = viewerRef.current.cesiumWidget.screenSpaceEventHandler;
                        handler.removeInputAction(window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
                        handler.removeInputAction(window.Cesium.ScreenSpaceEventType.MIDDLE_CLICK);
                        handler.removeInputAction(window.Cesium.ScreenSpaceEventType.RIGHT_CLICK);
                    }

                    // 2. 렌더링 루프 중단
                    if (viewerRef.current.clock) {
                        viewerRef.current.clock.shouldAnimate = false;
                    }

                    // 3. WebGL 컨텍스트 정리
                    if (viewerRef.current.scene?.context) {
                        viewerRef.current.scene.context.destroy();
                    }

                    // 4. 뷰어 파괴
                    if (!viewerRef.current.isDestroyed()) {
                        viewerRef.current.destroy();
                        console.log('✅ 3D 뷰어 파괴 완료');
                    }

                } catch (e) {
                    console.warn('⚠️ 뷰어 파괴 중 오류:', e);
                }

                // 5. 참조 정리
                viewerRef.current = null;
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                    abortControllerRef.current = null;
                }

                console.log('✅ 3D 뷰어 정리 완료');
            }
            return;
        }

        // 🔧 async 함수로 뷰어 생성
        const initializeViewer = async () => {
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

            // 라이브러리 로딩 대기
            const waitForLibraries = () => {
                return new Promise<void>((resolve, reject) => {
                    const checkLibraries = () => {
                        if (window.Cesium && window.MapPrime3DExtension) {
                            console.log('✅ Cesium과 MapPrime3D 라이브러리 로딩 완료');
                            resolve();
                        } else {
                            console.log('⏳ 라이브러리 로딩 대기 중...');
                            setTimeout(checkLibraries, 100);
                        }
                    };
                    checkLibraries();
                });
            };

            try {
                await waitForLibraries();

                // 중간에 취소되었는지 확인
                if (abortControllerRef.current?.signal.aborted) {
                    console.log('🚫 뷰어 초기화 취소됨');
                    return;
                }

                setError(null);
                console.log('라이브러리 로딩 완료, 뷰어 생성 시작');

                // 뷰어 생성 부분 수정 (예시 방식 완전 복사)
                try {
                    // 🔧 컨테이너 정리
                    if (containerRef.current) {
                        containerRef.current.innerHTML = '';
                    }
                    
                    // 🔧 예시와 동일한 방식으로 div 생성
                    const worldContainer = document.createElement('div');
                    worldContainer.id = 'world-container';
                    worldContainer.style.width = '100%';
                    worldContainer.style.height = '100%';
                    worldContainer.style.display = 'block';
                    
                    containerRef.current.appendChild(worldContainer);
                    
                    // 🔧 뷰어 안정화 대기
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 1. Cesium 뷰어 생성 (예시와 완전 동일)
                    const cesiumViewer = new window.Cesium.Viewer('world-container');
                    
                    console.log('✅ Cesium 뷰어 생성 완료');

                    // 🔧 뷰어 안정화 대기
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // 2. MapPrime3D 확장 적용 (예시와 완전 동일)
                    cesiumViewer.extend(window.MapPrime3DExtension, {
                        terrain: 'https://mapprime.synology.me:15289/seoul/data/terrain/1m_v1.1/',
                        tileset: 'https://mapprime.synology.me:15289/seoul/data/all_ktx2/tileset.json',
                        controls: [],
                        imageries: [{
                            "title": "Imagery",
                            "credit": "Arcgis",
                            "type": "TMS",
                            "epsg": "EPSG:3857",
                            "url": "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                            "format": "jpeg",
                            "maximumLevel": 18,
                            "current": true
                        }, {
                            "title": "일반",
                            "credit": "바로e맵",
                            "type": "TMS",
                            "epsg": "EPSG:5179",
                            "url": "https://map.ngii.go.kr/openapi/Gettile.do?apikey=04trYP9_xwLAfALjwZ-B8g&layer=korean_map&style=korean&tilematrixset=korean&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={csZ}&TileCol={x}&TileRow={y}",
                            "format": "png",
                            "maximumLevel": 19,
                            "current": false
                        }],
                        credit: '<i>MapPrime</i>',
                        initialCamera: {
                            longitude: 127.035,
                            latitude: 37.519,
                            height: 400,
                            heading: 340,
                            pitch: -50,
                            roll: 0
                        }
                    });

                    console.log('✅ MapPrime3D 확장 적용 완료');
                    
                    // 🔧 예시처럼 카메라 설정
                    if (cesiumViewer._setCameraView) {
                        cesiumViewer._setCameraView({
                            longitude: 127.035,
                            latitude: 37.519,
                            height: 400,
                            heading: 340,
                            pitch: -50,
                            roll: 0
                        });
                        console.log('✅ MapPrime3D 카메라 설정 완료');
                    }
                    
                    // 🔧 최종 안정화 대기
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    viewerRef.current = cesiumViewer;
                    setIsLoading(false);
                    setError(null);
                    
                    console.log('✅ MapPrime3D 뷰어 생성 성공! (예시 방식 완전 복사)');
                    
                    // 🔧 뷰어 상태 확인
                    console.log('🔍 뷰어 상태:', {
                        viewer: !!cesiumViewer,
                        cesiumWidget: !!cesiumViewer.cesiumWidget,
                        screenSpaceEventHandler: !!cesiumViewer.cesiumWidget?.screenSpaceEventHandler,
                        scene: !!cesiumViewer.scene,
                        camera: !!cesiumViewer.camera,
                        _setCameraView: typeof cesiumViewer._setCameraView,
                        _drawAction: typeof cesiumViewer._drawAction,
                        _startAnalysisShade: typeof cesiumViewer._startAnalysisShade
                    });

                } catch (error) {
                    console.error('❌ 뷰어 생성 실패:', error);
                    setError(error instanceof Error ? error.message : '뷰어 생성 실패');
                    setIsLoading(false);
                }

            } catch (error) {
                console.error('❌ 뷰어 초기화 중 오류:', error);
                setError('뷰어 초기화 실패');
                setIsLoading(false);
            }
        };

        // 🔧 async 함수 호출
        initializeViewer().catch(error => {
            console.error('❌ 뷰어 초기화 중 오류:', error);
            setError('뷰어 초기화 실패');
            setIsLoading(false);
        });
    }, [visible]);

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
            {/* ✅ 3D 뷰어 컨테이너 - TopBar 아래 우측으로 이동 */}
            <div
                className={mapViewMode === '3D'
                    ? 'fixed inset-0 bg-white z-[100]' // 3D 메인 모드 - 적절한 z-index로 표시되도록
                    : 'fixed top-20 right-12 z-50 bg-white border shadow-lg rounded-lg' // 팝업 기본 위치
                }
                style={mapViewMode === '3D' ? {} : {
                    width: `${width}px`,
                    height: `${height}px`,
                }}
            >
                {/* 리사이즈 핸들 - 좌측 하단 (3D 메인 모드가 아닌 경우에만 표시) */}
                {mapViewMode !== '3D' && (
                    <div
                        className={`absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-10 ${resizeHandle.isDragging ? 'bg-[#3D7D7B]' : 'bg-gray-300 hover:bg-[#14E3DC]'
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
                <div className="absolute flex gap-2 z-10 top-2 right-2">
                    {/* ✅ 아파트 단지명 표시 (좌표 대신) */}
                    {selectedApt && (
                        <div className="bg-blue-500/90 text-white rounded shadow-sm px-2 py-1 text-xs max-w-48">
                            🏠 <span className="font-medium">{selectedApt.apt_nm}</span>
                        </div>
                    )}

                    {/* X 닫기 버튼 - 3D 메인 모드가 아닐 때만 표시 */}
                    {mapViewMode !== '3D' && (
                        <button
                            onClick={onClose}
                            className="bg-gray-500/90 hover:bg-gray-600 text-white rounded shadow-sm transition-all w-6 h-6 flex items-center justify-center text-xs"
                            title="닫기"
                        >
                            ✕
                        </button>
                    )}
                    {/* 전환 버튼 - 팝업에서만 표시 */}
                    {mapViewMode !== '3D' && (
                        <button
                            className="bg-white/90 hover:bg-white border border-gray-300 text-gray-700 rounded shadow-sm transition-all px-3 py-1 text-xs"
                            onClick={() => {
                                if (onToggleMapView) {
                                    onToggleMapView(); // Home.tsx의 로직이 처리
                                }
                            }}
                            disabled={isLoading || !!error}
                        >
                            전환
                        </button>
                    )}
                </div>

                {/* 3D 지도 조작 버튼들 (3D 메인 모드에서만 표시, 우측 배치) */}
                {mapViewMode === '3D' && (
                    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-[300]">
                        <button
                            className={`${isWindowViewMode
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                } rounded-lg shadow-md transition-all px-4 py-3 text-sm border backdrop-blur-sm`}
                            onClick={() => {
                                console.log('🪟 창가뷰 버튼 클릭됨:', {
                                    현재상태: isWindowViewMode,
                                    음영분석중: isAnalyzing,
                                    뷰어상태: !!viewerRef.current
                                });

                                // 🔧 음영분석이 진행 중이면 먼저 중단
                                if (isAnalyzing) {
                                    console.log('🛑 음영분석 중단 중...');
                                    clearShadeAnalysis();
                                    setHasShadeResult(false);
                                    setLastShadeOptions(null);
                                }
                                setIsWindowViewMode(!isWindowViewMode);
                                console.log('✅ 창가뷰 모드 변경:', !isWindowViewMode);
                            }}
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
                                    console.log('☀️ 음영분석 버튼 클릭됨:', {
                                        창가뷰모드: isWindowViewMode,
                                        분석중: isAnalyzing,
                                        뷰어상태: !!viewerRef.current
                                    });

                                    // 🔧 창가뷰 모드가 활성화되어 있다면 먼저 비활성화
                                    if (isWindowViewMode) {
                                        console.log('🛑 창가뷰 모드 비활성화 중...');
                                        setIsWindowViewMode(false);
                                        // 짧은 지연 후 음영분석 시작 (이벤트 정리 시간)
                                        setTimeout(async () => {
                                            console.log('🌅 창가뷰 해제 후 음영분석 시작');
                                            const options = { interval: 15 };
                                            await startShadeAnalysis(options);
                                            setLastShadeOptions(options);
                                            setHasShadeResult(true);
                                        }, 100);
                                    } else {
                                        console.log('🌅 즉시 음영분석 시작');
                                        // shade.html처럼 바로 분석 시작
                                        const options = { interval: 15 }; // 기본 옵션
                                        await startShadeAnalysis(options);
                                        setLastShadeOptions(options); // 마지막 분석 옵션 저장
                                        setHasShadeResult(true); // 분석 완료 시 결과 표시 상태 활성화
                                    }
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
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🪟</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">창가뷰 모드</p>
                                <p className="text-xs opacity-90">건물을 클릭하여 창가에서 바라본 뷰를 확인하세요</p>
                            </div>
                            <button
                                onClick={() => setIsWindowViewMode(false)}
                                className="text-white/80 hover:text-white text-lg ml-2"
                                title="창가뷰 모드 해제"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* 둘러보기 모드 가이드 메시지 */}
                {isFirstPersonMode && (
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🚶</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">둘러보기 모드</p>
                                <p className="text-xs opacity-90">WASD 키로 이동하고 마우스로 시점을 조작하세요</p>
                            </div>
                            <button
                                onClick={() => setIsFirstPersonMode(false)}
                                className="text-white/80 hover:text-white text-lg ml-2"
                                title="둘러보기 모드 해제"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* 음영분석 가이드 메시지 (분석 중일 때만) */}
                {isAnalyzing && (
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-orange-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                        <div className="flex items-center gap-3">
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
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">⚠️</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium">음영분석 오류</p>
                                <p className="text-xs opacity-90">{shadeError}</p>
                            </div>
                            <button
                                onClick={() => clearShadeAnalysis()}
                                className="text-white/80 hover:text-white text-lg ml-2"
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
