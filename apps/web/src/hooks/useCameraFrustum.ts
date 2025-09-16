import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
    interface Window {
        Cesium: any;
    }
}

interface FrustumCorner {
    lat: number;
    lng: number;
}

interface CameraFrustum {
    topLeft: FrustumCorner;
    topRight: FrustumCorner;
    bottomLeft: FrustumCorner;
    bottomRight: FrustumCorner;
    center: FrustumCorner;
    isValid: boolean;
    // 부채꼴 대체 렌더링용 데이터
    fallbackSector?: {
        center: FrustumCorner;
        heading: number; // 카메라 방향 (도)
        radius: number; // 부채꼴 반지름 (미터)
        angleSpread: number; // 시야각 (도, 기본 60도)
    };
}

interface UseCameraFrustumOptions {
    isActive: boolean;
    debounceMs?: number; // 카메라 이동 완료 감지 지연 시간
    onFrustumUpdate?: (frustum: CameraFrustum) => void;
}

/**
 * Cesium 3D 카메라의 시야 범위(Frustum)를 실시간으로 계산하는 훅
 *
 * 기능:
 * - 카메라 이동 완료 시 시야 범위의 4개 코너 좌표 계산
 * - 화면 좌표에서 지면으로 광선 투사하여 실제 지면 좌표 획득
 * - 디바운싱을 통한 성능 최적화
 * - AOS 게임 스타일 미니맵 시야 표시를 위한 좌표 제공
 */
