export * from './useEqbOverlay'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useEqbOverlay(map: kakao.maps.Map | null) {
    const polygonRef = useRef<kakao.maps.Polygon | null>(null)
    const [visible, setVisible] = useState<boolean>(false)

    const clear = useCallback(() => {
        if (polygonRef.current) {
            polygonRef.current.setMap(null)
            polygonRef.current = null
        }
        setVisible(false)
    }, [])

    const showForCenter = useCallback(async (lat: number, lon: number) => {
        if (!map) return
        try {
            const res = await fetch(`/api/geo/eqb?lat=${lat}&lon=${lon}`)
            if (!res.ok) return clear()
            const data = await res.json()
            const feat = data?.features?.[0]
            if (!feat?.geometry) return clear()

            const g = feat.geometry
            const coordsToPath = (coords: any) => coords[0].map(([lng, la]: number[]) => new window.kakao.maps.LatLng(la, lng))
            let path: kakao.maps.LatLng[] = []
            if (g.type === 'Polygon') path = coordsToPath(g.coordinates)
            else if (g.type === 'MultiPolygon') path = coordsToPath(g.coordinates[0])
            else return clear()

            if (polygonRef.current) polygonRef.current.setMap(null)
            polygonRef.current = new window.kakao.maps.Polygon({
                path,
                strokeWeight: 3,
                strokeColor: '#ff4d4f',
                strokeOpacity: 0.9,
                fillColor: '#ff4d4f',
                fillOpacity: 0.2,
            })
            polygonRef.current.setMap(map)
            setVisible(true)
        } catch {
            clear()
        }
    }, [map, clear])

    useEffect(() => () => clear(), [clear])

    return { showForCenter, clear, visible }
}


