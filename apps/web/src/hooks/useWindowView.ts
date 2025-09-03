import { useEffect, useCallback, useRef } from 'react';

declare global {
    interface Window {
        Cesium: any;
    }
}

export function useWindowView(viewer: any, isActive: boolean, onDeactivate: () => void) {
    const previousCameraPositionRef = useRef<any>(null);

    // 건물 클릭 처리 함수
    const handleBuildingClick = useCallback((worldPosition: any) => {
        if (!previousCameraPositionRef.current) {
            console.warn('⚠️ 이전 카메라 위치를 사용할 수 없습니다.');
            return;
        }

        console.log('🏢 건물 클릭됨:', worldPosition);

        try {
            const Cesium = window.Cesium;

            // 1. 저장된 이전 카메라 위치와 클릭된 지점(worldPosition)을 가져옵니다.
            const lastCameraPosition = previousCameraPositionRef.current;
            const targetPosition = worldPosition;

            // 2. 카메라가 이동할 최종 위치를 경위도/높이로 변환합니다.
            const targetCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(targetPosition);
            const longitude = Cesium.Math.toDegrees(targetCartographic.longitude);
            const latitude = Cesium.Math.toDegrees(targetCartographic.latitude);
            const height = targetCartographic.height;

            // 3. 클릭 지점에서 이전 카메라 위치로의 방향 벡터(바라볼 방향)를 계산합니다.
            const viewDirection = Cesium.Cartesian3.subtract(
                lastCameraPosition, // 목표
                targetPosition,   // 시작
                new Cesium.Cartesian3()
            );
            Cesium.Cartesian3.normalize(viewDirection, viewDirection);

            // 4. 수평 시야를 위해 방향 벡터를 지면과 평행하게 만듭니다.
            // 클릭된 지점(targetPosition)의 지표면 법선 벡터(up 벡터)를 구합니다.
            const surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(targetPosition, new Cesium.Cartesian3());

            // viewDirection에서 수직 성분을 제거하여 수평 방향 벡터를 만듭니다.
            const verticalComponent = Cesium.Cartesian3.multiplyByScalar(surfaceNormal, Cesium.Cartesian3.dot(viewDirection, surfaceNormal), new Cesium.Cartesian3());
            const horizontalDirection = Cesium.Cartesian3.subtract(viewDirection, verticalComponent, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(horizontalDirection, horizontalDirection);

            // 5. 수평 방향 벡터로부터 heading 값을 계산합니다.
            const tempCamera = new Cesium.Camera(viewer.scene);
            tempCamera.position = targetPosition; // 카메라 위치를 최종 목적지로 설정
            tempCamera.direction = horizontalDirection; // 수평 방향으로 설정
            tempCamera.up = surfaceNormal; // 위쪽 방향 설정

            let heading = tempCamera.heading;
            heading = Cesium.Math.toDegrees(heading);
            if (heading < 0) {
                heading += 360;
            }

            // 6. 창가 뷰 카메라를 설정합니다: 클릭한 위치로 이동하고, 계산된 수평 방향을 바라봅니다.
            const cameraView = {
                longitude: longitude,
                latitude: latitude,
                height: height, // 필요시 +1.5 와 같이 사람 눈높이 오프셋 추가 가능
                heading: heading,
                pitch: 0, // 수평 시선 고정
                roll: 0
            };

            console.log('📹 창가 뷰 카메라 설정 (클릭 위치로 이동, 바깥 조망):', cameraView);

            // 7. MapPrime3D 카메라를 이동시킵니다.
            if (viewer && viewer._setCameraView) {
                viewer._setCameraView(cameraView);
                console.log('✅ 창가 뷰 카메라 이동 완료');
                onDeactivate(); // 모드 비활성화
            } else {
                console.warn('⚠️ 뷰어 카메라 API를 사용할 수 없음');
            }

        } catch (error) {
            console.error('❌ 창가 뷰 처리 실패:', error);
        }
    }, [viewer, onDeactivate]);

    // 클릭 이벤트 핸들러
    const handleClick = useCallback((event: any) => {
        if (!viewer || !isActive) return;

        try {
            console.log('🖱️ 3D 뷰어 클릭됨');

            const position = viewer.scene.pickPosition(event.position);

            if (position) {
                const pickedObject = viewer.scene.pick(event.position);
                if (pickedObject && pickedObject.primitive && 
                    (pickedObject.primitive instanceof window.Cesium.Cesium3DTileset ||
                     pickedObject.primitive.constructor.name === 'Cesium3DTileset')) {
                    console.log('🏢 건물 클릭 감지됨');
                    handleBuildingClick(position);
                } else {
                    console.log('🌍 지면 또는 다른 객체 클릭됨 (동작 없음)');
                }
            } else {
                console.log('🖱️ 클릭 위치의 3D 좌표를 가져올 수 없음');
            }

        } catch (error) {
            console.error('❌ 클릭 처리 실패:', error);
        }
    }, [viewer, isActive, handleBuildingClick]);

    // 클릭 이벤트 등록/해제
    useEffect(() => {
        if (!viewer || !viewer.cesiumWidget || !window.Cesium) {
            console.warn('⚠️ 뷰어나 Cesium이 준비되지 않음');
            return;
        }

        const handler = viewer.cesiumWidget.screenSpaceEventHandler;

        if (isActive) {
            console.log('✅ 창가 뷰 모드 활성화 - 클릭 이벤트 등록');
            // 현재 카메라 위치 저장
            previousCameraPositionRef.current = viewer.camera.positionWC.clone();
            console.log('📷 이전 카메라 위치 저장됨:', previousCameraPositionRef.current);
            
            handler.setInputAction(handleClick, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);

            // 정리 함수
            return () => {
                console.log('🧹 창가 뷰 모드 비활성화 - 클릭 이벤트 해제');
                previousCameraPositionRef.current = null; // 참조 정리
                if (handler && !handler.isDestroyed()) {
                    handler.removeInputAction(window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
                }
            };
        }
    }, [viewer, isActive, handleClick]);

    return {
        // 필요한 경우 추가 함수들을 반환할 수 있음
    };
}