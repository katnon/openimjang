import { useEffect, useRef, useState, useCallback } from "react";
import { use3DEqbHighlight } from "@/hooks/use3DEqbHighlight";
import { useWindowView } from "@/hooks/useWindowView";
import { useFirstPersonLook } from "@/hooks/useFirstPersonLook";
import { useWalkingMode } from "@/hooks/useWalkingMode";
import { useShadeAnalysis, type SeasonPreset, type SunlightData } from "@/hooks/useShadeAnalysis";
import { useResizable } from "@/hooks/useResizable";
import { useNaverStreetView } from "@/hooks/useNaverStreetView";
import { useCameraFrustum, type CameraFrustum } from "@/hooks/useCameraFrustum";
import { useSkyline } from "@/hooks/useSkyline";
import { useCesiumTime } from "@/hooks/useCesiumTime";
import { useDeveloperMode } from "@/contexts/DeveloperModeProvider";
import PointInputModal from "@/components/map/PointInputModal";
import TimeController from "@/components/TimeController";
import SeasonalSunlightComparisonPopup from "@/components/SeasonalSunlightComparisonPopup";
import { FloorplanPopup } from "@/components/FloorplanPopup";

declare global {
    interface Window {
        Cesium: any;
        MapPrime3DExtension: any;
        MapPrime3DNavigator?: {
            navigateToPreset: (preset: { lat: number; lon: number; dong: string; ho: string }) => void;
            executeWindowViewAtPreset: (preset: { lat: number; lon: number; dong: string; ho: string }) => void;
            executeShadeAnalysisAtPreset: (preset: { lat: number; lon: number; dong: string; ho: string }) => void;
            executeShadeAnalysisAtPresetById: (presetId: number) => Promise<void>; // 🆕 ID 기반 음영분석
        };
    }
}

type Props = {
    isVisible: boolean;
    onClose: () => void;
    selectedLocation?: {
        lat: number;
        lon: number;
    } | null;
    // ✅ 선택된 아파트 정보 추가
    selectedApt?: {
        id: number;
        apt_nm: string;
        jibun_address: string;
    } | null;
    mapViewMode?: '2D' | '3D'; // 현재 맵 뷰 모드
    onToggleMapView?: () => void; // 맵 뷰 모드 전환 함수
    // 🆕 확장카드 연동용 콜백
    onPresetNavigated?: (preset: { lat: number; lon: number; dong: string; ho: string }) => void;
    // 🆕 3D 시야 범위 업데이트 콜백
    onFrustumUpdate?: (frustum: CameraFrustum) => void;
    // 🆕 프리셋 포인트 선택 시 확장카드 미리보기 탭 열기
    onPresetPointSelect?: (preset: any) => void;
};

