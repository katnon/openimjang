import { useEffect, useRef, useState } from "react";
import { use3DEqbHighlight } from "@/hooks/use3DEqbHighlight";
import { useWindowView } from "@/hooks/useWindowView";
import { useFirstPersonLook } from "@/hooks/useFirstPersonLook";
import { useWalkingMode } from "@/hooks/useWalkingMode";
import { useShadeAnalysis, type SeasonPreset } from "@/hooks/useShadeAnalysis";
import { useResizable } from "@/hooks/useResizable";
import { useDeveloperMode } from "@/contexts/DeveloperModeProvider";
import PointInputModal from "@/components/map/PointInputModal";

declare global {
    interface Window {
        Cesium: any;
        MapPrime3DExtension: any;
        MapPrime3DNavigator?: {
            navigateToPreset: (preset: { lat: number; lon: number; dong: string; ho: string }) => void;
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
};

export default function MapPrime3DViewer({ isVisible, onClose, selectedLocation, selectedApt, mapViewMode = '2D', onToggleMapView, onPresetNavigated }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const prevLocationRef = useRef<{ lat: number, lon: number } | null>(null); // ✅ 이전 좌표 저장용
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWindowViewMode, setIsWindowViewMode] = useState(false);
    const [isFirstPersonMode, setIsFirstPersonMode] = useState(false);
    
    // 🔧 개발자 모드 관련 상태
    const { isDeveloperMode } = useDeveloperMode();
    const [isPointCreationMode, setIsPointCreationMode] = useState(false);
    const [presetPoints, setPresetPoints] = useState<any[]>([]);
    const [selectedPointInfo, setSelectedPointInfo] = useState<any>(null);
    const [showPointInputModal, setShowPointInputModal] = useState(false);
    const [newPointData, setNewPointData] = useState<any>(null);

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

    // 🆕 확장카드에서 프리셋 선택 시 카메라 이동 (외부 노출 함수)
    const navigateToPreset = (preset: { lat: number; lon: number; dong: string; ho: string }) => {
        console.log('🏠 프리셋으로 카메라 이동:', preset);
        flyToLocation(preset.lat, preset.lon);
        
        // 선택된 프리셋 정보를 부모에게 알림
        onPresetNavigated?.(preset);
        
        // 프리셋 선택 시 알림 메시지 (임시)
        setTimeout(() => {
            alert(`${preset.dong} ${preset.ho}로 카메라가 이동되었습니다.`);
        }, 1000);
    };

    // useImperativeHandle을 사용하여 외부에서 함수 호출 가능하도록 설정
    useEffect(() => {
        if (window && !window.MapPrime3DNavigator) {
            window.MapPrime3DNavigator = {
                navigateToPreset
            };
        }
    }, []);

    // 🔧 포인트 생성 모드에서 지도 클릭 처리
    const handlePointCreation = async (lat: number, lon: number) => {
        try {
            console.log('📍 포인트 생성 클릭:', { lat, lon });
            
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
            
            // 1. 기존 지도 클릭 API 재사용하여 아파트 정보 감지
            console.log(`🌐 API 호출: /api/search/nearest?lat=${lat}&lng=${lon}`);
            const response = await fetch(`/api/search/nearest?lat=${lat}&lng=${lon}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('🏠 API 응답:', result);
            
            if (result.error) {
                console.error('❌ API 에러:', result.error);
                alert(`아파트 감지 실패: ${result.error}`);
                return;
            }
            
            // 2. 포인트 추가 정보 입력 모달 표시
            setNewPointData({
                lat,
                lon,
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
                alert(`저장에 실패했습니다: ${result.error}`);
            }
            
        } catch (error) {
            console.error('❌ 프리셋 포인트 저장 중 오류:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
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

    // 🔧 3D 지도에서 모든 포인트 제거
    const clearPointsFromMap = () => {
        if (!viewerRef.current) return;
        
        try {
            console.log('🧹 3D 지도에서 프리셋 포인트들 제거');
            // TODO: MapPrime3D API를 사용하여 기존 포인트들 제거
            // 현재는 로그만 출력
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

            // 포인트 위치 계산
            const positions = validPoints.map(p => {
                const position = window.Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 100); // 높이 100m로 증가
                console.log(`📍 포인트 변환: (${p.lat}, ${p.lon}) → Cartesian3`);
                return position;
            });

            // MapPrime3D API 확인
            if (!viewerRef.current._createPoint) {
                console.error('❌ MapPrime3D _createPoint API가 없음');
                return;
            }
            
            // MapPrime3D _createPoint API 사용
            const createPointOptions = {
                positions: positions,
                color: '#ff0000', // 빨간색으로 변경하여 더 잘 보이게
                size: 25, // 크기 증가
                label: validPoints.map(p => p.apt_nm || '프리셋 포인트'),
                labelOption: validPoints.map(() => ({
                    pixelOffset: new window.Cesium.Cartesian2(0, -40),
                    font: '14px sans-serif',
                    fillColor: window.Cesium.Color.WHITE,
                    outlineColor: window.Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
                    backgroundColor: window.Cesium.Color.BLACK.withAlpha(0.7),
                    backgroundPadding: new window.Cesium.Cartesian2(8, 4)
                }))
            };

            console.log('📍 _createPoint 옵션:', createPointOptions);
            
            const entities = viewerRef.current._createPoint(createPointOptions);
            console.log('✅ _createPoint 결과:', entities);
            
            console.log('✅ 포인트 표시 완료');
            
            // 포인트 클릭 이벤트 등록
            registerPointClickEvents(validPoints);
            
        } catch (error) {
            console.error('❌ 포인트 표시 실패:', error);
            console.error('상세 오류:', error.stack);
        }
    };

    // 🔧 포인트 클릭 이벤트 등록
    const registerPointClickEvents = (points: any[]) => {
        if (!viewerRef.current) return;
        
        try {
            const handler = viewerRef.current.cesiumWidget.screenSpaceEventHandler;
            
            // 기존 클릭 핸들러와 충돌하지 않도록 별도로 처리
            const pointClickHandler = (event: any) => {
                // 포인트 생성 모드일 때는 무시
                if (isPointCreationMode) return;
                
                const pickedObject = viewerRef.current.scene.pick(event.position);
                
                if (pickedObject?.id) {
                    // 클릭된 포인트 찾기 (위치 기반으로 매칭)
                    const clickedPoint = findPointByPosition(event.position, points);
                    if (clickedPoint) {
                        showPointInfoPopup(clickedPoint, event.position);
                    }
                }
            };
            
            handler.setInputAction(pointClickHandler, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
            
        } catch (error) {
            console.error('❌ 포인트 클릭 이벤트 등록 실패:', error);
        }
    };

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

    // 🔧 포인트 정보 팝업 표시
    const showPointInfoPopup = (point: any, screenPosition: any) => {
        console.log('📋 포인트 정보 팝업 표시:', point);
        
        setSelectedPointInfo({
            ...point,
            screenPosition: {
                x: screenPosition.x,
                y: screenPosition.y - 80 // 포인트 위쪽에 표시
            }
        });
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
            const position = viewerRef.current.camera.pickEllipsoid(
                event.position, 
                viewerRef.current.scene.globe.ellipsoid
            );
            
            if (position) {
                const cartographic = window.Cesium.Cartographic.fromCartesian(position);
                const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
                const lon = window.Cesium.Math.toDegrees(cartographic.longitude);
                
                handlePointCreation(lat, lon);
            }
        };
        
        handler.setInputAction(clickHandler, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        return () => {
            handler.removeInputAction(window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
        };
    }, [isPointCreationMode]);

    // 🔧 뷰어 준비 시 프리셋 포인트 로딩
    useEffect(() => {
        if (viewerRef.current && !isLoading && !error) {
            loadPresetPoints();
        }
    }, [viewerRef.current, isLoading, error]);

    // 🔧 선택된 아파트 변경 시 해당 아파트의 프리셋 포인트만 로딩 (스마트 필터링)
    useEffect(() => {
        if (viewerRef.current && !isLoading && !error) {
            console.log('🏠 선택된 아파트 변경:', selectedApt);
            loadPresetPoints(selectedApt?.id);
        }
    }, [selectedApt?.id, viewerRef.current, isLoading, error]);

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
                        
                        {/* 🔧 개발자 모드 전용 포인트 생성 버튼 */}
                        {isDeveloperMode && (
                            <button
                                className={`${isPointCreationMode
                                    ? "bg-purple-500 text-white border-purple-500"
                                    : "bg-white/90 hover:bg-white border-gray-300 text-gray-700"
                                    } rounded-lg shadow-md transition-all px-4 py-3 text-sm border backdrop-blur-sm`}
                                onClick={() => {
                                    console.log('📍 포인트 생성 모드 토글:', !isPointCreationMode);
                                    setIsPointCreationMode(!isPointCreationMode);
                                    
                                    // 다른 모드들과 충돌 방지
                                    if (!isPointCreationMode) {
                                        if (isWindowViewMode) setIsWindowViewMode(false);
                                        if (isFirstPersonMode) setIsFirstPersonMode(false);
                                        if (isAnalyzing) clearShadeAnalysis();
                                    }
                                }}
                                disabled={isLoading || !!error}
                                title="프리셋 포인트 생성 모드"
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-lg">📍</span>
                                    <span className="text-xs">포인트 생성</span>
                                </div>
                            </button>
                        )}
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

                {/* 포인트 정보 팝업 */}
                {selectedPointInfo && (
                    <div 
                        className="fixed bg-white border border-gray-200 shadow-xl rounded-lg p-4 z-[600] min-w-[200px] max-w-[300px]"
                        style={{
                            left: Math.max(10, Math.min(selectedPointInfo.screenPosition.x - 100, window.innerWidth - 320)), // 화면 경계 내 유지
                            top: Math.max(10, selectedPointInfo.screenPosition.y)
                        }}
                    >
                        <div className="space-y-2">
                            {/* 헤더 */}
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-blue-600 text-sm">
                                    📍 프리셋 포인트
                                </h4>
                                <button 
                                    onClick={() => setSelectedPointInfo(null)}
                                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                                    title="닫기"
                                >
                                    ×
                                </button>
                            </div>
                            
                            {/* 아파트 정보 */}
                            {selectedPointInfo.apt_nm && (
                                <div className="bg-blue-50 p-2 rounded">
                                    <p className="font-medium text-blue-800 text-sm">
                                        🏠 {selectedPointInfo.apt_nm}
                                    </p>
                                    {selectedPointInfo.jibun_address && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            {selectedPointInfo.jibun_address}
                                        </p>
                                    )}
                                </div>
                            )}
                            
                            {/* 세부 정보 */}
                            <div className="space-y-1 text-sm">
                                {selectedPointInfo.dong && (
                                    <p>
                                        <span className="text-gray-600">🏢 동:</span>
                                        <span className="ml-1 font-medium">{selectedPointInfo.dong}</span>
                                    </p>
                                )}
                                {selectedPointInfo.ho && (
                                    <p>
                                        <span className="text-gray-600">🚪 호:</span>
                                        <span className="ml-1 font-medium">{selectedPointInfo.ho}</span>
                                    </p>
                                )}
                                {selectedPointInfo.exclu_use_ar && (
                                    <p>
                                        <span className="text-gray-600">📐 면적:</span>
                                        <span className="ml-1 font-medium">{selectedPointInfo.exclu_use_ar}㎡</span>
                                    </p>
                                )}
                            </div>
                            
                            {/* 생성 정보 */}
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500">
                                    생성: {new Date(selectedPointInfo.created_at).toLocaleDateString('ko-KR')}
                                </p>
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
        </>
    );
}
