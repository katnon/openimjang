import { useEffect, useRef, useCallback, useState } from "react";
import { useEqbOverlay } from "@/hooks/useEqbOverlay";
import { useNaverStreetView } from "@/hooks/useNaverStreetView";
import type { POIItem } from "@/types/poi";
import type { CameraFrustum } from "@/hooks/useCameraFrustum";
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
    isMiniMap?: boolean; // 미니맵 모드 여부
    cameraFrustum?: CameraFrustum | null; // 3D 카메라 시야 범위 (미니맵용)
    mapViewMode?: '2D' | '3D'; // 현재 메인 맵 뷰 모드
};

const MapContainer: React.FC<MapContainerProps> = ({
    onMapClick,
    onAptSelected,
    onMapReady,
    selectedApt,
    isCardExpanded = false,
    cardWidth = 320,
    tempMarker,
    showFavoritePins = true,
    isMiniMap = false,
    cameraFrustum = null,
    mapViewMode = '2D'
}) => {
    const { user } = useAuth();
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<kakao.maps.Map | null>(null);
    const markerRef = useRef<kakao.maps.Marker | null>(null);
    const tempMarkerRef = useRef<kakao.maps.Marker | null>(null);
    const favoriteMarkersRef = useRef<kakao.maps.Marker[]>([]);

    // 시야 범위 오버레이 관리
    const frustumOverlayRef = useRef<kakao.maps.Polygon | null>(null);
    const sectorLinesRef = useRef<kakao.maps.Polyline[]>([]);

    // 로드뷰 상태 관리
    const [isStreetViewActive, setIsStreetViewActive] = useState(false);
    const [streetViewWidth] = useState(400); // 고정 너비



    // ✅ 건물군(아파트 단지 경계) 오버레이 훅
    const { showForCenter: showEqb, clear: clearEqb } = useEqbOverlay(mapInstance.current);

    // 🗺️ 네이버 로드뷰 동기화 훅
    const streetViewHook = useNaverStreetView(mapInstance.current, {
        isActive: isStreetViewActive,
        containerId: 'street-view-container',
        initialPosition: selectedApt ? {
            lat: selectedApt.lat,
            lng: selectedApt.lon,
            alt: 10
        } : undefined,
        syncWithWalkingMode: true, // 걷기 모드와 동기화
        syncWithFirstPersonMode: true // 1인칭 모드와 동기화
    });

    const stableOnMapClick = useCallback((lat: number, lng: number) => {
        onMapClick?.(lat, lng);
    }, [onMapClick]);

    const stableOnAptSelected = useCallback((apt: AptInfo) => {
        onAptSelected?.(apt);
    }, [onAptSelected]);

    // 부채꼴 좌표 생성 함수 (카메라 중심에서 60도 부채꼴)
    const createSectorPath = useCallback((sector: NonNullable<CameraFrustum['fallbackSector']>): kakao.maps.LatLng[] => {
        const { center, heading, radius, angleSpread } = sector;
        const path: kakao.maps.LatLng[] = [];

        // 부채꼴 중심점 추가
        path.push(new window.kakao.maps.LatLng(center.lat, center.lng));

        // 부채꼴 호 점들 생성 (30개 점으로 부드러운 곡선)
        const pointCount = 30;
        const startAngle = heading - angleSpread / 2;
        const endAngle = heading + angleSpread / 2;

        for (let i = 0; i <= pointCount; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / pointCount);
            const radians = (angle * Math.PI) / 180;

            // 거리(반지름)를 위도/경도로 변환 (대략적 계산)
            const deltaLat = (radius * Math.cos(radians)) / 111000; // 1도 ≈ 111km
            const deltaLng = (radius * Math.sin(radians)) / (111000 * Math.cos(center.lat * Math.PI / 180));

            path.push(new window.kakao.maps.LatLng(
                center.lat + deltaLat,
                center.lng + deltaLng
            ));
        }

        return path;
    }, []);

    // 60도 각도 두 실선 생성 (바깥쪽으로 갈수록 그라데이션으로 사라짐)
    const createSectorLines = useCallback((sector: NonNullable<CameraFrustum['fallbackSector']>, map: kakao.maps.Map) => {
        // 기존 선 오버레이 제거
        sectorLinesRef.current.forEach(line => line.setMap(null));
        sectorLinesRef.current = [];

        const { center, heading, radius, angleSpread } = sector;

        // 두 방향 각도 계산 (60도 각도)
        const leftAngle = heading - angleSpread / 2;
        const rightAngle = heading + angleSpread / 2;

        // 각 선에 대해 그라데이션 효과를 위한 여러 세그먼트 생성
        const segments = 25; // 부드러운 그라데이션을 위한 세그먼트 수

        [leftAngle, rightAngle].forEach((angle) => {
            const radians = (angle * Math.PI) / 180;

            // 중심점에서 시작하는 하나의 긴 선을 여러 세그먼트로 분할
            for (let i = 0; i < segments; i++) {
                const startDistance = (radius / segments) * i;
                const endDistance = (radius / segments) * (i + 1);

                // 시작점과 끝점 계산 (중심에서 바깥쪽으로)
                const startDeltaLat = (startDistance * Math.cos(radians)) / 111000;
                const startDeltaLng = (startDistance * Math.sin(radians)) / (111000 * Math.cos(center.lat * Math.PI / 180));

                const endDeltaLat = (endDistance * Math.cos(radians)) / 111000;
                const endDeltaLng = (endDistance * Math.sin(radians)) / (111000 * Math.cos(center.lat * Math.PI / 180));

                const startPoint = new window.kakao.maps.LatLng(
                    center.lat + startDeltaLat,
                    center.lng + startDeltaLng
                );

                const endPoint = new window.kakao.maps.LatLng(
                    center.lat + endDeltaLat,
                    center.lng + endDeltaLng
                );

                // 거리에 따른 투명도 계산 (중심에서 바깥쪽으로 갈수록 자연스럽게 사라짐)
                const fadeProgress = i / (segments - 1); // 0 ~ 1
                const opacity = Math.max(0.05, 0.9 * Math.pow(1 - fadeProgress, 1.5)); // 지수함수적 페이드

                // 선 굵기도 바깥쪽으로 갈수록 얇아지게
                const strokeWeight = Math.max(1, 3 * (1 - fadeProgress * 0.7));

                const line = new window.kakao.maps.Polyline({
                    path: [startPoint, endPoint],
                    strokeWeight: strokeWeight,
                    strokeColor: '#00BFFF',
                    strokeOpacity: opacity,
                    strokeStyle: 'solid'
                });

                line.setMap(map);
                sectorLinesRef.current.push(line);
            }
        });

        console.log('✨ 60도 각도 그라데이션 직선 생성 완료:', sectorLinesRef.current.length + '개 세그먼트');
    }, []);

    // 시야 범위 오버레이 업데이트 (3D 메인맵 + 2D 미니맵일 때만)
    const updateFrustumOverlay = useCallback(() => {
        const shouldShowFrustum = mapViewMode === '3D' && isMiniMap && cameraFrustum &&
            (cameraFrustum.isValid || cameraFrustum.fallbackSector);

        if (!mapInstance.current || !shouldShowFrustum) {
            // 기존 오버레이 제거
            if (frustumOverlayRef.current) {
                frustumOverlayRef.current.setMap(null);
                frustumOverlayRef.current = null;
            }
            // 선 오버레이도 제거
            sectorLinesRef.current.forEach(line => line.setMap(null));
            sectorLinesRef.current = [];
            return;
        }

        try {
            const map = mapInstance.current;

            // 기존 오버레이 제거
            if (frustumOverlayRef.current) {
                frustumOverlayRef.current.setMap(null);
            }
            // 선 오버레이도 제거
            sectorLinesRef.current.forEach(line => line.setMap(null));
            sectorLinesRef.current = [];

            let path: kakao.maps.LatLng[];
            let isRegularFrustum = false;

            if (cameraFrustum.isValid) {
                // 정상적인 시야 범위 폴리곤
                path = [
                    new window.kakao.maps.LatLng(cameraFrustum.topLeft.lat, cameraFrustum.topLeft.lng),
                    new window.kakao.maps.LatLng(cameraFrustum.topRight.lat, cameraFrustum.topRight.lng),
                    new window.kakao.maps.LatLng(cameraFrustum.bottomRight.lat, cameraFrustum.bottomRight.lng),
                    new window.kakao.maps.LatLng(cameraFrustum.bottomLeft.lat, cameraFrustum.bottomLeft.lng)
                ];
                isRegularFrustum = true;
                console.log('✅ 정상 시야 범위 폴리곤 렌더링');
            } else if (cameraFrustum.fallbackSector) {
                // 60도 각도 두 실선 렌더링 (그라데이션 효과)
                createSectorLines(cameraFrustum.fallbackSector, map);

                console.log('🎯 60도 각도 시야 선 렌더링:', {
                    center: `${cameraFrustum.fallbackSector.center.lat.toFixed(6)}, ${cameraFrustum.fallbackSector.center.lng.toFixed(6)}`,
                    heading: cameraFrustum.fallbackSector.heading.toFixed(1),
                    radius: cameraFrustum.fallbackSector.radius.toFixed(0) + 'm'
                });

                // 선만 렌더링하므로 폴리곤은 생성하지 않음
                return;
            } else {
                return; // 둘 다 없으면 렌더링하지 않음
            }

            // 폴리곤 스타일 (정상 frustum만)
            frustumOverlayRef.current = new window.kakao.maps.Polygon({
                path: path,
                strokeWeight: 2,
                strokeColor: '#00BFFF',
                strokeOpacity: 0.8,
                strokeStyle: 'solid',
                fillColor: '#00BFFF',
                fillOpacity: 0.15
            });

            frustumOverlayRef.current.setMap(map);

            console.log('✅ 시야 범위 오버레이 업데이트 완료');

        } catch (error) {
            console.error('❌ 시야 범위 오버레이 업데이트 실패:', error);
        }
    }, [cameraFrustum, mapViewMode, isMiniMap, createSectorPath, createSectorLines]);

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
    }, [isCardExpanded]); // 카드 확장/축소 시에만 실행

    // ✅ 임시 마커 업데이트 (POI 호버)
    useEffect(() => {
        if (!mapInstance.current) return;

        const map = mapInstance.current;

        // 기존 임시 마커 제거
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setMap(null);
            tempMarkerRef.current = null;
        }

        // 새 임시 마커 생성 (POI 호버용만 - @아파트명 클릭과는 무관)
        if (tempMarker) {
            const lat = parseFloat(tempMarker.y);
            const lng = parseFloat(tempMarker.x);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const latlng = new window.kakao.maps.LatLng(lat, lng);
                
                // 커스텀 마커 이미지로 기본 핀 대신 사용
                const imageSize = new window.kakao.maps.Size(24, 35);
                const imageOption = { offset: new window.kakao.maps.Point(12, 35) };
                const markerImage = new window.kakao.maps.MarkerImage("/icon-192.png", imageSize, imageOption);
                
                const marker = new window.kakao.maps.Marker({
                    position: latlng,
                    image: markerImage,
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

    // 시야 범위 오버레이 업데이트 (cameraFrustum 변경 시)
    useEffect(() => {
        updateFrustumOverlay();
    }, [updateFrustumOverlay]);

    return (
        <div className="w-full h-full relative">
            {/* 🗺️ 지도 컨테이너 - 로드뷰 활성화 시 너비 조정 */}
            <div
                ref={mapRef}
                className="kakao-map transition-all duration-300 ease-in-out"
                style={{
                    width: isStreetViewActive ? `calc(100% - ${streetViewWidth}px)` : '100%',
                    height: '100%'
                }}
            />


            {/* 🗺️ 네이버 로드뷰 패널 */}
            {isStreetViewActive && (
                <div
                    className="absolute top-0 right-0 h-full bg-white shadow-lg z-20 border-l border-gray-200"
                    style={{ width: streetViewWidth }}
                >
                    {/* 로드뷰 헤더 */}
                    <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">네이버 로드뷰</span>
                            {streetViewHook.isInitialized && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                    연결됨
                                </span>
                            )}
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded" title="걷기/1인칭 모드와 실시간 동기화">
                                🔄 동기화
                            </span>
                        </div>
                        <button
                            onClick={() => setIsStreetViewActive(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="로드뷰 닫기"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* 로드뷰 컨테이너 */}
                    <div
                        id="street-view-container"
                        className="w-full bg-gray-100"
                        style={{ height: 'calc(100% - 3rem)' }}
                    >
                        {!streetViewHook.isInitialized && (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="text-sm">로드뷰 초기화 중...</p>
                                    <p className="text-xs text-gray-400 mt-1">지도를 클릭하면 해당 위치의 로드뷰가 표시됩니다</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 로드뷰 정보 표시 */}
                    {streetViewHook.isInitialized && streetViewHook.currentPosition && (
                        <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded">
                            <div>위치: {streetViewHook.currentPosition.lat.toFixed(6)}, {streetViewHook.currentPosition.lng.toFixed(6)}</div>
                            <div className="mt-1 text-blue-300">🔄 3D 지도와 실시간 연동 중</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapContainer;
