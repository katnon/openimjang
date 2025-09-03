import { useCallback, useRef } from 'react'

export function use3DEqbHighlight(viewer: any, abortController?: AbortController | null) {
    const highlightEntityRef = useRef<any>(null)
    const requestTokenRef = useRef<number>(0)
    const activePromisesRef = useRef<Set<Promise<any>>>(new Set())

    const clearHighlight = useCallback(() => {
        // 진행 중인 모든 비동기 작업 정리
        activePromisesRef.current.clear();
        
        // viewer가 null이거나 하이라이트가 없으면 ref만 정리하고 종료
        if (!viewer) {
            highlightEntityRef.current = null
            return
        }

        if (highlightEntityRef.current && viewer && viewer.entities) {
            try {
                const highlight = highlightEntityRef.current

                // 뷰어와 entities 컬렉션 유효성 재검사
                if (!viewer.entities || viewer.isDestroyed?.()) {
                    console.warn('⚠️ Viewer가 파괴됨, Entity 정리 생략')
                    highlightEntityRef.current = null
                    return
                }

                // 복합 Entity인 경우 (Polyline 방식)
                if (highlight.bottomLine || highlight.topLine || highlight.verticalLines) {
                    // 각 Entity의 유효성을 확인한 후 제거
                    if (highlight.bottomLine && viewer.entities.contains(highlight.bottomLine)) {
                        try {
                            viewer.entities.remove(highlight.bottomLine)
                        } catch (e) {
                            // 조용히 무시
                        }
                    }
                    
                    if (highlight.topLine && viewer.entities.contains(highlight.topLine)) {
                        try {
                            viewer.entities.remove(highlight.topLine)
                        } catch (e) {
                            // 조용히 무시
                        }
                    }
                    
                    if (highlight.verticalLines && Array.isArray(highlight.verticalLines)) {
                        highlight.verticalLines.forEach((vl: any) => {
                            try { 
                                if (vl && viewer.entities.contains(vl)) {
                                    viewer.entities.remove(vl)
                                }
                            } catch (e) {
                                // 조용히 무시
                            }
                        })
                    }
                } else {
                    // 단일 Entity인 경우 - 유효성 검사 후 제거
                    if (highlight && viewer.entities.contains(highlight)) {
                        try {
                            viewer.entities.remove(highlight)
                        } catch (e) {
                            // 조용히 무시
                        }
                    }
                }

                highlightEntityRef.current = null

                // 렌더링 복구 시도 - 뷰어 상태 재확인
                if (viewer.scene && !viewer.isDestroyed?.()) {
                    try {
                        viewer.scene.requestRender()
                        viewer.scene.renderingEnabled = true
                    } catch (e) {
                        console.warn('렌더링 복구 실패:', e)
                    }
                }
            } catch (e) {
                console.warn('3D 하이라이트 제거 실패:', e)
                // 강제로 null 처리 및 렌더링 복구
                highlightEntityRef.current = null
                try {
                    if (viewer.scene && !viewer.isDestroyed?.()) {
                        viewer.scene.renderingEnabled = true
                        viewer.scene.requestRender()
                    }
                } catch { }
            }
        } else {
            // viewer나 entities가 없는 경우에도 ref 정리
            highlightEntityRef.current = null
        }
    }, [viewer])

    const highlightApartment = useCallback(async (lat: number, lon: number) => {
        // viewer가 null인 경우 조기 종료
        if (!viewer) {
            console.warn('⚠️ 3D viewer가 준비되지 않음')
            return
        }

        // 뷰어와 필수 컴포넌트 유효성 검사
        if (!viewer.entities || !viewer.terrainProvider || viewer.isDestroyed?.()) {
            console.warn('⚠️ 뷰어가 완전히 초기화되지 않았거나 파괴됨')
            return
        }

        try {
            // 요청 토큰 생성 (중복/오래된 요청 방지)
            const currentToken = ++requestTokenRef.current
            console.log(`🏢 3D 단지 하이라이트 요청 [${currentToken}]: ${lat}, ${lon}`)

            // 기존 하이라이트 완전 제거 및 대기
            clearHighlight()

            // 약간의 지연을 두어 이전 Entity 정리 완료 보장
            await new Promise(resolve => setTimeout(resolve, 150))

            // AbortController 상태 확인
            if (abortController?.signal.aborted) {
                console.log(`🚫 [${currentToken}] 요청이 취소됨 (AbortController)`);
                return;
            }

            // 2D와 동일한 API로 건물군 폴리곤 조회 (AbortController 적용)
            const res = await fetch(`/api/eqb?lat=${lat}&lon=${lon}`, {
                signal: abortController?.signal
            })
            if (!res.ok) {
                console.warn('⚠️ /api/eqb 응답 실패:', res.status)
                return
            }

            const data = await res.json()
            const feat = data?.features?.[0]
            if (!feat?.geometry) {
                console.warn('⚠️ 해당 좌표에 건물군 없음')
                return
            }

            const g = feat.geometry
            let coordinates: number[][] = []

            // GeoJSON → 좌표 배열 추출
            if (g.type === 'Polygon') {
                coordinates = g.coordinates[0] // 외곽 링만 사용
            } else if (g.type === 'MultiPolygon') {
                coordinates = g.coordinates[0][0] // 첫 번째 폴리곤의 외곽 링
            } else {
                console.warn('⚠️ 지원하지 않는 geometry type:', g.type)
                return
            }

            // 좌표 유효성 검사
            if (!Array.isArray(coordinates) || coordinates.length < 3) {
                console.warn('⚠️ 좌표 배열 부족:', coordinates.length)
                return
            }

            // 경위도 좌표 배열 준비 (높이값 샘플링용)
            const degreePositions = coordinates.map(([lng, lat]: number[]) => ({ lng, lat }))

            // 닫힌 링 보장
            if (degreePositions.length > 0) {
                const first = degreePositions[0]
                const last = degreePositions[degreePositions.length - 1]
                if (Math.abs(first.lng - last.lng) > 0.000001 || Math.abs(first.lat - last.lat) > 0.000001) {
                    degreePositions.push({ ...first })
                }
            }

            if (degreePositions.length < 4) {
                console.warn('⚠️ 폴리곤 좌표 부족:', degreePositions.length, '개 (최소 4개 필요)')
                return
            }

            console.log('🔍 3D 폴리곤 좌표:', degreePositions.length, '개')

            // 울타리형 경계 생성 (1순위: 모든 점 높이 샘플링)
            try {
                console.log('🔍 모든 좌표점의 터레인 높이 샘플링 시작...')

                // 모든 좌표점에 대해 터레인 높이 샘플링
                const cartographics = degreePositions.map(({ lng, lat }) =>
                    window.Cesium.Cartographic.fromDegrees(lng, lat)
                )

                const terrainProvider = viewer.terrainProvider
                let promise = window.Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics)
                
                // AbortController와 연동
                if (abortController) {
                    promise = Promise.race([
                        promise,
                        new Promise<any[]>((_, reject) => {
                            abortController.signal.addEventListener('abort', () => {
                                reject(new DOMException('Operation was aborted', 'AbortError'));
                            });
                        })
                    ]);
                }
                
                activePromisesRef.current.add(promise);

                promise.then((sampledPositions: any[]) => {
                    activePromisesRef.current.delete(promise);
                    // 토큰 검사: 오래된 응답이면 무시
                    if (requestTokenRef.current !== currentToken) {
                        console.log(`⏰ 오래된 응답 무시 [${currentToken}]`)
                        return
                    }

                    // 뷰어 유효성 재검사 (비동기 작업 중 뷰어가 파괴될 수 있음)
                    if (!viewer || !viewer.entities || viewer.isDestroyed?.()) {
                        console.warn(`⚠️ [${currentToken}] 뷰어가 파괴됨, 하이라이트 생성 중단`)
                        return
                    }

                    console.log(`🏔️ [${currentToken}] ${sampledPositions.length}개 점의 높이 샘플링 완료`)

                    // 울타리 생성: Polyline으로 안정적 구현 (Wall 대신)
                    try {
                        // 지면 레벨과 상단 레벨 Polyline 2개로 울타리 구현
                        const bottomPositions = sampledPositions.map((pos, i) => {
                            const height = pos.height || 0
                            const { lng, lat } = degreePositions[i]
                            return window.Cesium.Cartesian3.fromDegrees(lng, lat, height + 0.5)
                        })

                        const topPositions = sampledPositions.map((pos, i) => {
                            const height = pos.height || 0
                            const { lng, lat } = degreePositions[i]
                            return window.Cesium.Cartesian3.fromDegrees(lng, lat, height + 3.0)
                        })

                        let bottomLine = null
                        let topLine = null
                        const verticalLines: any[] = []

                        // Entity 생성 전 뷰어 상태 재확인
                        if (!viewer || !viewer.entities || viewer.isDestroyed?.()) {
                            console.warn(`⚠️ [${currentToken}] Entity 생성 직전 뷰어 파괴됨`)
                            return
                        }

                        // 하단 경계선
                        try {
                            bottomLine = viewer.entities.add({
                                polyline: {
                                    positions: bottomPositions,
                                    width: 4,
                                    material: window.Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.9),
                                    clampToGround: false
                                }
                            })
                        } catch (e) {
                            console.error(`❌ [${currentToken}] bottomLine 생성 실패:`, e)
                            return
                        }

                        // 상단 경계선
                        try {
                            topLine = viewer.entities.add({
                                polyline: {
                                    positions: topPositions,
                                    width: 4,
                                    material: window.Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.9),
                                    clampToGround: false
                                }
                            })
                        } catch (e) {
                            console.error(`❌ [${currentToken}] topLine 생성 실패:`, e)
                            // bottomLine만 생성된 경우 정리
                            if (bottomLine) {
                                try { viewer.entities.remove(bottomLine) } catch {}
                            }
                            return
                        }

                        // 수직 연결선들 (울타리 기둥 효과)
                        for (let i = 0; i < bottomPositions.length; i += Math.max(1, Math.floor(bottomPositions.length / 12))) {
                            try {
                                if (!viewer || !viewer.entities || viewer.isDestroyed?.()) {
                                    console.warn(`⚠️ [${currentToken}] 수직선 생성 중 뷰어 파괴됨`)
                                    break
                                }
                                
                                const vertLine = viewer.entities.add({
                                    polyline: {
                                        positions: [bottomPositions[i], topPositions[i]],
                                        width: 2,
                                        material: window.Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.7),
                                        clampToGround: false
                                    }
                                })
                                verticalLines.push(vertLine)
                            } catch (e) {
                                console.warn(`❌ [${currentToken}] verticalLine[${i}] 생성 실패:`, e)
                                // 실패해도 계속 진행
                            }
                        }

                        // 최종 토큰 검사 및 저장
                        if (bottomLine && topLine && requestTokenRef.current === currentToken) {
                            // 복합 Entity로 저장 (나중에 일괄 제거용)
                            highlightEntityRef.current = { bottomLine, topLine, verticalLines }
                            console.log(`✅ [${currentToken}] 3D 울타리 하이라이트 생성 완료 (Polyline 방식)`)
                        } else {
                            // 토큰 불일치 시 생성된 것들 정리
                            console.log(`🧹 [${currentToken}] 토큰 불일치로 Entity 정리`)
                            try {
                                if (bottomLine && viewer.entities && viewer.entities.contains(bottomLine)) {
                                    viewer.entities.remove(bottomLine)
                                }
                                if (topLine && viewer.entities && viewer.entities.contains(topLine)) {
                                    viewer.entities.remove(topLine)
                                }
                                verticalLines.forEach(vl => {
                                    try {
                                        if (vl && viewer.entities && viewer.entities.contains(vl)) {
                                            viewer.entities.remove(vl)
                                        }
                                    } catch {}
                                })
                            } catch (e) {
                                console.warn('토큰 불일치 정리 중 오류:', e)
                            }
                        }
                    } catch (entityError) {
                        console.error(`❌ [${currentToken}] Polyline Entity 생성 실패:`, entityError)
                    }

                }).catch((sampleError: any) => {
                    activePromisesRef.current.delete(promise);
                    
                    // AbortError인 경우 조기 종료
                    if (sampleError.name === 'AbortError') {
                        console.log(`🚫 [${currentToken}] 높이 샘플링 취소됨`);
                        return;
                    }
                    
                    console.warn('⚠️ 높이 샘플링 실패, 단순 울타리로 fallback:', sampleError)

                    // 토큰 및 뷰어 유효성 재검사
                    if (requestTokenRef.current !== currentToken || !viewer || !viewer.entities || viewer.isDestroyed?.()) {
                        console.warn(`⚠️ [${currentToken}] fallback 중 뷰어 파괴됨`)
                        return
                    }

                    try {
                        // 높이 샘플링 실패 시 고정 높이 울타리
                        const positions = degreePositions.map(({ lng, lat }) =>
                            window.Cesium.Cartesian3.fromDegrees(lng, lat)
                        )

                        const entity = viewer.entities.add({
                            wall: {
                                positions: positions,
                                material: window.Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.8),
                                outline: true,
                                outlineColor: window.Cesium.Color.fromCssColorString('#ff4d4f'),
                                minimumHeights: new Array(positions.length).fill(0),
                                maximumHeights: new Array(positions.length).fill(2)
                            }
                        })

                        if (entity && requestTokenRef.current === currentToken) {
                            highlightEntityRef.current = entity

                            // 렌더링 강제 업데이트
                            if (viewer.scene && !viewer.isDestroyed?.()) {
                                viewer.scene.requestRender()
                            }
                        } else if (entity) {
                            // 토큰 불일치 시 정리
                            try {
                                if (viewer.entities && viewer.entities.contains(entity)) {
                                    viewer.entities.remove(entity)
                                }
                            } catch {}
                        }
                    } catch (fallbackError) {
                        console.error(`❌ [${currentToken}] fallback Entity 생성 실패:`, fallbackError)
                    }
                })

            } catch (wallError) {
                console.warn('⚠️ 울타리 생성 실패, 공중 폴리곤으로 fallback:', wallError)

                // Fallback: 터레인 높이 샘플링 방식 (기존 1순위)
                const centerLng = degreePositions.reduce((sum, p) => sum + p.lng, 0) / degreePositions.length
                const centerLat = degreePositions.reduce((sum, p) => sum + p.lat, 0) / degreePositions.length

                const terrainProvider = viewer.terrainProvider
                const cartographics = [window.Cesium.Cartographic.fromDegrees(centerLng, centerLat)]

                let promise = window.Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics)
                
                // AbortController와 연동 (fallback용)
                if (abortController) {
                    promise = Promise.race([
                        promise,
                        new Promise<any[]>((_, reject) => {
                            abortController.signal.addEventListener('abort', () => {
                                reject(new DOMException('Operation was aborted', 'AbortError'));
                            });
                        })
                    ]);
                }
                
                activePromisesRef.current.add(promise);
                
                promise.then((sampledPositions: any[]) => {
                    activePromisesRef.current.delete(promise);
                    // 토큰 및 뷰어 유효성 재검사
                    if (requestTokenRef.current !== currentToken || !viewer || !viewer.entities || viewer.isDestroyed?.()) {
                        console.warn(`⚠️ [${currentToken}] 최종 fallback 중 뷰어 파괴됨`)
                        return
                    }

                    const terrainHeight = sampledPositions[0]?.height || 0
                    const polygonHeight = terrainHeight + 5

                    console.log(`🏔️ [${currentToken}] 최종 Fallback - 터레인 높이: ${terrainHeight.toFixed(1)}m, 폴리곤 높이: ${polygonHeight.toFixed(1)}m`)

                    try {
                        const cartesianPositions = degreePositions.map(({ lng, lat }) =>
                            window.Cesium.Cartesian3.fromDegrees(lng, lat, polygonHeight)
                        )

                        const entity = viewer.entities.add({
                            polygon: {
                                hierarchy: new window.Cesium.PolygonHierarchy(cartesianPositions),
                                material: window.Cesium.Color.fromCssColorString('#ff4d4f').withAlpha(0.4),
                                outline: true,
                                outlineColor: window.Cesium.Color.fromCssColorString('#ff4d4f'),
                                height: polygonHeight,
                                extrudedHeight: polygonHeight + 2,
                            }
                        })

                        if (entity && requestTokenRef.current === currentToken) {
                            highlightEntityRef.current = entity
                            console.log(`✅ [${currentToken}] 3D 단지 하이라이트 생성 완료 (최종 fallback)`)
                        } else if (entity) {
                            // 토큰 불일치 시 정리
                            try {
                                if (viewer.entities && viewer.entities.contains(entity)) {
                                    viewer.entities.remove(entity)
                                }
                            } catch {}
                        }
                    } catch (polygonError) {
                        console.error(`❌ [${currentToken}] 최종 fallback Polygon 생성 실패:`, polygonError)
                    }
                }).catch((finalError) => {
                    activePromisesRef.current.delete(promise);
                    
                    // AbortError인 경우 조기 종료
                    if (finalError.name === 'AbortError') {
                        console.log(`🚫 [${currentToken}] 최종 fallback 취소됨`);
                        return;
                    }
                    
                    console.warn(`⚠️ [${currentToken}] 모든 방법 실패:`, finalError)
                })
            }

        } catch (e: any) {
            // AbortError인 경우 조용히 종료
            if (e.name === 'AbortError') {
                console.log(`🚫 [${currentToken}] 3D 하이라이트 작업 취소됨`);
                return;
            }
            
            console.error('❌ 3D 하이라이트 실패:', e)
        }
    }, [viewer, clearHighlight])

    return {
        highlightApartment,
        clearHighlight
    }
}


