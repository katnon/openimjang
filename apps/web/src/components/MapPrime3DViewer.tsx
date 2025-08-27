import { useEffect, useRef, useState } from "react";

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
    const [isFull, setIsFull] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || !containerRef.current || viewerRef.current) return;

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

        // ✅ 초기 카메라 위치 계산
        const getInitialCamera = () => {
            if (selectedLocation) {
                // 헤딩 340도의 반대 방향으로 카메라를 뒤로 이동
                const offsetLat = -0.002;  // 남쪽으로 약 200m
                const offsetLon = 0.0007;  // 동쪽으로 약 70m

                const cameraLat = selectedLocation.lat + offsetLat;
                const cameraLon = selectedLocation.lon + offsetLon;

                console.log(`🎯 선택된 위치: ${selectedLocation.lat}, ${selectedLocation.lon}`);
                console.log(`📹 카메라 위치: ${cameraLat}, ${cameraLon} (뒤로 ${Math.round(offsetLat * 111000)}m, 옆으로 ${Math.round(offsetLon * 88000)}m)`);

                return {
                    longitude: cameraLon,
                    latitude: cameraLat,
                    height: 400,
                    heading: 340,
                    pitch: -50,
                    roll: 0,
                };
            } else {
                // 기본값 (서울)
                console.log("📍 기본 위치로 3D 카메라 설정: 서울");
                return {
                    longitude: 127.035,
                    latitude: 37.519,
                    height: 400,
                    heading: 340,
                    pitch: -50,
                    roll: 0,
                };
            }
        };

        // 라이브러리 로딩 대기 후 뷰어 초기화
        waitForLibraries()
            .then(() => {
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
                                current: true,
                            },
                        ],
                        // ✅ 동적 초기 카메라 위치 적용
                        initialCamera: getInitialCamera(),
                    });

                    viewerRef.current = cesiumViewer;
                    setIsLoading(false);
                    console.log('MapPrime3D 뷰어 생성 성공!');

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
            if (viewerRef.current) {
                try {
                    viewerRef.current.destroy();
                } catch (e) {
                    console.warn('뷰어 정리 중 오류:', e);
                }
                viewerRef.current = null;
            }
        };
    }, [visible, selectedLocation]); // ✅ selectedLocation 의존성 추가

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
                    : "w-80 h-60 top-20 right-12 z-50" // TopBar(h-16) 아래 + 우측 버튼 왼쪽
                    }`}
                style={{
                    borderRadius: isFull ? '12px' : '8px',
                }}
            >
                {/* 제어 버튼들 */}
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
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

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
