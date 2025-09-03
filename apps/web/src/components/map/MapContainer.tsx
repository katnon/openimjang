import { useEffect, useRef, useCallback } from "react";
import { useEqbOverlay } from "@/hooks/useEqbOverlay";
import type { POIItem } from "@/types/poi";

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
    tempMarker?: POIItem | null; // 임시 마커 (POI 호버용)
};

const MapContainer: React.FC<MapContainerProps> = ({
    onMapClick,
    onAptSelected,
    selectedApt,
    isCardExpanded = false,
    cardWidth = 320,
    tempMarker
}) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<kakao.maps.Map | null>(null);
    const markerRef = useRef<kakao.maps.Marker | null>(null);
    const tempMarkerRef = useRef<kakao.maps.Marker | null>(null);



    // ✅ 건물군(아파트 단지 경계) 오버레이 훅
    const { showForCenter: showEqb, clear: clearEqb } = useEqbOverlay(mapInstance.current);

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


    // 지도 초기화
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.kakao === "undefined") return;

        window.kakao.maps.load(() => {
            if (!mapRef.current || mapInstance.current) return;


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
                        // 아파트 단지 경계 표시
                        await showEqb(nearestApt.lat, nearestApt.lon);
                    }
                } catch (error) {
                    // 조용히 무시
                }
            });
        });
    }, [stableOnMapClick, stableOnAptSelected]);

    useEffect(() => {
        adjustMapCenter();
    }, [adjustMapCenter]);

    // ✅ 임시 마커 업데이트 (POI 호버)
    useEffect(() => {
        if (!mapInstance.current) return;

        const map = mapInstance.current;

        // 기존 임시 마커 제거
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setMap(null);
            tempMarkerRef.current = null;
        }

        // 새 임시 마커 생성
        if (tempMarker) {
            const lat = parseFloat(tempMarker.y);
            const lng = parseFloat(tempMarker.x);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const latlng = new window.kakao.maps.LatLng(lat, lng);
                
                // 기본 카카오 마커 사용 (빨간색)
                const marker = new window.kakao.maps.Marker({
                    position: latlng,
                    title: tempMarker.place_name
                });

                marker.setMap(map);
                tempMarkerRef.current = marker;
                
            }
        }
    }, [tempMarker]);

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

            // 선택된 아파트 중심좌표로 단지 경계 표시
            showEqb(selectedApt.lat, selectedApt.lon);
        } else {
            if (markerRef.current) {
                markerRef.current.setMap(null);
            }
            // 선택 해제 시 단지 경계도 제거
            clearEqb();
        }
    }, [selectedApt, isCardExpanded, showEqb, clearEqb]);

    return (
        <div className="w-full h-full relative">
            {/* ✅ 지도 컨테이너에 클래스 추가 */}
            <div ref={mapRef} className="w-full h-full kakao-map" />



        </div>
    );
};

export default MapContainer;
