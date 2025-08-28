import { useEffect } from 'react'

export const GeoPolygonOverlay = ({ map }: { map: kakao.maps.Map | null }) => {
    useEffect(() => {
        const loadGeojson = async () => {
            try {
                // 현재 지도 bbox를 2.5배 확장해 한번에 로딩
                const bounds = map?.getBounds();
                let url = '/api/geo/upis';
                if (bounds) {
                    const sw = bounds.getSouthWest();
                    const ne = bounds.getNorthEast();
                    const pad = 1.25; // 각 방향 1.25배 → 전체 약 2.5배
                    const cx = (sw.getLng() + ne.getLng()) / 2;
                    const cy = (sw.getLat() + ne.getLat()) / 2;
                    const halfW = (ne.getLng() - sw.getLng()) * pad;
                    const halfH = (ne.getLat() - sw.getLat()) * pad;
                    const xmin = cx - halfW;
                    const ymin = cy - halfH;
                    const xmax = cx + halfW;
                    const ymax = cy + halfH;
                    const zoom = map?.getLevel?.() ?? 12;
                    const params = new URLSearchParams({
                        bbox: `${xmin},${ymin},${xmax},${ymax}`,
                        zoom: String(zoom),
                        limit: '20000',
                        table: 'public.upis_c_uq111'
                    });
                    url = `/api/geo/upis?${params.toString()}`;
                }
                const res = await fetch(url);
                if (!res.ok) return;
                const data = await res.json();
                const features = data.features || [];

                features.forEach((f: any) => {
                    if (!f?.geometry?.coordinates) return;
                    const g = f.geometry;
                    const drawPolygon = (coords: any) => {
                        const ring = coords[0];
                        if (!Array.isArray(ring)) return;
                        const path = ring.map(([lng, lat]: number[]) => new window.kakao.maps.LatLng(lat, lng));
                        const polygon = new window.kakao.maps.Polygon({
                            path,
                            strokeWeight: 2,
                            strokeColor: '#004c80',
                            strokeOpacity: 0.8,
                            fillColor: '#00a0e9',
                            fillOpacity: 0.2,
                        });
                        polygon.setMap(map);
                    }

                    if (g.type === 'Polygon') drawPolygon(g.coordinates);
                    if (g.type === 'MultiPolygon') g.coordinates.forEach((coords: any) => drawPolygon(coords));
                });
            } catch (e) {
                // noop
            }
        };

        if (map) loadGeojson();
    }, [map]);

    return null;
}

export default GeoPolygonOverlay;


