import { useEffect, useRef, useCallback } from 'react';

declare global {
    interface Window {
        Cesium: any;
    }
}

export function useWalkingMode(viewer: any, isActive: boolean, onDeactivate: () => void) {
    const isWalkingRef = useRef(false);
    const animationFrameRef = useRef<number>(0);
    const keysRef = useRef({
        W: false,
        A: false, 
        S: false,
        D: false,
        Shift: false
    });
    const velocityRef = useRef({ x: 0, y: 0, z: 0 });
    const walkingStartPositionRef = useRef<any>(null);
    const lastLogTimeRef = useRef<number>(0);
    const terrainCacheRef = useRef<{ [key: string]: { height: number, time: number } }>({});
    
    // 키보드 이벤트 핸들러
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!isWalkingRef.current) return;
        
        const key = event.key.toUpperCase();
        if (key in keysRef.current) {
            keysRef.current[key as keyof typeof keysRef.current] = true;
            event.preventDefault();
        }
        
        // ESC로 걷기 모드 종료
        if (event.key === 'Escape') {
            onDeactivate();
            event.preventDefault();
        }
    }, [onDeactivate]);
    
    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        if (!isWalkingRef.current) return;
        
        const key = event.key.toUpperCase();
        if (key in keysRef.current) {
            keysRef.current[key as keyof typeof keysRef.current] = false;
            event.preventDefault();
        }
    }, []);
    
    // 최적화된 지면 높이 샘플링 (캐시 활용)
    const sampleTerrainHeight = useCallback(async (longitude: number, latitude: number) => {
        try {
            // 좌표를 키로 만들기 (소수점 4자리까지만 - 약 10m 정밀도)
            const key = `${longitude.toFixed(4)},${latitude.toFixed(4)}`;
            const now = Date.now();
            
            // 캐시된 데이터가 5초 이내면 재사용
            if (terrainCacheRef.current[key] && (now - terrainCacheRef.current[key].time < 5000)) {
                return terrainCacheRef.current[key].height;
            }
            
            const cartographic = window.Cesium.Cartographic.fromDegrees(longitude, latitude);
            const terrainProvider = viewer.terrainProvider;
            
            // 터레인 높이 샘플링
            const sampledPositions = await window.Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic]);
            const height = sampledPositions[0]?.height || 0;
            
            // 캐시에 저장
            terrainCacheRef.current[key] = { height, time: now };
            
            return height;
        } catch (error) {
            console.warn('지면 높이 샘플링 실패:', error);
            return 0;
        }
    }, [viewer]);
    
    // 걷기 애니메이션 루프
    const walkingLoop = useCallback(() => {
        if (!viewer || !isWalkingRef.current || !window.Cesium || viewer.isDestroyed()) {
            return;
        }
        
        const Cesium = window.Cesium;
        
        // 카메라 접근 전 안전성 체크
        if (!viewer.camera) {
            console.warn('⚠️ 카메라가 사용할 수 없는 상태입니다');
            return;
        }
        
        const camera = viewer.camera;
        const keys = keysRef.current;
        
        // 이동 속도 설정 (속도 증가)
        const baseSpeed = keys.Shift ? 8.0 : 4.0; // 뛰기: 8m/s, 걷기: 4m/s
        const deltaTime = 1/60; // 60fps 가정
        
        // 현재 카메라 위치
        const currentPosition = camera.positionWC;
        const currentCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(currentPosition);
        
        // 카메라의 현재 방향 벡터들
        const forward = camera.direction;
        const right = camera.right;
        
        // 이동 방향 계산
        let moveDirection = new Cesium.Cartesian3(0, 0, 0);
        let hasMovement = false;
        
        if (keys.W) { // 앞으로
            Cesium.Cartesian3.add(moveDirection, forward, moveDirection);
            hasMovement = true;
        }
        if (keys.S) { // 뒤로
            Cesium.Cartesian3.subtract(moveDirection, forward, moveDirection);
            hasMovement = true;
        }
        if (keys.A) { // 왼쪽
            Cesium.Cartesian3.subtract(moveDirection, right, moveDirection);
            hasMovement = true;
        }
        if (keys.D) { // 오른쪽
            Cesium.Cartesian3.add(moveDirection, right, moveDirection);
            hasMovement = true;
        }
        
        // 이동 방향이 있을 때만 처리
        if (hasMovement) {
            // 방향 벡터 정규화
            Cesium.Cartesian3.normalize(moveDirection, moveDirection);
            
            // 수평 이동만 (y 성분 제거)
            const surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(currentPosition);
            const verticalComponent = Cesium.Cartesian3.multiplyByScalar(
                surfaceNormal, 
                Cesium.Cartesian3.dot(moveDirection, surfaceNormal),
                new Cesium.Cartesian3()
            );
            const horizontalMovement = Cesium.Cartesian3.subtract(moveDirection, verticalComponent, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(horizontalMovement, horizontalMovement);
            
            // 이동 거리 계산
            const moveDistance = baseSpeed * deltaTime;
            const moveVector = Cesium.Cartesian3.multiplyByScalar(horizontalMovement, moveDistance, new Cesium.Cartesian3());
            
            // 새 위치 계산
            const newPosition = Cesium.Cartesian3.add(currentPosition, moveVector, new Cesium.Cartesian3());
            const newCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(newPosition);
            
            // 지면 높이 샘플링 (캐시된 값 사용)
            const longitude = Cesium.Math.toDegrees(newCartographic.longitude);
            const latitude = Cesium.Math.toDegrees(newCartographic.latitude);
            
            sampleTerrainHeight(longitude, latitude).then(terrainHeight => {
                // 비동기 콜백에서 다시 한 번 viewer 상태 체크
                if (!viewer || viewer.isDestroyed() || !viewer.camera || !isWalkingRef.current) {
                    return;
                }
                
                const eyeHeight = 1.7; // 사람 눈높이
                newCartographic.height = terrainHeight + eyeHeight;
                
                // 카메라 위치 업데이트
                const finalPosition = Cesium.Ellipsoid.WGS84.cartographicToCartesian(newCartographic);
                camera.position = finalPosition;
                
                // 로그를 1초에 한 번만 출력
                const now = Date.now();
                if (now - lastLogTimeRef.current > 1000) {
                    console.log(`🚶 이동: 속도 ${baseSpeed}m/s, 지면높이 ${terrainHeight.toFixed(1)}m`);
                    lastLogTimeRef.current = now;
                }
            }).catch(error => {
                // 에러 로그도 줄이기
                const now = Date.now();
                if (now - lastLogTimeRef.current > 5000) {
                    console.warn('⚠️ 지면 높이 샘플링 중 오류:', error);
                    lastLogTimeRef.current = now;
                }
            });
        }
        
        // 다음 프레임 요청
        animationFrameRef.current = requestAnimationFrame(walkingLoop);
        
    }, [viewer, sampleTerrainHeight]);
    
    // 걷기 모드 시작
    const startWalking = useCallback((startPosition: any) => {
        if (!viewer || !window.Cesium || viewer.isDestroyed()) return;
        
        console.log('🚶 걷기 모드 시작:', startPosition);
        
        const Cesium = window.Cesium;
        const startCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(startPosition);
        
        // 현재 카메라의 방향 벡터 저장 (바라보던 방향 유지)
        const currentDirection = viewer.camera.direction.clone();
        const currentUp = viewer.camera.up.clone();
        
        // 지면 높이 + 눈높이로 카메라 위치 설정
        sampleTerrainHeight(
            Cesium.Math.toDegrees(startCartographic.longitude),
            Cesium.Math.toDegrees(startCartographic.latitude)
        ).then(terrainHeight => {
            // 비동기 콜백에서 viewer 상태 재확인
            if (!viewer || viewer.isDestroyed() || !viewer.camera) {
                console.warn('⚠️ 걷기 시작 중 뷰어가 사용할 수 없게 됨');
                return;
            }
            
            const eyeHeight = 1.7;
            startCartographic.height = terrainHeight + eyeHeight;
            
            const finalStartPosition = Cesium.Ellipsoid.WGS84.cartographicToCartesian(startCartographic);
            
            // 카메라를 시작 위치로 이동
            viewer.camera.position = finalStartPosition;
            
            // 창가뷰 훅과 같은 방식으로 수평 방향 설정
            const surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(finalStartPosition, new Cesium.Cartesian3());
            
            // 현재 방향에서 수직 성분을 제거하여 수평 방향 벡터 만들기
            const verticalComponent = Cesium.Cartesian3.multiplyByScalar(
                surfaceNormal, 
                Cesium.Cartesian3.dot(currentDirection, surfaceNormal), 
                new Cesium.Cartesian3()
            );
            const horizontalDirection = Cesium.Cartesian3.subtract(
                currentDirection, 
                verticalComponent, 
                new Cesium.Cartesian3()
            );
            Cesium.Cartesian3.normalize(horizontalDirection, horizontalDirection);
            
            // 임시 카메라로 헤딩 계산
            const tempCamera = new Cesium.Camera(viewer.scene);
            tempCamera.position = finalStartPosition;
            tempCamera.direction = horizontalDirection;
            tempCamera.up = surfaceNormal;
            
            let heading = tempCamera.heading;
            heading = Cesium.Math.toDegrees(heading);
            if (heading < 0) {
                heading += 360;
            }
            
            // MapPrime3D API를 사용해서 카메라 설정
            const cameraView = {
                longitude: Cesium.Math.toDegrees(startCartographic.longitude),
                latitude: Cesium.Math.toDegrees(startCartographic.latitude),
                height: startCartographic.height,
                heading: heading,
                pitch: 10, // 수평에서 10도 위 (MapPrime3D 기준)
                roll: 0
            };
            
            if (viewer._setCameraView) {
                viewer._setCameraView(cameraView);
                console.log(`📹 걷기 모드 카메라 설정 - 헤딩: ${heading.toFixed(1)}°, 피치: 10°`);
            } else {
                console.warn('⚠️ MapPrime3D _setCameraView API 사용 불가');
            }
            
            // 기본 카메라 컨트롤 비활성화
            viewer.scene.screenSpaceCameraController.enableInputs = false;
            
            // 걷기 상태 활성화
            isWalkingRef.current = true;
            walkingStartPositionRef.current = finalStartPosition;
            
            // 걷기 애니메이션 시작
            walkingLoop();
            
            console.log('✅ 걷기 모드 활성화 완료 - WASD로 이동, Shift로 뛰기, ESC로 종료');
        }).catch(error => {
            console.warn('⚠️ 걷기 모드 시작 중 오류:', error);
        });
        
    }, [viewer, sampleTerrainHeight, walkingLoop]);
    
    // 걷기 모드 종료
    const stopWalking = useCallback(() => {
        if (!isWalkingRef.current) {
            // 이미 비활성화된 상태라면 로그 출력 안 함
            return;
        }
        
        console.log('🛑 걷기 모드 종료');
        isWalkingRef.current = false;
        
        // 애니메이션 프레임 취소
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }
        
        // 카메라 컨트롤 복원 - 안전성 체크 강화
        if (viewer && !viewer.isDestroyed()) {
            try {
                if (viewer.camera && window.Cesium && window.Cesium.Matrix4) {
                    viewer.camera.lookAtTransform(window.Cesium.Matrix4.IDENTITY);
                }
                
                if (viewer.scene && 
                    viewer.scene.screenSpaceCameraController && 
                    !viewer.scene.screenSpaceCameraController.isDestroyed()) {
                    viewer.scene.screenSpaceCameraController.enableInputs = true;
                }
            } catch (error) {
                console.warn('⚠️ 카메라 컨트롤 복원 중 오류:', error);
            }
        }
        
        // 키 상태 초기화
        keysRef.current = { W: false, A: false, S: false, D: false, Shift: false };
        walkingStartPositionRef.current = null;
        
        // 캐시 정리
        terrainCacheRef.current = {};
        lastLogTimeRef.current = 0;
        
    }, [viewer]);
    
    // 지면 클릭 처리
    const handleGroundClick = useCallback((worldPosition: any) => {
        console.log('🌍 지면 클릭됨 - 걷기 모드 시작:', worldPosition);
        startWalking(worldPosition);
    }, [startWalking]);
    
    // 클릭 이벤트 핸들러
    const handleClick = useCallback((event: any) => {
        if (!viewer || !isActive) return;
        
        try {
            const position = viewer.scene.pickPosition(event.position);
            
            if (position) {
                const pickedObject = viewer.scene.pick(event.position);
                
                // 건물이 아닌 지면을 클릭했을 때만 걷기 시작
                if (!pickedObject || 
                    !(pickedObject.primitive instanceof window.Cesium.Cesium3DTileset) &&
                    pickedObject.primitive?.constructor?.name !== 'Cesium3DTileset') {
                    
                    console.log('🌍 지면 클릭 감지 - 걷기 모드 시작');
                    handleGroundClick(position);
                } else {
                    console.log('🏢 건물 클릭됨 - 걷기 모드 시작 안 함');
                }
            } else {
                console.log('🖱️ 클릭 위치의 3D 좌표를 가져올 수 없음');
            }
            
        } catch (error) {
            console.error('❌ 클릭 처리 실패:', error);
        }
    }, [viewer, isActive, handleGroundClick]);
    
    // 이벤트 등록
    useEffect(() => {
        if (!viewer || !window.Cesium) return;
        
        const handler = viewer.cesiumWidget.screenSpaceEventHandler;
        
        if (isActive) {
            console.log('✅ 주변 둘러보기 모드 활성화 - 지면 클릭 대기');
            
            // 클릭 이벤트 등록
            handler.setInputAction(handleClick, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
            
            // 키보드 이벤트 등록
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);
            
            return () => {
                console.log('🧹 주변 둘러보기 모드 비활성화');
                
                // 걷기 모드 종료
                stopWalking();
                
                // 이벤트 해제
                if (handler && !handler.isDestroyed()) {
                    handler.removeInputAction(window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
                }
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
            };
        } else if (isWalkingRef.current) {
            // 실제로 걷기 중일 때만 종료 (불필요한 로그 방지)
            stopWalking();
        }
        
    }, [viewer, isActive, handleClick, handleKeyDown, handleKeyUp, stopWalking]);
    
    return {
        isWalking: isWalkingRef.current,
        startWalking,
        stopWalking
    };
}