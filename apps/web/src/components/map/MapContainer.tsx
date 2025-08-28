import { useEffect, useRef, useCallback, useState } from "react";
import { useWMSTileset } from "@/hooks/useWMSTileset";
import WMSPanel from "./WMSPanel";
import GeoPolygonOverlay from "./GeoPolygonOverlay";
import { useGeoOverlay } from "@/hooks/useGeoOverlay";
import GeoLayerPanel from "./GeoLayerPanel";

type AptInfo = {
    id: number;
    apt_nm: string;
    jibun_address: string;
    lat: number;
    lon: number;
};

type MapContainerProps = {
    onMapClick?: (lat: number, lng: number) => void;
    onAptSelected?: (apt: AptInfo) => void;
    selectedApt?: {
        lat: number;
        lon: number;
    } | null;
    isCardExpanded?: boolean;
    cardWidth?: number;
    showLayerControl?: boolean;
    onLayerControlToggle?: (show: boolean) => void;
};

const MapContainer: React.FC<MapContainerProps> = ({
    onMapClick,
    onAptSelected,
    selectedApt,
    isCardExpanded = false,
    cardWidth = 320,
    showLayerControl = false,
    onLayerControlToggle
}) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<kakao.maps.Map | null>(null);
    const markerRef = useRef<kakao.maps.Marker | null>(null);

    // ✅ WMS 관리 훅
    const {
        layers,
        activeTilesets,
        debugEnvironment,
        fetchAvailableLayers,
        toggleLayer,
        hideAllLayers,
        // clearCanvas,
        redrawAllLayers
    } = useWMSTileset(mapInstance.current);

    // ✅ GeoJSON 레이어 훅
    const { layers: geoLayers, toggleLayer: toggleGeo, hideAll: hideAllGeo } = useGeoOverlay(mapInstance.current);
    const [showGeoPanel, setShowGeoPanel] = useState(false);

    const stableOnMapClick = useCallback((lat: number, lng: number) => {
        onMapClick?.(lat, lng);
    }, [onMapClick]);

    const stableOnAptSelected = useCallback((apt: AptInfo) => {
        onAptSelected?.(apt);
    }, [onAptSelected]);

    // 지도 중심 조정
    const adjustMapCenter = useCallback(() => {
        if (!mapInstance.current || !selectedApt) return;

        const map = mapInstance.current;
        const containerWidth = mapRef.current?.offsetWidth || window.innerWidth;

        if (isCardExpanded) {
            const availableWidth = containerWidth - cardWidth;
            const targetOffsetX = cardWidth + (availableWidth / 2);
            const targetRatio = targetOffsetX / containerWidth;

            const bounds = map.getBounds();
            if (!bounds) return;

            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();

            if (!sw || !ne) return;

            const lngSpan = ne.getLng() - sw.getLng();
            const lngOffset = lngSpan * (0.5 - targetRatio);

            const newCenter = new window.kakao.maps.LatLng(
                selectedApt.lat,
                selectedApt.lon + lngOffset
            );

            map.panTo(newCenter);
        } else {
            const originalCenter = new window.kakao.maps.LatLng(selectedApt.lat, selectedApt.lon);
            map.panTo(originalCenter);
        }
    }, [selectedApt, isCardExpanded, cardWidth]);

    // 테스트 함수들
    const testEnvironment = useCallback(async () => {
        try {
            const envData = await debugEnvironment();
            if (envData) {
                alert(`🔐 BFF 환경변수:\nVWorld Key: ${envData.hasVWorldKey ? '✓' : '✗'}\nDomain: ${envData.vworldDomain}`);
            }
        } catch (error) {
            alert(`❌ 환경변수 확인 실패:\n${error}`);
        }
    }, [debugEnvironment]);

    const testConnection = useCallback(async () => {
        try {
            const layers = await fetchAvailableLayers();
            if (layers && layers.length > 0) {
                alert(`✅ VWorld 연결 성공!\n레이어 ${layers.length}개 사용 가능`);
            }
        } catch (error) {
            alert(`❌ 연결 실패:\n${error}`);
        }
    }, [fetchAvailableLayers]);

    // 수동 레이어 새로고침
    const handleRefreshLayers = useCallback(() => {
        console.log('🔄 WMS 레이어 새로고침');
        redrawAllLayers();
    }, [redrawAllLayers]);

    // 지도 초기화
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.kakao === "undefined") return;

        window.kakao.maps.load(() => {
            if (!mapRef.current || mapInstance.current) return;

            console.log("🗺️ 지도 초기화");

            const center = new window.kakao.maps.LatLng(37.5665, 126.978);
            const map = new window.kakao.maps.Map(mapRef.current, {
                center,
                level: 8,
            });

            mapInstance.current = map;

            // 지도 클릭 이벤트
            window.kakao.maps.event.addListener(map, "click", async (mouseEvent: any) => {
                const latlng = mouseEvent.latLng;
                const lat = latlng.getLat();
                const lng = latlng.getLng();

                stableOnMapClick(lat, lng);

                try {
                    const response = await fetch(`/api/search/nearest?lat=${lat}&lng=${lng}`);
                    const nearestApt = await response.json();

                    if (nearestApt) {
                        stableOnAptSelected(nearestApt);
                    }
                } catch (error) {
                    console.error("❌ 아파트 검색 실패:", error);
                }
            });
        });
    }, [stableOnMapClick, stableOnAptSelected]);

    useEffect(() => {
        adjustMapCenter();
    }, [adjustMapCenter]);

    // ✅ 마커 업데이트 - null 체크 강화
    useEffect(() => {
        if (!mapInstance.current) return;

        const map = mapInstance.current;

        if (selectedApt) {
            const latlng = new window.kakao.maps.LatLng(selectedApt.lat, selectedApt.lon);
            const imageSize = new window.kakao.maps.Size(48, 48);
            const imageOption = { offset: new window.kakao.maps.Point(24, 48) };
            const markerImage = new window.kakao.maps.MarkerImage("/icon-192.png", imageSize, imageOption);

            const existing = markerRef.current as kakao.maps.Marker | null;
            if (!existing) {
                const created = new window.kakao.maps.Marker({ position: latlng, image: markerImage });
                created.setMap(map);
                markerRef.current = created;
            } else {
                existing.setPosition(latlng);
                existing.setImage(markerImage);
                existing.setMap(map);
            }

            if (!isCardExpanded) {
                map.panTo(latlng);
            }
        } else {
            if (markerRef.current) {
                markerRef.current.setMap(null);
            }
        }
    }, [selectedApt, isCardExpanded]);

    return (
        <div className="w-full h-full relative">
            {/* ✅ 지도 컨테이너에 클래스 추가 */}
            <div ref={mapRef} className="w-full h-full kakao-map" />

            {/* 좌상단 Geo 레이어 토글 버튼 */}
            <div className="absolute left-4 top-4 z-10 flex gap-2">
                <button
                    onClick={() => setShowGeoPanel(v => !v)}
                    className="px-3 py-2 text-sm bg-white border rounded shadow hover:bg-gray-50"
                >
                    Geo 레이어
                </button>
            </div>

            {/* WMS 레이어 패널 */}
            {showLayerControl && (
                <WMSPanel
                    layers={layers}
                    activeTilesets={activeTilesets}
                    onToggleLayer={toggleLayer}
                    onHideAll={hideAllLayers}
                    onClose={() => onLayerControlToggle?.(false)}
                    onTestEnvironment={testEnvironment}
                    onTestConnection={testConnection}
                    onRefreshLayers={handleRefreshLayers}
                />
            )}

            {/* GeoJSON 레이어 패널 */}
            {showGeoPanel && (
                <GeoLayerPanel
                    layers={geoLayers}
                    onToggle={toggleGeo}
                    onHideAll={hideAllGeo}
                    onClose={() => setShowGeoPanel(false)}
                />
            )}

            {/* GeoJSON 폴리곤 테스트 렌더 */}
            {mapInstance.current && (
                <GeoPolygonOverlay map={mapInstance.current} />
            )}
        </div>
    );
};

export default MapContainer;