export default function MapPrime3DViewer({ isVisible, onClose, selectedLocation, selectedApt, mapViewMode = '2D', onToggleMapView, onPresetNavigated, onFrustumUpdate, onPresetPointSelect }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const prevLocationRef = useRef<{ lat: number, lon: number } | null>(null); // ✅ 이전 좌표 저장용
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWindowViewMode, setIsWindowViewMode] = useState(false);
    const [isFirstPersonMode, setIsFirstPersonMode] = useState(false);
    const [isStreetViewActive, setIsStreetViewActive] = useState(false);

    // 🔧 개발자 모드 관련 상태
    const { isDeveloperMode } = useDeveloperMode();
    const [isPointCreationMode, setIsPointCreationMode] = useState(false);
    const [presetPoints, setPresetPoints] = useState<any[]>([]);
    const [selectedPointInfo, setSelectedPointInfo] = useState<any>(null);
    const [showPointInputModal, setShowPointInputModal] = useState(false);
    const [newPointData, setNewPointData] = useState<any>(null);

    // 🔧 평면도 모달 상태
    const [showFloorplanModal, setShowFloorplanModal] = useState(false);
    const [floorplanImageUrl, setFloorplanImageUrl] = useState<string>('');

    // 🔧 라벨 표시 토글 상태
    const [showPresetLabels, setShowPresetLabels] = useState(true);

    // 🗑️ MapPrime3D DivPoint 사용으로 대부분 상태 제거
    const [pointLabelsData, setPointLabelsData] = useState<Map<string, any>>(new Map());

    // 🔧 평면도 팝업 상태
    const [showFloorplanPopup, setShowFloorplanPopup] = useState(false);
    const [currentFloorplanData, setCurrentFloorplanData] = useState<{
        aptName?: string;
        dong?: string;
        ho?: string;
        exclu_use_ar?: number;
        floorplanImageUrl?: string;
    } | null>(null);

    // 🕐 시간 컨트롤러 상태
    const [showTimeController, setShowTimeController] = useState(false);


    // ✅ 3D 단지 하이라이트 훅
    const { highlightApartment, clearHighlight } = use3DEqbHighlight(viewerRef.current, abortControllerRef.current);

    // 🕐 세슘 시간 제어 훅
    const cesiumTimeHook = useCesiumTime(viewerRef.current);

    // ✅ 창가 뷰 훅
    useWindowView(viewerRef.current, isWindowViewMode, () => setIsWindowViewMode(false));

    // ✅ 1인칭 시점 둘러보기 훅 (마우스 휠 클릭)
    useFirstPersonLook(viewerRef.current);

    // ✅ 주변 둘러보기 훅 (WASD 걷기 모드)
    useWalkingMode(viewerRef.current, isFirstPersonMode, () => setIsFirstPersonMode(false));

    // 🗺️ 네이버 로드뷰 동기화 훅
    const streetViewHook = useNaverStreetView(viewerRef.current, {
        isActive: isStreetViewActive,
        containerId: 'street-view-container',
        initialPosition: selectedLocation ? {
            lat: selectedLocation.lat,
            lng: selectedLocation.lon,
            alt: 10
        } : undefined,
        syncWithWalkingMode: true, // 걷기 모드와 동기화
        syncWithFirstPersonMode: true // 1인칭 모드와 동기화
    });

    // 🎯 3D 카메라 시야 범위 계산 훅 (미니맵용)
    const cameraFrustumHook = useCameraFrustum(viewerRef.current, {
        isActive: isVisible && mapViewMode === '3D', // 3D 모드일 때만 활성화
        debounceMs: 300, // 300ms 디바운스
        onFrustumUpdate: onFrustumUpdate // 상위 컴포넌트로 frustum 전달
    });

    // ✅ 음영분석 훅
    const {
        isAnalyzing,
        startShadeAnalysis,
        clearShadeAnalysis,
        clearShadeResults,
        error: shadeError,
        setSeasonPreset,
        generateSeasonalComparisonData
    } = useShadeAnalysis(viewerRef.current, abortControllerRef.current);

    // ✅ 스카이라인 분석 훅
    const {
        isSkylineAnalyzing,
        skylineResult,
        showSkylineResult,
        skylineError,
        startSkylineAnalysis,
        clearSkylineAnalysis,
        closeSkylineResult,
        clearSkylineError
    } = useSkyline(viewerRef.current, () => setIsWindowViewMode(false));

    // 🌆 스카이라인 결과 모달 닫기 시 자동 초기화
    const handleCloseSkylineResult = () => {
        closeSkylineResult(); // 모달 닫기
        clearSkylineAnalysis(); // 분석 결과 초기화
    };

    // ✅ 음영분석 결과가 화면에 표시되고 있는지 상태 관리
    const [hasShadeResult, setHasShadeResult] = useState(false);
    // ✅ 마지막 음영분석 옵션 저장 (계절 변경 시 재실행용)
    const [lastShadeOptions, setLastShadeOptions] = useState<any>(null);
    // ✅ 일조시간 분석 팝업 표시 상태
    const [showSunlightComparisonPopup, setShowSunlightComparisonPopup] = useState(false);
    // ✅ 일조시간 분석 데이터
    const [sunlightComparisonData, setSunlightComparisonData] = useState<SunlightData[]>([]);

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

    // 🆕 확장카드에서 프리셋 선택 시 카메라 이동 (외부 노출 함수)
    const navigateToPreset = useCallback((preset: { lat: number; lon: number; dong: string; ho: string }) => {
        console.log('🏠 프리셋으로 카메라 이동:', preset);
        flyToLocation(preset.lat, preset.lon);

        // 선택된 프리셋 정보를 부모에게 알림
        onPresetNavigated?.(preset);
    }, [flyToLocation, onPresetNavigated]);

    // 🪟 프리셋 위치에서 창가뷰 실제 실행 (단순 모드 활성화가 아닌 실제 창가뷰)
    const executeWindowViewAtPreset = useCallback((preset: { lat: number; lon: number; dong: string; ho: string }) => {
        console.log('🪟 프리셋에서 창가뷰 실제 실행:', preset);

        if (!viewerRef.current || !window.Cesium) {
            console.warn('⚠️ Viewer 또는 Cesium이 준비되지 않음');
            return;
        }

        try {
            // 1. 프리셋 위치를 Cesium Cartesian3로 변환
            const presetPosition = window.Cesium.Cartesian3.fromDegrees(preset.lon, preset.lat, 50); // 50m 높이에서 시작

            // 2. 현재 카메라 위치를 저장 (창가뷰에서 바라볼 방향 계산용)
            const currentCameraPosition = viewerRef.current.camera.positionWC.clone();

            // 3. 프리셋 위치에서 현재 카메라 방향으로의 벡터 계산
            const viewDirection = window.Cesium.Cartesian3.subtract(
                currentCameraPosition,
                presetPosition,
                new window.Cesium.Cartesian3()
            );
            window.Cesium.Cartesian3.normalize(viewDirection, viewDirection);

            // 4. 수평 방향으로 조정 (지면과 평행하게)
            const surfaceNormal = window.Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(presetPosition, new window.Cesium.Cartesian3());
            const verticalComponent = window.Cesium.Cartesian3.multiplyByScalar(
                surfaceNormal,
                window.Cesium.Cartesian3.dot(viewDirection, surfaceNormal),
                new window.Cesium.Cartesian3()
            );
            const horizontalDirection = window.Cesium.Cartesian3.subtract(viewDirection, verticalComponent, new window.Cesium.Cartesian3());
            window.Cesium.Cartesian3.normalize(horizontalDirection, horizontalDirection);

            // 5. 헤딩 각도 계산
            const tempCamera = new window.Cesium.Camera(viewerRef.current.scene);
            tempCamera.position = presetPosition;
            tempCamera.direction = horizontalDirection;
            tempCamera.up = surfaceNormal;

            let heading = tempCamera.heading;
            heading = window.Cesium.Math.toDegrees(heading);
            if (heading < 0) {
                heading += 360;
            }

            // 6. 프리셋 위치로 카메라 설정 (창가뷰 실행)
            const presetCartographic = window.Cesium.Ellipsoid.WGS84.cartesianToCartographic(presetPosition);
            const cameraView = {
                longitude: window.Cesium.Math.toDegrees(presetCartographic.longitude),
                latitude: window.Cesium.Math.toDegrees(presetCartographic.latitude),
                height: presetCartographic.height + 1.5, // 사람 눈높이 추가
                heading: heading,
                pitch: 0, // 수평 시선
                roll: 0
            };

            console.log('📹 창가뷰 카메라 설정:', cameraView);
            viewerRef.current._setCameraView(cameraView);
            console.log('✅ 창가뷰 실행 완료');

        } catch (error) {
            console.error('❌ 창가뷰 실행 실패:', error);
        }
    }, []);

    // ☀️ 프리셋 위치에서 음영분석 자동 실행
    const executeShadeAnalysisAtPreset = useCallback(async (preset: { lat: number; lon: number; dong: string; ho: string }) => {
        console.log('☀️ 프리셋에서 음영분석 자동 실행:', preset);

        if (!viewerRef.current || !window.Cesium) {
            console.warn('⚠️ Viewer 또는 Cesium이 준비되지 않음');
            return;
        }

        try {
            // 1. 먼저 해당 위치로 카메라 이동
            flyToLocation(preset.lat, preset.lon);

            // 2. 카메라 이동 완료 후 음영분석 자동 실행
            setTimeout(async () => {
                console.log('☀️ 음영분석 자동 시작');

                // 다른 모드들 비활성화
                if (isWindowViewMode) setIsWindowViewMode(false);
                if (isFirstPersonMode) setIsFirstPersonMode(false);
                if (isStreetViewActive) setIsStreetViewActive(false);

                // 프리셋 좌표를 Cesium Cartesian3로 변환 (저장된 높이 사용)
                const actualHeight = (preset as any).height || 50; // preset에 height가 있으면 사용, 없으면 기본값 50
                const position = window.Cesium.Cartesian3.fromDegrees(preset.lon, preset.lat, actualHeight);

                console.log(`✅ 기존 방식: 높이 ${actualHeight}m에서 음영분석 실행`);

                // 프리셋 위치에서 직접 음영분석 실행 (position 직접 전달)
                const options = {
                    position: position, // 직접 위치 전달
                    interval: 15,
                    useStoredPosition: false // 새 위치 사용
                };

                await startShadeAnalysis(options);
                setHasShadeResult(true);
                setLastShadeOptions(options);

                console.log('✅ 프리셋 위치에서 음영분석 실행 완료');
            }, 1500); // 카메라 이동 완료를 위한 지연

        } catch (error) {
            console.error('❌ 프리셋 음영분석 실행 실패:', error);
        }
    }, [flyToLocation, startShadeAnalysis, isWindowViewMode, isFirstPersonMode, isStreetViewActive]);

    // 🆕 프리셋 ID 기반 음영분석 실행 (저장된 높이 사용)
    const executeShadeAnalysisAtPresetById = useCallback(async (presetId: number) => {
        console.log('☀️ ID 기반 음영분석 실행:', presetId);

        // 1. 프리셋 데이터 조회
        let presetData = null;
        try {
            const response = await fetch(`/api/preset-points/by-id/${presetId}`);
            const result = await response.json();

            if (result.success) {
                presetData = result.data;
                console.log('📍 프리셋 데이터 조회 성공:', presetData);
            } else {
                throw new Error(`프리셋 조회 실패: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ 프리셋 데이터 조회 실패:', error);
            return;
        }

        if (!viewerRef.current || !window.Cesium) {
            console.warn('⚠️ Viewer 또는 Cesium이 준비되지 않음');
            return;
        }

        try {
            // 2. 해당 위치로 카메라 이동
            flyToLocation(presetData.lat, presetData.lon);

            // 3. 카메라 이동 완료 후 음영분석 자동 실행 (저장된 높이 사용)
            setTimeout(async () => {
                console.log('☀️ 저장된 높이로 음영분석 자동 시작:', {
                    lat: presetData.lat,
                    lon: presetData.lon,
                    height: presetData.height || 50 // 저장된 높이 사용, 없으면 기본값 50
                });

                // 다른 모드들 비활성화
                if (isWindowViewMode) setIsWindowViewMode(false);
                if (isFirstPersonMode) setIsFirstPersonMode(false);
                if (isStreetViewActive) setIsStreetViewActive(false);

                // 🔥 저장된 실제 높이 사용
                const actualHeight = presetData.height || 50;
                const position = window.Cesium.Cartesian3.fromDegrees(presetData.lon, presetData.lat, actualHeight);

                console.log(`✅ 실제 높이 ${actualHeight}m에서 음영분석 실행`);

                // 프리셋 위치에서 직접 음영분석 실행 (저장된 높이로)
                const options = {
                    position: position, // 실제 높이로 위치 설정
                    interval: 15,
                    useStoredPosition: false // 새 위치 사용
                };

                await startShadeAnalysis(options);
                setHasShadeResult(true);
                setLastShadeOptions(options);

                console.log(`✅ 프리셋 ID ${presetId} 위치(높이: ${actualHeight}m)에서 음영분석 실행 완료`);
            }, 1500); // 카메라 이동 완료를 위한 지연

        } catch (error) {
            console.error('❌ ID 기반 프리셋 음영분석 실행 실패:', error);
        }
    }, [flyToLocation, startShadeAnalysis, isWindowViewMode, isFirstPersonMode, isStreetViewActive]);

    // useImperativeHandle을 사용하여 외부에서 함수 호출 가능하도록 설정 (한번만 실행)
    useEffect(() => {
        if (window && !window.MapPrime3DNavigator) {
            window.MapPrime3DNavigator = {
                navigateToPreset,
                executeWindowViewAtPreset,
                executeShadeAnalysisAtPreset,
                executeShadeAnalysisAtPresetById // 🆕 ID 기반 음영분석 추가
            };
        } else if (window.MapPrime3DNavigator) {
            // 이미 존재하면 함수들만 업데이트
            window.MapPrime3DNavigator.navigateToPreset = navigateToPreset;
            window.MapPrime3DNavigator.executeWindowViewAtPreset = executeWindowViewAtPreset;
            window.MapPrime3DNavigator.executeShadeAnalysisAtPreset = executeShadeAnalysisAtPreset;
            window.MapPrime3DNavigator.executeShadeAnalysisAtPresetById = executeShadeAnalysisAtPresetById; // 🆕 ID 기반 음영분석 추가
        }
    }, [navigateToPreset, executeWindowViewAtPreset, executeShadeAnalysisAtPreset, executeShadeAnalysisAtPresetById]);

    // 🔧 포인트 생성 모드에서 지도 클릭 처리
    const handlePointCreation = async (lat: number, lon: number, height: number = 0) => {
        try {
            console.log('📍 포인트 생성 클릭:', { lat, lon, height });

            // 좌표 유효성 검증
            if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
                console.error('❌ 유효하지 않은 좌표:', { lat, lon });
                alert('유효하지 않은 좌표입니다.');
                return;
            }

            // 서울 범위 대략 확인 (위도: 37.4-37.7, 경도: 126.8-127.2)
            if (lat < 37.4 || lat > 37.7 || lon < 126.8 || lon > 127.2) {
                console.warn('⚠️ 서울 범위를 벗어난 좌표:', { lat, lon });
            }

            // 1. 기존 지도 클릭 API로 아파트 정보 감지 시도
            console.log(`🌐 1차 API 호출: /api/search/nearest?lat=${lat}&lng=${lon}`);
            let response = await fetch(`/api/search/nearest?lat=${lat}&lng=${lon}`);
            let result = null;

            if (response.ok) {
                result = await response.json();
                console.log('🏠 1차 API 응답:', result);
            }

            // 2. 1차 API 실패 시 좌표 기반 아파트 검색으로 fallback
            if (!result || result.error || !result.id) {
                console.log('⚠️ 1차 API 실패, fallback 아파트 검색 시도');

                try {
                    console.log(`🔍 2차 API 호출: /api/search/find-nearest-apartment?lat=${lat}&lng=${lon}`);
                    const fallbackResponse = await fetch(`/api/search/find-nearest-apartment?lat=${lat}&lng=${lon}`);

                    if (fallbackResponse.ok) {
                        const fallbackResult = await fallbackResponse.json();
                        console.log('🏠 2차 API 응답:', fallbackResult);

                        if (fallbackResult.success && fallbackResult.data) {
                            result = fallbackResult.data; // fallback 결과를 사용
                            console.log(`✅ Fallback 성공: ${result.apt_nm} (거리: ${result.distance_meters}m)`);
                        }
                    }
                } catch (fallbackError) {
                    console.warn('⚠️ Fallback API 호출 실패:', fallbackError);
                }
            }

            // 3. 두 API 모두 실패한 경우
            if (!result || (!result.id && !result.data?.id)) {
                console.error('❌ 모든 아파트 감지 API 실패');
                const userConfirm = confirm(
                    '이 위치에서 아파트를 자동으로 감지할 수 없습니다.\n' +
                    '그래도 프리셋 포인트를 생성하시겠습니까?\n' +
                    '(나중에 수동으로 아파트를 연결해야 할 수 있습니다)'
                );

                if (!userConfirm) {
                    return; // 사용자가 취소한 경우
                }

                // 아파트 정보 없이 진행
                result = {
                    apt_nm: '',
                    jibun_address: '',
                    id: null,
                    distance_meters: null
                };
            }

            // 2. 포인트 추가 정보 입력 모달 표시
            setNewPointData({
                lat,
                lon,
                height,
                detectedApt: result || null, // result가 단일 객체로 반환됨
                dong: '',
                ho: '',
                exclu_use_ar: ''
            });
            setShowPointInputModal(true);
            setIsPointCreationMode(false); // 클릭 후 모드 해제

        } catch (error) {
            console.error('❌ 아파트 정보 감지 실패:', error);
            alert(`아파트 정보를 가져오는데 실패했습니다: ${error.message}`);
        }
    };

    // 🔧 프리셋 포인트 저장
    const handleSavePresetPoint = async (pointData: any) => {
        try {
            console.log('💾 프리셋 포인트 저장:', pointData);

            const response = await fetch('/api/preset-points/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lat: pointData.lat,
                    lon: pointData.lon,
                    dong: pointData.dong,
                    ho: pointData.ho,
                    exclu_use_ar: pointData.exclu_use_ar,
                    apt_nm: pointData.detectedApt?.apt_nm || null,
                    jibun_address: pointData.detectedApt?.jibun_address || null,
                    apt_id: pointData.detectedApt?.id || null, // 아파트 ID 추가
                    floorplan_image_url: pointData.floorplan_image_url || null // 평면도 URL 추가
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ 프리셋 포인트 저장 성공:', result.data);
                setShowPointInputModal(false);
                setNewPointData(null);

                // 저장된 포인트 목록 새로고침 (현재 선택된 아파트 기준)
                loadPresetPoints(selectedApt?.id);

                alert('프리셋 포인트가 저장되었습니다!');
            } else {
                console.error('❌ 프리셋 포인트 저장 실패:', result.error);

                // 409 Conflict (중복) 에러인 경우 특별한 메시지 표시
                if (response.status === 409) {
                    alert(`⚠️ 중복 포인트: ${result.error}\n\n기존 포인트를 수정하거나 다른 호수를 선택해주세요.`);
                } else {
                    alert(`저장에 실패했습니다: ${result.error}`);
                }
            }

        } catch (error) {
            console.error('❌ 프리셋 포인트 저장 중 오류:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };


    // 🔧 글로벌 호버/클릭 핸들러 함수들
    const setupGlobalHandlers = () => {
        // 글로벌 말풍선 HTML 생성 함수
        window.createSpeechBubbleLabelHtml = (point: any) => {
            const areaText = point.exclu_use_ar ? `${point.exclu_use_ar}㎡` : '';
            const dongText = point.dong || '';
            const hoText = point.ho || '';

            // 기본 말풍선 라벨만 제공
            return `
                <div class="speech-bubble"
                     data-point-id="${point.id || 'unknown'}"
                     onclick="window.handlePresetPointClick && window.handlePresetPointClick('${point.id}')"
                     style="
                    position: absolute;
                    background-color: #00d4dd;
                    color: white;
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: bold;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    min-width: 90px;
                    cursor: pointer;
                    user-select: none;
                    transition: all 0.2s ease;
                    transform: translate(-50%, -80%);
                    left: 50%;
                    bottom: 2px;
                ">
                    <div style="font-size: 15px; font-weight: bold; line-height: 1.2;">${dongText} ${hoText}</div>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 3px;">${areaText}</div>
                    <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #00d4dd;"></div>
                </div>
            `;
        };

        // 호버 핸들러 제거 - 클릭 이벤트만 사용

        window.handlePresetPointClick = async (pointId: string) => {
            // 포인트 데이터 찾기
            let point = pointLabelsData.get(pointId) ||
                       Array.from(pointLabelsData.values()).find(p => String(p.id) === pointId) ||
                       Array.from(pointLabelsData.values()).find(p => `${p.dong}-${p.ho}` === pointId);

            if (!point) {
                console.error('포인트를 찾을 수 없습니다:', pointId);
                return;
            }

            console.log('🏠 프리셋 포인트 클릭됨:', point);

            // 확장카드 미리보기 탭 열기 (클로저를 통해 onPresetPointSelect 접근)
            if (typeof onPresetPointSelect === 'function') {
                onPresetPointSelect(point);
            } else {
                console.warn('⚠️ onPresetPointSelect 콜백이 정의되지 않았습니다');
            }
        };
    };

    // 🔧 저장된 프리셋 포인트들 로딩 (스마트 필터링)
    const loadPresetPoints = async (aptId?: number) => {
        try {
            console.log('📍 프리셋 포인트 목록 로딩...', { aptId });

            // 선택된 아파트가 있으면 해당 아파트의 프리셋만, 없으면 전체 조회
            const url = aptId
                ? `/api/preset-points/by-apartment/${aptId}`
                : '/api/preset-points/list';

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                console.log(`✅ 프리셋 포인트 ${result.data.length}개 로딩 완료 (아파트 ID: ${aptId || '전체'})`);
                setPresetPoints(result.data);


                // 3D 지도에 포인트들 표시
                if (viewerRef.current && result.data.length > 0) {
                    displayPointsOnMap(result.data);
                } else if (result.data.length === 0) {
                    // 포인트가 없으면 기존 포인트들 제거
                    clearPointsFromMap();
                }
            } else {
                console.error('❌ 프리셋 포인트 로딩 실패:', result.error);
                setPresetPoints([]);
                clearPointsFromMap();
            }

        } catch (error) {
            console.error('❌ 프리셋 포인트 로딩 중 오류:', error);
            setPresetPoints([]);
            clearPointsFromMap();
        }
    };

    // 🗑️ createHTMLLabel 함수 제거 - addHTMLLabelForPoint로 대체


    // 🗑️ expandLabelText, collapseLabelText 함수 제거 - HTML 라벨로 대체

    // 🆕 MapPrime3D _createDivPoint를 사용한 청록색 라벨 생성
    const addMapPrimeDivPoint = (point: any, position: any) => {
        const pointId = `${point.dong}-${point.ho}`;

        // 포인트 데이터를 여러 키로 저장 (다양한 방법으로 접근 가능하도록)
        pointLabelsData.set(String(point.id), point);  // ID로 저장
        pointLabelsData.set(pointId, point);  // "동-호"로 저장

        try {
            // MapPrime3D의 _createDivPoint 사용
            if (viewerRef.current && viewerRef.current._createDivPoint) {
                const divPoint = viewerRef.current._createDivPoint({
                    name: pointId,
                    position: [point.lon, point.lat, point.height || 50], // [경도, 위도, 높이]
                    html: window.createSpeechBubbleLabelHtml(point),
                    maxVisibleDistance: 5000, // 5km까지 표시
                });

                // 글로벌 핸들러로 이벤트 처리됨 (HTML onmouseenter/onmouseleave/onclick)
            } else {
                console.error('❌ MapPrime3D _createDivPoint 메서드를 찾을 수 없습니다');
            }
        } catch (error) {
            console.error(`❌ 말풍선 DivPoint 생성 실패 (${pointId}):`, error);
        }
    };

    // 🗑️ HTML 라벨 확장/축소 함수 제거 - MapPrime3D DivPoint로 대체

    // 🔧 3D 지도에서 모든 포인트 제거
    const clearPointsFromMap = () => {
        if (!viewerRef.current) return;

        try {
            console.log('🧹 3D 지도에서 프리셋 포인트들 제거');

            // MapPrime3D DivPoint 제거
            if (viewerRef.current && viewerRef.current._removeDivPoint) {
                // 모든 프리셋 DivPoint 제거
                presetPoints.forEach(point => {
                    const pointId = `${point.dong}-${point.ho}`;
                    try {
                        viewerRef.current._removeDivPoint(pointId);
                        console.log(`🗑️ DivPoint 제거: ${pointId}`);
                    } catch (error) {
                        console.warn(`⚠️ DivPoint 제거 실패: ${pointId}`, error);
                    }
                });
            }

            // 🗑️ 기존 HTML 라벨 제거 로직 제거됨

            // DOM에서 남아있는 프리셋 라벨들도 제거
            const existingLabels = document.querySelectorAll('[class*="mapprime-preset-label"]');
            existingLabels.forEach(label => {
                if (label.parentNode) {
                    label.parentNode.removeChild(label);
                }
            });

            // 프리셋 포인트 entities 제거
            const entitiesToRemove = [];
            for (let i = 0; i < viewerRef.current.entities.values.length; i++) {
                const entity = viewerRef.current.entities.values[i];
                if (entity.name && entity.name.includes('프리셋_')) {
                    entitiesToRemove.push(entity);
                }
            }

            entitiesToRemove.forEach(entity => {
                viewerRef.current.entities.remove(entity);
                console.log(`🗑️ 제거된 포인트: ${entity.name}`);
            });

            console.log(`✅ 총 ${entitiesToRemove.length}개 프리셋 포인트 제거 완료`);
        } catch (error) {
            console.error('❌ 포인트 제거 중 오류:', error);
        }
    };

    // 🔧 3D 지도에 포인트들 표시
    const displayPointsOnMap = (points: any[]) => {
        if (!viewerRef.current) {
            console.log('⚠️ 뷰어가 준비되지 않음');
            return;
        }

        // 먼저 기존 포인트들 제거
        clearPointsFromMap();

        if (points.length === 0) {
            console.log('📍 표시할 포인트가 없음');
            return;
        }

        try {
            console.log(`🗺️ 3D 지도에 ${points.length}개 포인트 표시 시작`);
            console.log('📍 포인트 데이터:', points);

            // 좌표 유효성 검증
            const validPoints = points.filter(p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon));
            console.log(`✅ 유효한 포인트: ${validPoints.length}개`);

            if (validPoints.length === 0) {
                console.log('❌ 유효한 포인트가 없음');
                return;
            }

            // Cesium이 로드되었는지 확인
            if (!window.Cesium) {
                console.error('❌ Cesium 라이브러리가 로드되지 않음');
                return;
            }

            // 각 포인트를 3D 지도에 표시 (상세 정보 포함)
            validPoints.forEach((point, index) => {
                try {
                    console.log(`📍 포인트 ${index + 1} 표시: (${point.lat}, ${point.lon})`);

                    // 지형 높이를 자동으로 계산하여 표시 (고정 높이 사용 안함)
                    const position = window.Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 50); // 지면에서 50m 위;

                    // 상세 라벨 텍스트 생성
                    const areaText = point.exclu_use_ar ? `${point.exclu_use_ar}㎡` : '';
                    const priceText = point.recent_deal_amount ? `${point.recent_deal_amount}만원` : '';
                    const floorplanText = point.floorplan_image_url ? ' 📋' : '';

                    const detailText = [areaText, priceText].filter(t => t).join(' | ');
                    const fullLabelText = `${point.dong} ${point.ho}${floorplanText}\n${detailText}`;

                    // Cesium Entity를 직접 생성하여 포인트 표시 (스크린샷과 동일한 디자인)
                    const entity = {
                        name: `프리셋_${point.dong}_${point.ho}`,
                        position: position,
                        // 확장된 포인트 속성 저장
                        properties: {
                            id: point.id, // 프리셋 포인트의 실제 ID 추가
                            dong: point.dong,
                            ho: point.ho,
                            exclu_use_ar: point.exclu_use_ar,
                            recent_deal_amount: point.recent_deal_amount,
                            floorplan_image_url: point.floorplan_image_url,
                            apt_nm: point.apt_nm,
                            jibun_address: point.jibun_address
                        },
                        // 🗑️ 노란 점 제거 - 라벨만 표시
                        // 라벨 제거 - 새로운 청록색 라벨 시스템으로 대체
                        label: {
                            show: false // 기존 라벨 완전히 숨김
                        }
                    };

                    // 뷰어의 entities에 추가
                    const addedEntity = viewerRef.current.entities.add(entity);
                    console.log(`✅ 포인트 ${index + 1} 표시 완료:`, addedEntity.name);

                    // 🆕 MapPrime3D DivPoint로 청록색 라벨 추가
                    addMapPrimeDivPoint(point, position);

                } catch (error) {
                    console.error(`❌ 포인트 ${index + 1} 표시 실패:`, error);
                }
            });

            console.log(`🎯 총 ${validPoints.length}개 프리셋 포인트 표시 완료`);

            // HTML 라벨에서 이벤트를 직접 처리하므로 registerPointEvents 제거

        } catch (error) {
            console.error('❌ 포인트 표시 실패:', error);
            console.error('상세 오류:', error.stack);
        }
    };

    // 🗑️ registerPointEvents 함수 제거 - HTML 라벨에서 직접 이벤트 처리

    // 🔧 클릭 위치에서 포인트 찾기
    const findPointByPosition = (screenPosition: any, points: any[]) => {
        try {
            // 화면 좌표를 3D 월드 좌표로 변환
            const pickedPosition = viewerRef.current.camera.pickEllipsoid(
                screenPosition,
                viewerRef.current.scene.globe.ellipsoid
            );

            if (!pickedPosition) return null;

            const cartographic = window.Cesium.Cartographic.fromCartesian(pickedPosition);
            const clickLat = window.Cesium.Math.toDegrees(cartographic.latitude);
            const clickLon = window.Cesium.Math.toDegrees(cartographic.longitude);

            // 가장 가까운 포인트 찾기 (100m 내)
            const tolerance = 0.001; // 약 100m

            return points.find(point => {
                const latDiff = Math.abs(point.lat - clickLat);
                const lonDiff = Math.abs(point.lon - clickLon);
                return latDiff < tolerance && lonDiff < tolerance;
            });

        } catch (error) {
            console.error('❌ 포인트 위치 찾기 실패:', error);
            return null;
        }
    };

    // 🔧 포인트 정보 팝업 표시 (포인트 정확한 위치에)
    const showPointInfoPopup = (point: any, entity?: any) => {
        console.log('📋 포인트 정보 팝업 표시:', point);

        // Entity가 있으면 실제 포인트 위치로, 없으면 마우스 위치로
        let screenPosition;
        if (entity && entity.position) {
            try {
                // 3D 월드 좌표를 화면 좌표로 변환
                const worldPosition = entity.position.getValue(viewerRef.current.clock.currentTime);
                screenPosition = window.Cesium.SceneTransforms.wgs84ToWindowCoordinates(
                    viewerRef.current.scene,
                    worldPosition
                );

                if (!screenPosition) {
                    // 변환 실패시 화면 중앙에 표시
                    screenPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                }
            } catch (error) {
                console.warn('포인트 위치 변환 실패:', error);
                screenPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            }
        } else {
            // 마우스 위치 사용
            screenPosition = point.screenPosition || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }

        setSelectedPointInfo({
            ...point,
            screenPosition: {
                x: screenPosition.x,
                y: screenPosition.y - 60 // 포인트 위쪽에 표시
            }
        });
    };

    // 🔧 평면도 모달 열기
    const openFloorplanModal = (imageUrl: string) => {
        console.log('📋 평면도 모달 열기:', imageUrl);
        setFloorplanImageUrl(imageUrl);
        setShowFloorplanModal(true);
        setSelectedPointInfo(null); // 팝업 닫기
    };

    // 🔧 프리셋 라벨 토글 기능
    const togglePresetLabels = () => {
        const newShowLabels = !showPresetLabels;
        setShowPresetLabels(newShowLabels);

        // 기존 entities의 label 가시성 업데이트
        if (viewerRef.current) {
            viewerRef.current.entities.values.forEach((entity: any) => {
                if (entity.name && entity.name.includes('프리셋_') && entity.label) {
                    entity.label.show = newShowLabels;
                }
            });
        }

        console.log(`🏷️ 프리셋 라벨 토글: ${newShowLabels ? '표시' : '숨김'}`);
    };

    // ✅ 뷰어 한 번만 생성 관리 (파괴하지 않음)
    useEffect(() => {
        // 뷰어가 이미 있거나 보이지 않으면 생성하지 않음
        if (viewerRef.current || !isVisible) {
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
    }, [isVisible]);

    // 🔧 포인트 생성 모드 클릭 이벤트 처리
    useEffect(() => {
        if (!viewerRef.current || !isPointCreationMode) return;

        console.log('📍 포인트 생성 모드 활성화');

        const handler = viewerRef.current.cesiumWidget.screenSpaceEventHandler;

        const clickHandler = (event: any) => {
            // 더 정확한 3D 좌표 추출을 위해 여러 방법 시도
            let position = null;

            // 1. 먼저 scene.pick으로 3D 객체 위의 점을 시도
            const pickedObject = viewerRef.current.scene.pick(event.position);
            if (pickedObject) {
                const cartesian = viewerRef.current.scene.pickPosition(event.position);
                if (cartesian) {
                    position = cartesian;
                    console.log('🎯 3D 객체 표면에서 좌표 추출');
                }
            }

            // 2. 실패하면 지구 표면 교차점으로 폴백
            if (!position) {
                position = viewerRef.current.camera.pickEllipsoid(
                    event.position,
                    viewerRef.current.scene.globe.ellipsoid
                );
                console.log('🌍 지구 표면 교차점에서 좌표 추출');
            }

            if (position) {
                const cartographic = window.Cesium.Cartographic.fromCartesian(position);
                const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
                const lon = window.Cesium.Math.toDegrees(cartographic.longitude);
                const height = cartographic.height;

                console.log('📍 추출된 정확한 좌표:', {
                    lat: lat.toFixed(10),
                    lon: lon.toFixed(10),
                    height: height.toFixed(2)
                });

                handlePointCreation(lat, lon, height);
            } else {
                console.warn('⚠️ 클릭 위치에서 좌표를 추출할 수 없습니다');
            }
        };

        handler.setInputAction(clickHandler, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);

        return () => {
            handler.removeInputAction(window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
        };
    }, [isPointCreationMode]);

    // 🔧 글로벌 핸들러 초기화
    useEffect(() => {
        setupGlobalHandlers();
        return () => {
            // 컴포넌트 언마운트 시 글로벌 함수 정리
            delete window.handlePresetPointHover;
            delete window.handlePresetPointClick;
            delete window.createSpeechBubbleLabelHtml;
        };
    }, [onPresetPointSelect, pointLabelsData]); // onPresetPointSelect와 pointLabelsData 변경 시 핸들러 재설정

    // 🔧 통합된 프리셋 포인트 로딩 (중복 호출 방지)
    useEffect(() => {
        if (viewerRef.current && !isLoading && !error) {
            if (isDeveloperMode) {
                console.log('🔧 개발자 모드: 전체 프리셋 포인트 로딩');
                loadPresetPoints(); // 전체 프리셋 표시
            } else if (selectedApt?.id) {
                console.log('🏠 선택된 아파트의 프리셋 포인트 로딩:', selectedApt.id);
                loadPresetPoints(selectedApt.id);
            }
        }
    }, [viewerRef.current, isLoading, error, isDeveloperMode, selectedApt?.id]);

    // ✅ 카메라 이동 및 하이라이트 처리 (selectedLocation 변경 시)
    useEffect(() => {
        // isVisible이 false일 때는 처리하지 않음 (POI 호버 시 불필요한 처리 방지)
        if (!isVisible) {
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
    }, [isVisible, selectedLocation, highlightApartment, clearHighlight, isLoading, error]);

    if (!isVisible) return null;

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

                    {/* X 닫기 버튼 - 3D 메인 모드가 아닐 때만 표시, 가장 오른쪽 위치 */}
                    {mapViewMode !== '3D' && (
                        <button
                            onClick={onClose}
                            className="bg-gray-500/90 hover:bg-gray-600 text-white rounded shadow-sm transition-all w-6 h-6 flex items-center justify-center text-xs"
                            title="닫기"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* 3D 지도 조작 버튼들 (3D 메인 모드에서만 표시, 하단 중앙 배치) */}
                {mapViewMode === '3D' && (
                    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-3 z-[300]">

                        {/* 메인 기능 버튼들 - 하단 중앙 가로 배치 */}
                        <div className="flex gap-2 flex-wrap justify-center">
                            {/* 🔧 개발자 모드 전용 포인트 생성 버튼 */}
                            {isDeveloperMode && (
                                <button
                                    className={`${isPointCreationMode
                                        ? "bg-purple-500 text-white border-purple-500"
                                        : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                        } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm`}
                                    onClick={() => {
                                        console.log('📍 포인트 생성 모드 토글:', !isPointCreationMode);
                                        setIsPointCreationMode(!isPointCreationMode);

                                        // 다른 모드들과 충돌 방지
                                        if (!isPointCreationMode) {
                                            if (isWindowViewMode) setIsWindowViewMode(false);
                                            if (isFirstPersonMode) setIsFirstPersonMode(false);
                                            if (isAnalyzing) clearShadeAnalysis();
                                            if (isStreetViewActive) setIsStreetViewActive(false);
                                        }
                                    }}
                                    disabled={isLoading || !!error}
                                    title="프리셋 포인트 생성 모드"
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-base">📍</span>
                                        <span className="text-xs">포인트</span>
                                    </div>
                                </button>
                            )}

                            <button
                                className={`${isWindowViewMode
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm`}
                                onClick={() => {
                                    if (isAnalyzing) {
                                        console.log('🛑 음영분석 중단 중...');
                                        clearShadeAnalysis();
                                        setHasShadeResult(false);
                                        setLastShadeOptions(null);
                                    }
                                    if (isSkylineAnalyzing) {
                                        console.log('🛑 스카이라인 분석 중단 중...');
                                        clearSkylineAnalysis();
                                    }
                                    setIsWindowViewMode(!isWindowViewMode);
                                }}
                                disabled={isLoading || !!error}
                                title="창가 뷰 모드"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">🪟</span>
                                    <span className="text-xs">창가뷰</span>
                                </div>
                            </button>

                            {/* 🌆 스카이라인 분석 버튼 */}
                            <button
                                className={`${isSkylineAnalyzing
                                    ? "bg-purple-500 text-white border-purple-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm ${isSkylineAnalyzing ? "opacity-75 cursor-not-allowed" : ""
                                    }`}
                                onClick={async () => {
                                    if (isAnalyzing) {
                                        console.log('🛑 음영분석 중단 중...');
                                        clearShadeAnalysis();
                                        setHasShadeResult(false);
                                        setLastShadeOptions(null);
                                    }
                                    if (isWindowViewMode) {
                                        console.log('🛑 창가뷰 모드 비활성화 중...');
                                        setIsWindowViewMode(false);
                                        setTimeout(async () => {
                                            await startSkylineAnalysis();
                                        }, 100);
                                    } else {
                                        await startSkylineAnalysis();
                                    }
                                }}
                                disabled={isLoading || !!error || isSkylineAnalyzing}
                                title="스카이라인 분석"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">
                                        {isSkylineAnalyzing ? "⏳" : "🌆"}
                                    </span>
                                    <span className="text-xs">
                                        {isSkylineAnalyzing ? "분석중" : "스카이라인"}
                                    </span>
                                </div>
                            </button>

                            <button
                                className={`${isFirstPersonMode
                                    ? "bg-green-500 text-white border-green-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm`}
                                onClick={() => setIsFirstPersonMode(!isFirstPersonMode)}
                                disabled={isLoading || !!error}
                                title="1인칭 걷기 모드 (WASD)"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">🚶</span>
                                    <span className="text-xs">둘러보기</span>
                                </div>
                            </button>

                            {/* 🕐 시간 컨트롤러 버튼 */}
                            <button
                                className={`${showTimeController
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm`}
                                onClick={() => setShowTimeController(!showTimeController)}
                                disabled={isLoading || !!error}
                                title="시간 조작 (태양 위치 제어)"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">🕐</span>
                                    <span className="text-xs">시간</span>
                                </div>
                            </button>

                            {/* 🗺️ 로드뷰 버튼 */}
                            <button
                                className={`${isStreetViewActive
                                    ? "bg-indigo-500 text-white border-indigo-500"
                                    : streetViewHook.error.hasError
                                        ? "bg-red-100 hover:bg-red-200 border-red-300 text-red-700"
                                        : streetViewHook.isLoading
                                            ? "bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700"
                                            : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm`}
                                onClick={() => setIsStreetViewActive(!isStreetViewActive)}
                                disabled={isLoading || !!error}
                                title="네이버 로드뷰 (Cesium과 실시간 동기화)"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">🗺️</span>
                                    <span className="text-xs">로드뷰</span>
                                </div>
                            </button>

                            {/* ☀️ 음영분석 버튼 */}
                            <button
                                className={`${isAnalyzing
                                    ? "bg-orange-500 text-white border-orange-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-sm border backdrop-blur-sm ${isAnalyzing ? "opacity-75 cursor-not-allowed" : ""
                                    }`}
                                onClick={async () => {
                                    if (isWindowViewMode) {
                                        console.log('🛑 창가뷰 모드 비활성화 중...');
                                        setIsWindowViewMode(false);
                                        setTimeout(async () => {
                                            const options = { interval: 15 };
                                            await startShadeAnalysis(options);
                                            setLastShadeOptions(options);
                                            setHasShadeResult(true);
                                        }, 100);
                                    } else {
                                        const options = { interval: 15 };
                                        await startShadeAnalysis(options);
                                        setLastShadeOptions(options);
                                        setHasShadeResult(true);
                                    }
                                }}
                                disabled={isLoading || !!error || isAnalyzing}
                                title="음영분석"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">
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
                                    setHasShadeResult(false);
                                    setLastShadeOptions(null);
                                }}
                                disabled={isLoading || !!error}
                                title="음영분석 결과 초기화"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">🧹</span>
                                    <span className="text-xs">초기화</span>
                                </div>
                            </button>

                            {/* ☀️ 계절별 일조시간 비교 버튼 */}
                            <button
                                className={`${showSunlightComparisonPopup
                                    ? "bg-orange-600 text-white border-orange-600"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-3 py-2 text-xs border backdrop-blur-sm`}
                                onClick={async () => {
                                    // 음영분석 데이터가 있으면 계절별 비교 팝업 표시
                                    if (hasShadeResult) {
                                        if (!showSunlightComparisonPopup) {
                                            console.log('🌅 일조시간 분석 데이터 생성 중...');
                                            try {
                                                const sunlightData = await generateSeasonalComparisonData();
                                                setSunlightComparisonData(sunlightData);
                                                setShowSunlightComparisonPopup(true);
                                                console.log('✅ 일조시간 분석 팝업 열기 완료:', sunlightData);
                                            } catch (error) {
                                                console.error('❌ 일조시간 분석 데이터 생성 실패:', error);
                                                alert('일조시간 분석 데이터를 생성하는데 실패했습니다.');
                                            }
                                        } else {
                                            setShowSunlightComparisonPopup(false);
                                        }
                                    } else {
                                        alert('먼저 음영분석을 실행해주세요.');
                                    }
                                }}
                                disabled={isLoading || !!error || !hasShadeResult}
                                title="계절별 일조시간 비교표"
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-base">📊</span>
                                    <span className="text-xs">일조표</span>
                                </div>
                            </button>

                            {/* 🏷️ 프리셋 라벨 토글 버튼 */}
                            {isDeveloperMode && (
                                <button
                                    className={`${showPresetLabels
                                        ? "bg-green-500 text-white border-green-500"
                                        : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                        } rounded-lg shadow-md transition-all px-3 py-2 text-xs border backdrop-blur-sm`}
                                    onClick={togglePresetLabels}
                                    disabled={isLoading || !!error}
                                    title="프리셋 포인트 라벨 표시/숨김"
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-base">🏷️</span>
                                        <span className="text-xs">라벨</span>
                                    </div>
                                </button>
                            )}
                        </div>

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

            {/* 포인트 생성 모드 가이드 메시지 */}
            {isPointCreationMode && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">📍</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium">포인트 생성 모드</p>
                            <p className="text-xs opacity-90">건물 표면을 클릭하여 프리셋 포인트를 생성하세요</p>
                        </div>
                        <button
                            onClick={() => setIsPointCreationMode(false)}
                            className="text-white/80 hover:text-white text-lg ml-2"
                            title="포인트 생성 모드 해제"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* 로드뷰 모드 가이드 메시지 */}
            {isStreetViewActive && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-indigo-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🗺️</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium">로드뷰 모드</p>
                            <p className="text-xs opacity-90">3D 지도를 클릭하거나 걷기 모드로 실시간 동기화됩니다</p>
                        </div>
                        <button
                            onClick={() => setIsStreetViewActive(false)}
                            className="text-white/80 hover:text-white text-lg ml-2"
                            title="로드뷰 모드 해제"
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

            {/* 스카이라인 분석 가이드 메시지 (분석 중일 때만) */}
            {isSkylineAnalyzing && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">🌆</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium">스카이라인 분석</p>
                            <p className="text-xs opacity-90">지도를 클릭하여 스카이라인 분석할 지점을 선택하세요</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 포인트 정보 팝업 (스크린샷과 동일한 초록색 그라데이션 디자인) */}
            {selectedPointInfo && (
                <div
                    className="fixed bg-gradient-to-br from-teal-400 to-cyan-500 text-white shadow-xl rounded-lg p-3 z-[600] min-w-[180px] max-w-[250px]"
                    style={{
                        left: Math.max(10, Math.min(selectedPointInfo.screenPosition.x - 90, window.innerWidth - 260)),
                        top: Math.max(10, selectedPointInfo.screenPosition.y)
                    }}
                >
                    {/* 메인 정보 (동호수와 면적) */}
                    <div className="text-center mb-2">
                        <div className="font-bold text-lg">
                            {selectedPointInfo.dong} {selectedPointInfo.ho}
                        </div>
                        {selectedPointInfo.exclu_use_ar && (
                            <div className="text-sm opacity-90">
                                {selectedPointInfo.exclu_use_ar}㎡
                            </div>
                        )}
                    </div>

                    {/* 실거래가 정보 */}
                    {selectedPointInfo.recent_deal_amount && (
                        <div className="text-center text-sm opacity-90 mb-3">
                            최근 거래: {selectedPointInfo.recent_deal_amount}만원
                        </div>
                    )}

                    {/* 액션 버튼들 */}
                    <div className="space-y-1">
                        {selectedPointInfo.floorplan_image_url && (
                            <button
                                onClick={() => openFloorplanModal(selectedPointInfo.floorplan_image_url)}
                                className="w-full bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-2 rounded transition-colors backdrop-blur-sm"
                            >
                                📋 평면도 보기
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedPointInfo(null)}
                            className="w-full bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors backdrop-blur-sm"
                        >
                            닫기
                        </button>
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

            {/* 스카이라인 분석 에러 표시 */}
            {skylineError && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500/95 text-white px-6 py-3 rounded-lg shadow-xl z-[400] max-w-md">
                    <div className="flex items-center gap-3">
                        <span className="text-lg">⚠️</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium">스카이라인 분석 오류</p>
                            <p className="text-xs opacity-90">{skylineError}</p>
                        </div>
                        <button
                            onClick={() => clearSkylineError()}
                            className="text-white/80 hover:text-white text-lg ml-2"
                            title="오류 메시지 닫기"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* 🌆 스카이라인 분석 결과 모달 */}
            {showSkylineResult && skylineResult && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[500]">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto m-4">
                        {/* 모달 헤더 */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <span className="text-xl">🌆</span>
                                스카이라인 분석 결과
                            </h3>
                            <button
                                onClick={handleCloseSkylineResult}
                                className="text-gray-400 hover:text-gray-600 transition-colors text-xl"
                                title="닫기"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 모달 내용 */}
                        <div className="p-6 space-y-6">
                            {/* 지형 스카이라인 */}
                            {skylineResult.terrainSkyline && (
                                <div className="space-y-3">
                                    <h4 className="text-md font-medium text-gray-800 flex items-center gap-2">
                                        🏔️ 지형 스카이라인
                                    </h4>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <img
                                            src={skylineResult.terrainSkyline.image}
                                            alt="지형 스카이라인"
                                            className="w-full h-auto rounded border border-gray-200 mb-3"
                                        />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="bg-blue-100 p-3 rounded">
                                                <span className="font-medium text-blue-800">하늘 비율:</span>
                                                <span className="ml-2 text-blue-700">{skylineResult.terrainSkyline.skyRatio.toFixed(1)}%</span>
                                            </div>
                                            <div className="bg-green-100 p-3 rounded">
                                                <span className="font-medium text-green-800">땅 비율:</span>
                                                <span className="ml-2 text-green-700">{skylineResult.terrainSkyline.landRatio.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 전체 스카이라인 */}
                            {skylineResult.fullSkyline && (
                                <div className="space-y-3">
                                    <h4 className="text-md font-medium text-gray-800 flex items-center gap-2">
                                        🏙️ 전체 스카이라인 (건물 포함)
                                    </h4>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <img
                                            src={skylineResult.fullSkyline.image}
                                            alt="전체 스카이라인"
                                            className="w-full h-auto rounded border border-gray-200 mb-3"
                                        />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="bg-blue-100 p-3 rounded">
                                                <span className="font-medium text-blue-800">하늘 비율:</span>
                                                <span className="ml-2 text-blue-700">{skylineResult.fullSkyline.skyRatio.toFixed(1)}%</span>
                                            </div>
                                            <div className="bg-green-100 p-3 rounded">
                                                <span className="font-medium text-green-800">땅 비율:</span>
                                                <span className="ml-2 text-green-700">{skylineResult.fullSkyline.landRatio.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 분석 설명 */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    📊 <strong>스카이라인 분석:</strong> 선택한 지점에서 바라본 시야의 하늘과 땅(건물 포함)의 비율을 분석합니다.
                                    높은 하늘 비율은 더 넓은 개방감을 의미합니다.
                                </p>
                            </div>
                        </div>

                        {/* 모달 푸터 */}
                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                            <button
                                onClick={handleCloseSkylineResult}
                                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                            >
                                닫기
                            </button>
                        </div>
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

            {/* 🗺️ 네이버 로드뷰 팝업 (우측 하단) */}
            {isStreetViewActive && mapViewMode === '3D' && (
                <div
                    className="fixed bottom-4 right-4 bg-white shadow-xl rounded-lg border border-gray-200 z-30"
                    style={{ width: '360px', height: '280px' }}
                >
                    {/* 로드뷰 헤더 */}
                    <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-3 rounded-t-lg">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">🗺️ 네이버 로드뷰</span>
                            {streetViewHook.isInitialized && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                    연결됨
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsStreetViewActive(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="로드뷰 닫기"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* 로드뷰 컨테이너 */}
                    <div
                        id="street-view-container"
                        className="w-full bg-gray-100 rounded-b-lg"
                        style={{ height: 'calc(100% - 2.5rem)' }}
                    >
                        {/* 로딩 상태 */}
                        {streetViewHook.isLoading && (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 rounded-b-lg">
                                <div className="text-center">
                                    <div className="animate-spin w-8 h-8 mx-auto mb-2 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                                    <p className="text-xs">로드뷰 API 로드 중...</p>
                                    <p className="text-xs text-gray-400 mt-1">잠시만 기다려주세요</p>
                                </div>
                            </div>
                        )}

                        {/* 에러 상태 */}
                        {streetViewHook.error.hasError && !streetViewHook.isLoading && (
                            <div className="w-full h-full flex items-center justify-center text-red-500 rounded-b-lg">
                                <div className="text-center p-4">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 18.5c-.77.833-.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <p className="text-xs font-medium mb-1">로드뷰 로드 실패</p>
                                    <p className="text-xs text-gray-600 mb-2">{streetViewHook.error.errorMessage}</p>
                                    <button
                                        onClick={() => {
                                            streetViewHook.clearError();
                                            window.location.reload();
                                        }}
                                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                    >
                                        새로고침
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 초기화 대기 상태 */}
                        {!streetViewHook.isInitialized && !streetViewHook.isLoading && !streetViewHook.error.hasError && (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 rounded-b-lg">
                                <div className="text-center">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="text-xs">로드뷰 준비 완료</p>
                                    <p className="text-xs text-gray-400 mt-1">3D 지도 클릭 → 로드뷰 표시</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 로드뷰 정보 표시 (컴팩트) */}
                    {streetViewHook.isInitialized && streetViewHook.currentPosition && (
                        <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            <div className="flex justify-between items-center">
                                <div>📍 {streetViewHook.currentPosition.lat.toFixed(4)}, {streetViewHook.currentPosition.lng.toFixed(4)}</div>
                                <div className="text-blue-300">🔄 동기화</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* 🔧 포인트 정보 입력 모달 */}
        <PointInputModal
            isOpen={showPointInputModal}
            pointData={newPointData}
            onSave={handleSavePresetPoint}
            onClose={() => {
                setShowPointInputModal(false);
                setNewPointData(null);
            }}
        />

        {/* 🕐 시간 컨트롤러 */}
        {mapViewMode === '3D' && (
            <TimeController
                isVisible={showTimeController}
                onClose={() => setShowTimeController(false)}
                viewer={viewerRef.current}
                position={{ x: 100, y: 100 }}
            />
        )}

        {/* ☀️ 계절별 일조시간 비교 팝업 */}
        <SeasonalSunlightComparisonPopup
            isVisible={showSunlightComparisonPopup}
            onClose={() => setShowSunlightComparisonPopup(false)}
            sunlightData={sunlightComparisonData}
            position={{ x: 200, y: 150 }}
        />

        {/* 📋 평면도 이미지 모달 */}
        {showFloorplanModal && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[900]">
                {/* 모달 컨테이너 */}
                <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl max-h-[90vh] w-full mx-4">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            📋 평면도
                        </h3>
                        <button
                            onClick={() => setShowFloorplanModal(false)}
                            className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                            title="닫기"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 이미지 컨테이너 */}
                    <div className="p-4 flex items-center justify-center bg-gray-50 rounded-b-lg" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                        <img
                            src={floorplanImageUrl}
                            alt="평면도"
                            className="max-w-full max-h-full object-contain rounded shadow-lg"
                            style={{ maxHeight: 'calc(90vh - 120px)' }}
                            onError={(e) => {
                                console.error('평면도 이미지 로딩 실패:', floorplanImageUrl);
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23f3f4f6"/><text x="150" y="100" text-anchor="middle" fill="%236b7280" font-size="14" font-family="Arial">이미지를 불러올 수 없습니다</text></svg>';
                            }}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* 🎯 시야 범위 디버그 정보 (개발자 모드) */}
        {isDeveloperMode && cameraFrustumHook.frustum.isValid && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white text-xs p-2 rounded max-w-xs">
                <div className="font-medium mb-1">🎯 3D 시야 범위</div>
                <div>중심: {cameraFrustumHook.frustum.center.lat.toFixed(6)}, {cameraFrustumHook.frustum.center.lng.toFixed(6)}</div>
                <div>좌상: {cameraFrustumHook.frustum.topLeft.lat.toFixed(6)}, {cameraFrustumHook.frustum.topLeft.lng.toFixed(6)}</div>
                <div>우하: {cameraFrustumHook.frustum.bottomRight.lat.toFixed(6)}, {cameraFrustumHook.frustum.bottomRight.lng.toFixed(6)}</div>
                <div className="text-green-400 mt-1">미니맵에 실시간 반영됨</div>
            </div>
        )}

        {/* 🏠 평면도 팝업 */}
        {currentFloorplanData && (
            <FloorplanPopup
                isOpen={showFloorplanPopup}
                onClose={() => {
                    setShowFloorplanPopup(false);
                    setCurrentFloorplanData(null);
                }}
                title="평면도"
                floorplanImageUrl={currentFloorplanData.floorplanImageUrl}
                aptName={currentFloorplanData.aptName}
                dong={currentFloorplanData.dong}
                ho={currentFloorplanData.ho}
                exclu_use_ar={currentFloorplanData.exclu_use_ar}
            />
        )}

        {/* ☀️ 계절별 일조시간 비교 팝업 */}
        <SeasonalSunlightComparisonPopup
            isVisible={showSunlightComparisonPopup}
            onClose={() => setShowSunlightComparisonPopup(false)}
            sunlightData={sunlightComparisonData}
            position={{ x: 200, y: 150 }}
        />
        </>
    );
}
