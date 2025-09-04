import { useEffect, useRef, useCallback } from "react";
import { useEqbOverlay } from "@/hooks/useEqbOverlay";
import type { POIItem } from "@/types/poi";
import { useAuth } from "@/auth/AuthProvider";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

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
    onMapReady?: (map: kakao.maps.Map, refreshFavorites: () => void) => void; // 지도 인스턴스와 새로고침 함수 전달
    selectedApt?: {
        lat: number;
        lon: number;
    } | null;
    isCardExpanded?: boolean;
    cardWidth?: number;
    tempMarker?: POIItem | null; // 임시 마커 (POI 호버용)
    showFavoritePins?: boolean; // 즐겨찾기 핀 표시 여부
};

const MapContainer: React.FC<MapContainerProps> = ({
    onMapClick,
    onAptSelected,
    onMapReady,
    selectedApt,
    isCardExpanded = false,
    cardWidth = 320,
    tempMarker,
    showFavoritePins = true
}) => {
    const { user } = useAuth();
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<kakao.maps.Map | null>(null);
    const markerRef = useRef<kakao.maps.Marker | null>(null);
    const tempMarkerRef = useRef<kakao.maps.Marker | null>(null);
    const favoriteMarkersRef = useRef<kakao.maps.Marker[]>([]);



    // ✅ 건물군(아파트 단지 경계) 오버레이 훅
    const { showForCenter: showEqb, clear: clearEqb } = useEqbOverlay(mapInstance.current);

    const stableOnMapClick = useCallback((lat: number, lng: number) => {
        onMapClick?.(lat, lng);
    }, [onMapClick]);

    const stableOnAptSelected = useCallback((apt: AptInfo) => {
        onAptSelected?.(apt);
    }, [onAptSelected]);

    // 즐겨찾기 마커들 로드
    const loadFavoriteMarkers = useCallback(async () => {
        if (!mapInstance.current || !user) return;

        const map = mapInstance.current;

        // 기존 즐겨찾기 마커들 제거
        favoriteMarkersRef.current.forEach(marker => marker.setMap(null));
        favoriteMarkersRef.current = [];

        try {
            // Firestore에서 사용자 즐겨찾기 가져오기
            const favoritesRef = collection(db, 'users', user.uid, 'favorites');
            const snapshot = await getDocs(favoritesRef);
            
            const favorites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            for (const favorite of favorites) {
                try {
                    if (favorite.aptName && favorite.lat && favorite.lon) {
                        const apt = {
                            id: favorite.aptId,
                            apt_nm: favorite.aptName,
                            jibun_address: favorite.aptAddress || '',
                            lat: favorite.lat,
                            lon: favorite.lon
                        };
                        
                        if (apt.lat && apt.lon) {
                            // 즐겨찾기 마커 생성 (하트 아이콘)
                            const latlng = new window.kakao.maps.LatLng(apt.lat, apt.lon);
                            const imageSize = new window.kakao.maps.Size(32, 32);
                            const imageOption = { offset: new window.kakao.maps.Point(16, 32) };
                            
                            // 별표 아이콘 생성 (SVG를 data URL로 변환)
                            const starIcon = `data:image/svg+xml;base64,${btoa(`
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="12" fill="#FCD34D"/>
                                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" fill="white"/>
                                </svg>
                            `)}`;
                            
                            const markerImage = new window.kakao.maps.MarkerImage(starIcon, imageSize, imageOption);
                            
                            const marker = new window.kakao.maps.Marker({
                                position: latlng,
                                image: markerImage,
                                title: `💕 ${apt.apt_nm} (즐겨찾기)`
                            });

                            // 마커 클릭 이벤트
                            window.kakao.maps.event.addListener(marker, 'click', () => {
                                stableOnAptSelected(apt);
                                showEqb(apt.lat, apt.lon);
                            });

                            marker.setMap(showFavoritePins ? map : null);
                            favoriteMarkersRef.current.push(marker);
                        }
                    }
                } catch (error) {
                    console.error(`아파트 ${favorite.aptId} 마커 생성 실패:`, error);
                }
            }
        } catch (error) {
            console.error('즐겨찾기 마커 로드 실패:', error);
        }
    }, [user, stableOnAptSelected, showEqb]);

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

            // 지도 인스턴스와 새로고침 함수를 부모에게 전달
            onMapReady?.(map, loadFavoriteMarkers);

            // 즐겨찾기 마커 로드
            setTimeout(() => loadFavoriteMarkers(), 1000);

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
    }, [stableOnMapClick, stableOnAptSelected, loadFavoriteMarkers]);

    // 사용자 변경 시 즐겨찾기 마커 다시 로드
    useEffect(() => {
        if (mapInstance.current && user) {
            loadFavoriteMarkers();
        }
    }, [user, loadFavoriteMarkers]);

    // 즐겨찾기 핀 표시/숨김 토글
    useEffect(() => {
        favoriteMarkersRef.current.forEach(marker => {
            marker.setMap(showFavoritePins ? mapInstance.current : null);
        });
    }, [showFavoritePins]);

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
