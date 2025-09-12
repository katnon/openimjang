import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        Cesium: any;
    }
}

/**
 * Cesium 뷰어에서 1인칭 시점 카메라 조작(마우스 둘러보기)을 구현하는 훅.
 * 사용자가 제공한 전문적인 가이드를 기반으로 재작성됨.
 * @param viewer Cesium 뷰어 인스턴스
 */
export function useFirstPersonLook(viewer: any) {
    const isLookingRef = useRef(false);
    const yawRef = useRef(0);
    const pitchRef = useRef(0);

    useEffect(() => {
        if (!viewer || !viewer.scene || !viewer.camera || !window.Cesium) {
            return;
        }

        const Cesium = window.Cesium;
        let handler: any = null;
        let camera: any = null;
        let controller: any = null;

        try {
            handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
            camera = viewer.camera;
            controller = viewer.scene.screenSpaceCameraController;

            // 추가 안전성 검사
            if (!handler || !camera || !controller) {
                console.warn('⚠️ 필수 객체 초기화 실패');
                return;
            }
        } catch (error) {
            console.warn('⚠️ 1인칭 시점 초기화 실패:', error);
            return;
        }

        const PITCH_MAX = Cesium.Math.toRadians(89.9);

        // 마우스 이동에 따른 Yaw/Pitch 업데이트 및 카메라 설정
        const handleMouseMove = (movement: any) => {
            if (!isLookingRef.current || !viewer || viewer.isDestroyed() || !viewer.camera || !camera) {
                return;
            }

            // 추가 안전성 검사
            try {
                if (!viewer.scene || !viewer.scene.canvas) {
                    return;
                }
            } catch (error) {
                console.warn('⚠️ 마우스 이동 처리 중 viewer 상태 확인 실패:', error);
                return;
            }

            const sensitivity = 0.003; // 회전 감도
            const deltaX = movement.endPosition.x - movement.startPosition.x;
            const deltaY = movement.endPosition.y - movement.startPosition.y;

            // Yaw, Pitch 업데이트 (Yaw는 반전)
            yawRef.current += deltaX * sensitivity;
            pitchRef.current -= deltaY * sensitivity;

            // Pitch를 안전 범위로 클램프
            pitchRef.current = Cesium.Math.clamp(pitchRef.current, -PITCH_MAX, PITCH_MAX);

            // 새로운 heading/pitch/roll로 카메라 방향 설정
            camera.setView({
                orientation: {
                    heading: yawRef.current,
                    pitch: pitchRef.current,
                    roll: 0.0
                }
            });
        };

        // 휠 클릭 다운: 1인칭 시점 시작
        const handleMouseDown = () => {
            if (!viewer || viewer.isDestroyed() || !viewer.camera || !camera) {
                return;
            }

            // 추가 안전성 검사
            try {
                if (!camera.positionWC || !controller) {
                    return;
                }
            } catch (error) {
                console.warn('⚠️ 마우스 다운 처리 중 객체 상태 확인 실패:', error);
                return;
            }
            
            isLookingRef.current = true;

            try {
                // 현재 카메라 위치에 ENU 변환 프레임 설정
                const transform = Cesium.Transforms.eastNorthUpToFixedFrame(camera.positionWC);
                camera.lookAtTransform(transform);

                // 현재 카메라의 heading/pitch를 초기 yaw/pitch로 설정
                yawRef.current = camera.heading;
                pitchRef.current = camera.pitch;

                // 기본 카메라 조작 비활성화
                if (controller && !controller.isDestroyed()) {
                    controller.enableInputs = false;
                }
            } catch (error) {
                console.warn('⚠️ 1인칭 시점 설정 실패:', error);
                isLookingRef.current = false;
            }
        };

        // 휠 클릭 업: 1인칭 시점 종료
        const handleMouseUp = () => {
            isLookingRef.current = false;

            if (!viewer || viewer.isDestroyed()) {
                return;
            }

            try {
                // 카메라 기준을 다시 지구 고정 프레임으로 복원
                if (viewer.camera && camera && Cesium && Cesium.Matrix4) {
                    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
                }

                // 기본 카메라 조작 다시 활성화
                if (controller && !controller.isDestroyed()) {
                    controller.enableInputs = true;
                }
            } catch (error) {
                console.warn('⚠️ 1인칭 시점 해제 실패:', error);
            }
        };

        // 이벤트 핸들러 등록
        try {
            handler.setInputAction(handleMouseDown, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
            handler.setInputAction(handleMouseUp, Cesium.ScreenSpaceEventType.MIDDLE_UP);
            handler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        } catch (error) {
            console.warn('⚠️ 이벤트 핸들러 등록 실패:', error);
            // 핸들러가 생성되었다면 정리
            if (handler && !handler.isDestroyed()) {
                try {
                    handler.destroy();
                } catch (destroyError) {
                    console.warn('⚠️ 핸들러 정리 실패:', destroyError);
                }
            }
            return;
        }

        // 컴포넌트 언마운트 시 정리
        return () => {
            console.log('🧹 1인칭 시점 cleanup 시작');
            
            // 1. 먼저 상태 플래그 정리 (추가 이벤트 처리 방지)
            isLookingRef.current = false;
            
            // 2. 핸들러 정리
            if (handler && !handler.isDestroyed()) {
                try {
                    handler.destroy();
                    console.log('✅ ScreenSpaceEventHandler 정리 완료');
                } catch (error) {
                    console.warn('⚠️ ScreenSpaceEventHandler 정리 중 오류:', error);
                }
            }
            
            // 3. 카메라 및 컨트롤러 상태 복원 - 안전성 체크 강화
            if (viewer && !viewer.isDestroyed()) {
                try {
                    // 카메라 transform 복원
                    if (viewer.camera && camera && Cesium && Cesium.Matrix4) {
                        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
                        console.log('✅ 카메라 transform 복원 완료');
                    }
                    
                    // 컨트롤러 활성화
                    if (viewer.scene && 
                        viewer.scene.screenSpaceCameraController && 
                        !viewer.scene.screenSpaceCameraController.isDestroyed() &&
                        controller && !controller.isDestroyed()) {
                        viewer.scene.screenSpaceCameraController.enableInputs = true;
                        console.log('✅ 카메라 컨트롤러 복원 완료');
                    }
                } catch (error) {
                    console.warn('⚠️ 1인칭 시점 정리 중 오류:', error);
                }
            }
            
            // 4. 상태 초기화
            yawRef.current = 0;
            pitchRef.current = 0;
            console.log('✅ 1인칭 시점 cleanup 완료');
        };
    }, [viewer]);
}