export function useCameraFrustum(viewer: any, options: UseCameraFrustumOptions) {
    const [frustum, setFrustum] = useState<CameraFrustum>({
        topLeft: { lat: 0, lng: 0 },
        topRight: { lat: 0, lng: 0 },
        bottomLeft: { lat: 0, lng: 0 },
        bottomRight: { lat: 0, lng: 0 },
        center: { lat: 0, lng: 0 },
        isValid: false,
        fallbackSector: undefined
    });

    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cameraListenerRef = useRef<any>(null);

    // 화면 좌표에서 지면으로 광선 투사하여 WGS84 좌표 계산
    const pickGroundPosition = useCallback((screenX: number, screenY: number): FrustumCorner | null => {
        if (!viewer || !viewer.camera || !window.Cesium || viewer.isDestroyed()) {
            return null;
        }

        try {
            const screenPosition = new window.Cesium.Cartesian2(screenX, screenY);

            // 지면과 교차점 찾기 (지형 포함)
            let pickedPosition = viewer.camera.pickEllipsoid(screenPosition, viewer.scene.globe.ellipsoid);

            // 지형이 있는 경우 더 정확한 위치 계산
            if (viewer.scene.pickPositionSupported) {
                const terrainPosition = viewer.scene.pickPosition(screenPosition);
                if (terrainPosition) {
                    pickedPosition = terrainPosition;
                }
            }

            if (!pickedPosition) {
                return null;
            }

            // Cartesian3 좌표를 WGS84로 변환
            const cartographic = window.Cesium.Ellipsoid.WGS84.cartesianToCartographic(pickedPosition);
            const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
            const lng = window.Cesium.Math.toDegrees(cartographic.longitude);

            return { lat, lng };
        } catch (error) {
            console.warn('⚠️ 지면 위치 계산 실패:', error);
            return null;
        }
    }, [viewer]);

    // 카메라 위치와 방향 기반 부채꼴 생성 (코너 계산 실패 시 대체용)
    const createFallbackSector = useCallback((): CameraFrustum['fallbackSector'] | null => {
        if (!viewer || !viewer.camera || !window.Cesium || viewer.isDestroyed()) {
            return null;
        }

        try {
            const camera = viewer.camera;
            const cameraPosition = camera.position;

            // 카메라 위치를 WGS84로 변환
            const cartographic = window.Cesium.Ellipsoid.WGS84.cartesianToCartographic(cameraPosition);
            const lat = window.Cesium.Math.toDegrees(cartographic.latitude);
            const lng = window.Cesium.Math.toDegrees(cartographic.longitude);
            const height = cartographic.height;

            // 카메라 방향 (heading) 계산
            const heading = window.Cesium.Math.toDegrees(camera.heading);

            // 줌 레벨 기반 부채꼴 반지름 계산 (멀리 보는 경우이므로 크게)
            // 높이 100m -> 500m 반지름, 1000m -> 2000m 반지름, 10000m -> 8000m 반지름
            const radius = Math.max(500, Math.min(8000, height * 0.8));

            console.log('🎯 부채꼴 대체 시야 생성:', {
                center: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                heading: heading.toFixed(1),
                radius: radius.toFixed(0) + 'm',
                height: height.toFixed(0) + 'm'
            });

            return {
                center: { lat, lng },
                heading: heading,
                radius: radius,
                angleSpread: 60 // 60도 시야각 고정
            };
        } catch (error) {
            console.warn('⚠️ 부채꼴 대체 시야 생성 실패:', error);
            return null;
        }
    }, [viewer]);

    // 카메라 시야 범위 계산
    const calculateFrustum = useCallback(() => {
        if (!viewer || !viewer.scene || !window.Cesium || viewer.isDestroyed() || !options.isActive) {
            return;
        }

        try {
            const canvas = viewer.scene.canvas;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            console.log('🔍 카메라 시야 범위 계산 시작');

            // 4개 코너 좌표 계산 (약간 안쪽으로 조정하여 더 정확한 결과)
            const margin = 10; // 가장자리에서 10px 안쪽
            const corners = {
                topLeft: pickGroundPosition(margin, margin),
                topRight: pickGroundPosition(width - margin, margin),
                bottomLeft: pickGroundPosition(margin, height - margin),
                bottomRight: pickGroundPosition(width - margin, height - margin)
            };

            // 중심점 계산
            const center = pickGroundPosition(width / 2, height / 2);

            // 모든 코너가 유효한지 확인
            const allCornersValid = Object.values(corners).every(corner => corner !== null) && center !== null;

            if (allCornersValid) {
                const newFrustum: CameraFrustum = {
                    topLeft: corners.topLeft!,
                    topRight: corners.topRight!,
                    bottomLeft: corners.bottomLeft!,
                    bottomRight: corners.bottomRight!,
                    center: center!,
                    isValid: true
                };

                setFrustum(newFrustum);

                console.log('✅ 카메라 시야 범위 계산 완료:', {
                    center: `${center!.lat.toFixed(6)}, ${center!.lng.toFixed(6)}`,
                    topLeft: `${corners.topLeft!.lat.toFixed(6)}, ${corners.topLeft!.lng.toFixed(6)}`,
                    bottomRight: `${corners.bottomRight!.lat.toFixed(6)}, ${corners.bottomRight!.lng.toFixed(6)}`
                });

                // 콜백 호출
                if (options.onFrustumUpdate) {
                    options.onFrustumUpdate(newFrustum);
                }
            } else {
                console.warn('⚠️ 일부 시야 코너 계산 실패 - 카메라가 지면을 보고 있지 않을 수 있음');

                // 부채꼴 대체 시야 생성
                const fallbackSector = createFallbackSector();

                if (fallbackSector) {
                    const fallbackFrustum: CameraFrustum = {
                        topLeft: { lat: 0, lng: 0 },
                        topRight: { lat: 0, lng: 0 },
                        bottomLeft: { lat: 0, lng: 0 },
                        bottomRight: { lat: 0, lng: 0 },
                        center: fallbackSector.center,
                        isValid: false, // 부채꼴은 정확한 frustum이 아니므로 false
                        fallbackSector: fallbackSector
                    };

                    setFrustum(fallbackFrustum);

                    // 콜백 호출
                    if (options.onFrustumUpdate) {
                        options.onFrustumUpdate(fallbackFrustum);
                    }
                } else {
                    setFrustum(prev => ({ ...prev, isValid: false, fallbackSector: undefined }));
                }
            }

        } catch (error) {
            console.error('❌ 카메라 시야 범위 계산 실패:', error);
            setFrustum(prev => ({ ...prev, isValid: false, fallbackSector: undefined }));
        }
    }, [viewer, options.isActive, options.onFrustumUpdate, pickGroundPosition, createFallbackSector]);

    // 디바운스된 시야 범위 계산
    const debouncedCalculateFrustum = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            calculateFrustum();
        }, options.debounceMs || 300); // 기본 300ms 지연
    }, [calculateFrustum, options.debounceMs]);

    // 카메라 이벤트 리스너 등록
    useEffect(() => {
        if (!viewer || !window.Cesium || !options.isActive) {
            return;
        }

        try {
            // 카메라 변경 이벤트 리스너
            cameraListenerRef.current = viewer.camera.changed.addEventListener(() => {
                debouncedCalculateFrustum();
            });

            // 초기 계산
            setTimeout(() => {
                calculateFrustum();
            }, 100);

            console.log('✅ 카메라 시야 범위 이벤트 리스너 등록 완료');

        } catch (error) {
            console.warn('⚠️ 카메라 시야 범위 이벤트 등록 실패:', error);
        }

        return () => {
            // 정리
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            if (cameraListenerRef.current && viewer && !viewer.isDestroyed() && viewer.camera) {
                try {
                    viewer.camera.changed.removeEventListener(cameraListenerRef.current);
                    console.log('🧹 카메라 시야 범위 이벤트 리스너 정리 완료');
                } catch (error) {
                    console.warn('⚠️ 카메라 시야 범위 이벤트 정리 실패:', error);
                }
            }
        };
    }, [viewer, options.isActive, debouncedCalculateFrustum, calculateFrustum]);

    // 수동 업데이트 함수
    const updateFrustum = useCallback(() => {
        calculateFrustum();
    }, [calculateFrustum]);

    return {
        frustum,
        updateFrustum,
        isCalculating: !!debounceTimeoutRef.current
    };
}

export type { CameraFrustum, FrustumCorner, UseCameraFrustumOptions };