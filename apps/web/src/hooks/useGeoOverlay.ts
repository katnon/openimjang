import { useCallback, useEffect, useRef, useState } from 'react'

export type GeoLayer = {
    id: string
    table: string
    name: string
    visible: boolean
    color: string
    fillOpacity: number
    strokeWeight: number
}

// 사용자 DB에 존재하는 테이블 기준 (이미지/설계서 기준)
const DEFAULT_LAYERS: GeoLayer[] = [
    { id: 'uq111', table: 'public.upis_c_uq111', name: '도시지역(현황)', visible: false, color: '#00a0e9', fillOpacity: 0.18, strokeWeight: 1 },
    { id: 'uq121', table: 'public.upis_c_uq121', name: '경관지구(현황)', visible: false, color: '#34d399', fillOpacity: 0.15, strokeWeight: 1 },
    { id: 'uq122', table: 'public.upis_c_uq122', name: '미관지구(현황)', visible: false, color: '#f59e0b', fillOpacity: 0.15, strokeWeight: 1 },
    { id: 'uq123', table: 'public.upis_c_uq123', name: '고도지구(현황)', visible: false, color: '#ef4444', fillOpacity: 0.15, strokeWeight: 1 },
    { id: 'uq124', table: 'public.upis_c_uq124', name: '방화지구(현황)', visible: false, color: '#8b5cf6', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq125', table: 'public.upis_c_uq125', name: '방재지구(현황)', visible: false, color: '#f97316', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq126', table: 'public.upis_c_uq126', name: '보존지구(현황)', visible: false, color: '#10b981', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq128', table: 'public.upis_c_uq128', name: '취락지구(현황)', visible: false, color: '#3b82f6', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq129', table: 'public.upis_c_uq129', name: '개발진흥지구(현황)', visible: false, color: '#6366f1', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq130', table: 'public.upis_c_uq130', name: '특정용도제한지구(현황)', visible: false, color: '#f43f5e', fillOpacity: 0.12, strokeWeight: 1 },
    { id: 'uq131', table: 'public.upis_c_uq131', name: '기타용도지구(현황)', visible: false, color: '#0ea5e9', fillOpacity: 0.12, strokeWeight: 1 },
]

export function useGeoOverlay(map: kakao.maps.Map | null) {
    const [layers, setLayers] = useState<GeoLayer[]>(() => DEFAULT_LAYERS.map(l => ({ ...l })))

    const polygonsRef = useRef<Record<string, kakao.maps.Polygon[]>>({})
    const fetchedRef = useRef<Set<string>>(new Set())
    const globalCycleRef = useRef<number>(0)
    const requestTokenRef = useRef<Record<string, number>>({})
    const abortCtrlsRef = useRef<Record<string, AbortController | null>>({})

    const buildUrl = useCallback((table: string) => {
        if (!map) return '/api/geo/upis?table=' + encodeURIComponent(table)
        const b = map.getBounds()
        if (!b) return '/api/geo/upis?table=' + encodeURIComponent(table)
        const sw = b.getSouthWest()
        const ne = b.getNorthEast()
        const pad = 1.25
        const cx = (sw.getLng() + ne.getLng()) / 2
        const cy = (sw.getLat() + ne.getLat()) / 2
        const halfW = (ne.getLng() - sw.getLng()) * pad
        const halfH = (ne.getLat() - sw.getLat()) * pad
        const xmin = cx - halfW
        const ymin = cy - halfH
        const xmax = cx + halfW
        const ymax = cy + halfH
        const level = (map as any).getLevel?.() ?? 12
        const qs = new URLSearchParams({ table, bbox: `${xmin},${ymin},${xmax},${ymax}`, zoom: String(level), limit: '20000' })
        return `/api/geo/upis?${qs.toString()}`
    }, [map])

    const toggleLayer = useCallback(async (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))

        // 끄는 즉시 화면에서 제거하고, 진행 중 요청은 중단
        const arr = polygonsRef.current[id]
        if (arr) arr.forEach(p => p.setMap(map)) // map 그대로 두고, 상태 효과에서 즉시 반영됨
        const ctrl = abortCtrlsRef.current[id]
        if (ctrl) {
            try { ctrl.abort() } catch { }
            abortCtrlsRef.current[id] = null
        }
    }, [])

    const hideAll = useCallback(() => {
        setLayers(prev => prev.map(l => ({ ...l, visible: false })))
        // 모든 진행 중 요청 취소 및 지도에서 제거
        Object.keys(abortCtrlsRef.current).forEach(id => {
            const ctrl = abortCtrlsRef.current[id]
            if (ctrl) {
                try { ctrl.abort() } catch { }
                abortCtrlsRef.current[id] = null
            }
        })
        Object.keys(polygonsRef.current).forEach(id => {
            const arr = polygonsRef.current[id]
            if (arr) arr.forEach(p => p.setMap(null))
        })
    }, [])

    // 실제 폴리곤 setMap 처리 (레이어 상태가 바뀔 때마다 즉시 반영)
    useEffect(() => {
        if (!map) return
        layers.forEach(layer => {
            const arr = polygonsRef.current[layer.id] || []
            arr.forEach(p => p.setMap(layer.visible ? map : null))
            // 꺼졌으면 요청도 취소
            if (!layer.visible) {
                const ctrl = abortCtrlsRef.current[layer.id]
                if (ctrl) {
                    try { ctrl.abort() } catch { }
                    abortCtrlsRef.current[layer.id] = null
                }
            }
        })
    }, [map, layers])

    // 첫 가시화 시 fetch 후 생성 (한 번만)
    useEffect(() => {
        if (!map) return
        layers.forEach(async (layer) => {
            if (!layer.visible) return
            if (fetchedRef.current.has(layer.id)) return

            try {
                const url = buildUrl(layer.table)
                // 요청 토큰/중단 컨트롤러 설정
                const token = ++globalCycleRef.current
                requestTokenRef.current[layer.id] = token
                const ctrl = new AbortController()
                abortCtrlsRef.current[layer.id] = ctrl

                const res = await fetch(url, { signal: ctrl.signal })
                if (!res.ok) return
                const data = await res.json()
                const feats = data.features || []

                const created: kakao.maps.Polygon[] = []

                feats.forEach((f: any) => {
                    const g = f?.geometry
                    if (!g) return

                    const drawPolygon = (coords: any) => {
                        const ring = coords[0]
                        if (!Array.isArray(ring)) return
                        const path = ring.map(([lng, lat]: number[]) => new window.kakao.maps.LatLng(lat, lng))
                        const poly = new window.kakao.maps.Polygon({
                            path,
                            strokeWeight: layer.strokeWeight,
                            strokeColor: layer.color,
                            strokeOpacity: 0.8,
                            fillColor: layer.color,
                            fillOpacity: layer.fillOpacity,
                        })
                        // 응답 도착 시점에 여전히 최신 토큰인지 확인 (사이클 가드)
                        if (requestTokenRef.current[layer.id] !== token) {
                            return
                        }
                        poly.setMap(layer.visible ? map : null)
                        // 간단한 hover 라벨: 주요 속성 present_sn 또는 dgm_nm 등
                        const props = f.properties || {}
                        const title = props.dgm_nm || props.present_sn || layer.name
                        // kakao.maps.InfoWindow 대신 클릭 시 콘솔로 먼저 확인
                        window.kakao.maps.event.addListener(poly, 'click', () => {
                            console.log('🔎 속성', title, props)
                        })
                        created.push(poly)
                    }

                    if (g.type === 'Polygon') {
                        drawPolygon(g.coordinates)
                    } else if (g.type === 'MultiPolygon') {
                        g.coordinates.forEach((coords: any) => drawPolygon(coords))
                    }
                })

                // 여전히 최신 토큰인지 확인 후 반영
                if (requestTokenRef.current[layer.id] === token) {
                    polygonsRef.current[layer.id] = created
                    fetchedRef.current.add(layer.id)
                } else {
                    // 오래된 응답이면 지도에 올리지 않음
                    created.forEach(p => p.setMap(null))
                }
            } catch (_e) {
                // noop
            }
            finally {
                // 컨트롤러 정리
                abortCtrlsRef.current[layer.id] = null
            }
        })
    }, [map, layers, buildUrl])

    // 정리
    useEffect(() => {
        return () => {
            Object.values(polygonsRef.current).forEach(arr => arr.forEach(p => p.setMap(null)))
            polygonsRef.current = {}
            fetchedRef.current.clear()
        }
    }, [])

    return {
        layers,
        toggleLayer,
        hideAll,
    }
}
