import { useEffect, useRef, useCallback, useState } from 'react';
import { loadNaverMaps } from '@/hooks/useNaverMapsLoader';

declare global {
    interface Window {
        Cesium: any;
        naver: any;
    }
}

interface NaverStreetViewOptions {
    isActive: boolean;
    containerId: string;
    initialPosition?: {
        lat: number;
        lng: number;
        alt?: number;
    };
    syncWithWalkingMode?: boolean; // 걷기 모드와 동기화 여부
    syncWithFirstPersonMode?: boolean; // 1인칭 모드와 동기화 여부
}

interface Position {
    lat: number;
    lng: number;
    alt: number;
}

/**
 * 네이버 스트리트뷰와 Cesium 3D 지도의 양방향 동기화를 구현하는 훅
 *
 * 기능:
 * - Cesium 클릭 → 네이버 로드뷰 이동
 * - 로드뷰 이동/회전 → Cesium 카메라 동기화
 * - Proxy 기반 실시간 위치 상태 관리
 */
export function useNaverStreetView(viewer: any, options: NaverStreetViewOptions) {
    const panoRef = useRef<any>(null);
    const handlerRef = useRef<any>(null);
    const cameraListenerRef = useRef<any>(null);
    const isInitializedRef = useRef(false);
    const isSyncingFromCesiumRef = useRef(false); // Cesium에서 온 동기화인지 구분
    const [errorState, setErrorState] = useState<{
        hasError: boolean;
        errorMessage: string;
        errorCode: string;
    }>({
        hasError: false,
        errorMessage: '',
        errorCode: ''
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const currentPositionRef = useRef<Position>({
        lat: options.initialPosition?.lat || 37.5642135,
        lng: options.initialPosition?.lng || 127.0016985,
        alt: options.initialPosition?.alt || 10
    });

    // Proxy 기반 위치 상태 관리 (자동 로드뷰 업데이트)
    const createPositionProxy = useCallback(() => {
        return new Proxy(currentPositionRef.current, {
            set(target, prop, value) {
                target[prop as keyof Position] = value;
                if (panoRef.current && (prop === 'lat' || prop === 'lng')) {
                    updatePanorama(target.lat, target.lng);
                }
                return true;
            }
        });
    }, []);

    const positionProxy = createPositionProxy();

    // POV → Cesium 방향 변환 함수
    const povToCesium = useCallback((pan: number, tilt: number) => {
        if (!window.Cesium) return { heading: 0, pitch: 0 };

        const heading = window.Cesium.Math.toRadians((360 + pan) % 360);
        const pitch = window.Cesium.Math.toRadians(tilt);
        return { heading, pitch };
    }, []);

    // 거리뷰 위치 → Cesium 카메라 이동
    const updateCesiumCameraFromPanorama = useCallback((pos: any, pov: any) => {
        if (!viewer || !viewer.camera || !window.Cesium || viewer.isDestroyed() || isSyncingFromCesiumRef.current) {
            return;
        }

        try {
            const { heading, pitch } = povToCesium(pov.pan, pov.tilt);
            const destination = window.Cesium.Cartesian3.fromDegrees(
                pos.lng(),
                pos.lat(),
                currentPositionRef.current.alt || 10
            );

            viewer.camera.setView({
                destination: destination,
                orientation: {
                    heading,
                    pitch,
                    roll: 0
                }
            });

            // 현재 위치 업데이트 (Proxy 트리거 방지를 위해 직접 설정)
            currentPositionRef.current.lat = pos.lat();
            currentPositionRef.current.lng = pos.lng();

            console.log(`🔄 로드뷰 → Cesium 동기화: ${pos.lat().toFixed(6)}, ${pos.lng().toFixed(6)}`);

        } catch (error) {
            console.warn('⚠️ Cesium 카메라 업데이트 실패:', error);
        }
    }, [viewer, povToCesium]);

    // 거리뷰 시점 변경 → Cesium 각도만 동기화 (위치 유지)
    const updateCesiumCameraAngleOnly = useCallback((pos: any, pov: any) => {
        if (!viewer || !viewer.camera || !window.Cesium || viewer.isDestroyed() || isSyncingFromCesiumRef.current) {
            return;
        }

        try {
            const { heading, pitch } = povToCesium(pov.pan, pov.tilt);

            // 현재 카메라 위치 유지, 각도만 변경
            viewer.camera.setView({
                orientation: {
                    heading,
                    pitch,
                    roll: 0
                }
            });

            console.log(`🔄 로드뷰 각도 → Cesium 각도 동기화: ${pov.pan.toFixed(1)}°, ${pov.tilt.toFixed(1)}°`);

        } catch (error) {
            console.warn('⚠️ Cesium 카메라 각도 업데이트 실패:', error);
        }
    }, [viewer, povToCesium]);

    // Cesium 카메라 이동 → 로드뷰 동기화 (걷기/1인칭 모드용)
    const updatePanoramaFromCesiumCamera = useCallback(() => {
        if (!viewer || !viewer.camera || !window.Cesium || viewer.isDestroyed() || !panoRef.current) {
            return;
        }

        try {
            const camera = viewer.camera;
            const position = camera.positionWC;
            const cartographic = window.Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);

            const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
            const lng = window.Cesium.Math.toDegrees(cartographic.longitude);

            // 무한 루프 방지를 위한 플래그 설정
            isSyncingFromCesiumRef.current = true;

            // 로드뷰 위치 업데이트
            positionProxy.lat = lat;
            positionProxy.lng = lng;
            positionProxy.alt = cartographic.height;

            // 카메라 방향도 동기화
            const heading = window.Cesium.Math.toDegrees(camera.heading);
            const pitch = window.Cesium.Math.toDegrees(camera.pitch);

            if (panoRef.current) {
                const pov = {
                    pan: heading,
                    tilt: pitch,
                    fov: 100
                };
                panoRef.current.setPov(pov);
            }

            console.log(`🔄 Cesium → 로드뷰 동기화: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

            // 플래그 리셋 (약간의 지연 후)
            setTimeout(() => {
                isSyncingFromCesiumRef.current = false;
            }, 100);

        } catch (error) {
            console.warn('⚠️ Cesium → 로드뷰 동기화 실패:', error);
            isSyncingFromCesiumRef.current = false;
        }
    }, [viewer, positionProxy]);

    // 거리뷰 위치 갱신 함수
    const updatePanorama = useCallback((lat: number, lng: number) => {
        if (!panoRef.current || !window.naver) {
            return;
        }

        try {
            const newPosition = new window.naver.maps.LatLng(lat, lng);
            panoRef.current.setPosition(newPosition);
            console.log(`🌍 로드뷰 위치 이동: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } catch (error) {
            console.warn('⚠️ 로드뷰 위치 업데이트 실패:', error);
        }
    }, []);

    // Cesium 클릭 → 거리뷰 이동 핸들러
    const handleCesiumClick = useCallback((click: any) => {
        if (!viewer || !options.isActive) return;

        try {
            const pickedPosition = viewer.scene.pickPosition(click.position);
            if (pickedPosition && window.Cesium) {
                const cartographic = window.Cesium.Cartographic.fromCartesian(pickedPosition);
                const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
                const lng = window.Cesium.Math.toDegrees(cartographic.longitude);
                const alt = cartographic.height;

                // Proxy를 통한 위치 업데이트 (자동으로 로드뷰 이동)
                positionProxy.lat = lat;
                positionProxy.lng = lng;
                positionProxy.alt = alt;

                console.log(`🎯 Cesium 클릭 → 로드뷰 이동: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
        } catch (error) {
            console.warn('⚠️ Cesium 클릭 처리 실패:', error);
        }
    }, [viewer, options.isActive, positionProxy]);

    // 네이버 로드뷰 초기화 (안전성 강화)
    const initializePanorama = useCallback(() => {
        // 기본 조건 확인
        if (!options.isActive || isInitializedRef.current) {
            console.log('🔍 로드뷰 초기화 건너뜀 - 비활성 상태이거나 이미 초기화됨');
            return;
        }

        // API 사용 가능성 엄격 검증
        if (!window.naver) {
            console.warn('⚠️ window.naver가 존재하지 않음');
            return;
        }

        if (!window.naver.maps) {
            console.warn('⚠️ window.naver.maps가 존재하지 않음');
            return;
        }

        if (!window.naver.maps.Panorama) {
            console.warn('⚠️ window.naver.maps.Panorama가 존재하지 않음');
            console.log('🔍 사용 가능한 maps 객체들:', Object.keys(window.naver.maps));
            return;
        }

        if (typeof window.naver.maps.Panorama !== 'function') {
            console.warn('⚠️ window.naver.maps.Panorama가 생성자 함수가 아님:', typeof window.naver.maps.Panorama);
            return;
        }

        if (!window.naver.maps.LatLng) {
            console.warn('⚠️ window.naver.maps.LatLng가 존재하지 않음');
            return;
        }

        try {
            const container = document.getElementById(options.containerId);
            if (!container) {
                console.warn(`⚠️ 로드뷰 컨테이너를 찾을 수 없습니다: ${options.containerId}`);
                return;
            }

            console.log('🔍 로드뷰 초기화 시작 - 모든 조건 충족');

            // 네이버 로드뷰 생성 (추가 안전성 검사)
            const position = new window.naver.maps.LatLng(
                currentPositionRef.current.lat,
                currentPositionRef.current.lng
            );

            console.log('🔍 초기 위치 생성 완료:', position);

            panoRef.current = new window.naver.maps.Panorama(container, {
                position: position,
                pov: { pan: 0, tilt: 0, fov: 100 }
            });

            console.log('🔍 Panorama 객체 생성 완료');

            // Event 객체 존재 확인
            if (window.naver.maps.Event) {
                // 로드뷰 위치 변경 → Cesium 위치만 동기화 (클릭 기반)
                window.naver.maps.Event.addListener(panoRef.current, 'pano_changed', function () {
                    // 수동으로 위치가 변경된 경우에만 동기화 (클릭 등)
                    if (!isSyncingFromCesiumRef.current) {
                        const pos = panoRef.current.getPosition();
                        const pov = panoRef.current.getPov();
                        if (pos) {
                            console.log('🔄 로드뷰 위치 변경 → Cesium 위치 동기화');
                            updateCesiumCameraFromPanorama(pos, pov);
                        }
                    }
                });

                // 로드뷰 시점 변경 → Cesium 각도만 동기화 (드래그 기반)
                window.naver.maps.Event.addListener(panoRef.current, 'pov_changed', function () {
                    // 각도 변경은 항상 즉시 동기화
                    if (!isSyncingFromCesiumRef.current) {
                        const pos = panoRef.current.getPosition();
                        const pov = panoRef.current.getPov();
                        if (pos && pov) {
                            console.log('🔄 로드뷰 시점 변경 → Cesium 각도 동기화');
                            updateCesiumCameraAngleOnly(pos, pov);
                        }
                    }
                });

                console.log('🔍 이벤트 리스너 등록 완료 (개선된 상호작용)');
            } else {
                console.warn('⚠️ window.naver.maps.Event가 존재하지 않음 - 이벤트 리스너 등록 불가');
            }

            isInitializedRef.current = true;
            console.log('✅ 네이버 로드뷰 초기화 완료');

        } catch (error) {
            console.error('❌ 네이버 로드뷰 초기화 실패:', error);
            console.error('상세 오류:', error.stack);

            // 실패 시 상태 초기화 및 에러 설정
            panoRef.current = null;
            isInitializedRef.current = false;
            setErrorState({
                hasError: true,
                errorMessage: '로드뷰 초기화에 실패했습니다. 페이지를 새로고침하여 다시 시도해주세요.',
                errorCode: 'PANORAMA_INIT_FAILED'
            });
        }
    }, [options.isActive, options.containerId, updateCesiumCameraFromPanorama]);

    // Cesium 이벤트 핸들러 등록
    useEffect(() => {
        if (!viewer || !window.Cesium || !options.isActive) return;

        try {
            // 클릭 이벤트 핸들러
            handlerRef.current = new window.Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
            handlerRef.current.setInputAction(
                handleCesiumClick,
                window.Cesium.ScreenSpaceEventType.LEFT_CLICK
            );

            // 카메라 자동 동기화 제거 - 클릭 기반 동기화만 사용
            // 참고: 수동 동기화만 사용하여 시점 변경 최소화
            console.log('✅ 클릭 기반 동기화만 활성화 (자동 동기화 비활성화)');

            console.log('✅ Cesium 클릭 이벤트 등록 완료');
        } catch (error) {
            console.warn('⚠️ Cesium 이벤트 핸들러 등록 실패:', error);
        }

        return () => {
            // 클릭 핸들러 정리
            if (handlerRef.current && !handlerRef.current.isDestroyed()) {
                try {
                    handlerRef.current.destroy();
                    console.log('🧹 Cesium 이벤트 핸들러 정리 완료');
                } catch (error) {
                    console.warn('⚠️ Cesium 이벤트 핸들러 정리 실패:', error);
                }
            }

            // 카메라 리스너 정리
            if (cameraListenerRef.current) {
                try {
                    clearTimeout(cameraListenerRef.current.timeoutId);
                    if (viewer && !viewer.isDestroyed() && viewer.camera) {
                        viewer.camera.changed.removeEventListener(cameraListenerRef.current);
                    }
                    console.log('🧹 Cesium 카메라 이벤트 정리 완료');
                } catch (error) {
                    console.warn('⚠️ Cesium 카메라 이벤트 정리 실패:', error);
                }
            }
        };
    }, [viewer, options.isActive, options.syncWithWalkingMode, options.syncWithFirstPersonMode, handleCesiumClick, updatePanoramaFromCesiumCamera]);

    // 로드뷰 초기화 및 정리 (재시도 로직 포함)
    useEffect(() => {
        if (options.isActive) {
            console.log('🔍 로드뷰 활성화 - API 로드 시작');
            setIsLoading(true);
            setErrorState({ hasError: false, errorMessage: '', errorCode: '' });

            // 네이버 Maps API 동적 로드 후 초기화
            loadNaverMaps({ submodules: ['panorama'] })
                .then(() => {
                    console.log('✅ 네이버 Maps API 로드 성공 - 초기화 시도');

                    // 약간의 지연 후 초기화 (API 완전 로드 보장)
                    setTimeout(() => {
                        initializePanorama();
                        setIsLoading(false);
                    }, 200);
                })
                .catch((error) => {
                    console.error('❌ 네이버 Maps API 로드 실패:', error);

                    // 재시도 로직 (한 번만)
                    console.log('🔄 네이버 Maps API 로드 재시도...');
                    setTimeout(() => {
                        loadNaverMaps({ submodules: ['panorama'] })
                            .then(() => {
                                console.log('✅ 네이버 Maps API 재시도 성공 - 초기화 시도');
                                setTimeout(() => {
                                    initializePanorama();
                                    setIsLoading(false);
                                }, 200);
                            })
                            .catch((retryError) => {
                                console.error('❌ 네이버 Maps API 재시도도 실패:', retryError);
                                setIsLoading(false);
                                setErrorState({
                                    hasError: true,
                                    errorMessage: '네이버 로드뷰 API 로드에 실패했습니다. 네트워크 연결을 확인해주세요.',
                                    errorCode: 'API_LOAD_FAILED'
                                });
                            });
                    }, 1000);
                });
        }

        return () => {
            setIsLoading(false);
            setErrorState({ hasError: false, errorMessage: '', errorCode: '' });

            if (panoRef.current) {
                try {
                    // 네이버 로드뷰 정리
                    panoRef.current = null;
                    isInitializedRef.current = false;
                    console.log('🧹 네이버 로드뷰 정리 완료');
                } catch (error) {
                    console.warn('⚠️ 네이버 로드뷰 정리 실패:', error);
                }
            }
        };
    }, [options.isActive, initializePanorama]);

    // 프로그래밍 방식 위치 이동
    const moveToPosition = useCallback((lat: number, lng: number, alt?: number) => {
        positionProxy.lat = lat;
        positionProxy.lng = lng;
        if (alt !== undefined) {
            positionProxy.alt = alt;
        }
    }, [positionProxy]);

    // 현재 위치 반환
    const getCurrentPosition = useCallback(() => {
        return { ...currentPositionRef.current };
    }, []);

    return {
        panorama: panoRef.current,
        currentPosition: getCurrentPosition(),
        moveToPosition,
        isInitialized: isInitializedRef.current,
        isLoading,
        error: errorState,
        clearError: () => setErrorState({ hasError: false, errorMessage: '', errorCode: '' })
    };
}