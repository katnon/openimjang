// apps/web/src/pages/Home.tsx
import { useState, useRef, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import MapContainer from "@/components/map/MapContainer";
import MapControls from "@/components/map/MapControls";
import SummaryCard from "@/components/card/SummaryCard";
import MapPrime3DViewer from "@/components/MapPrime3DViewer";
import AuthPage from "@/components/auth/AuthPage";
import MemoCreateModal from "@/components/memo/MemoCreateModal";
import FavoriteConfirmPopup from "@/components/memo/FavoriteConfirmPopup";
import MyImjangModal from "@/components/memo/MyImjangModal";
import { useAuth } from "@/auth/AuthProvider";
import { doc, setDoc, deleteDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import UserOnboardingModal from "@/components/onboarding/UserOnboardingModal";
import UserProfileModal from "@/components/profile/UserProfileModal";
import ChatbotSidebar from "@/components/chatbot/ChatbotSidebar";
import type { POIItem } from "@/types/poi";

type AptInfo = {
    id: number;
    apt_nm: string;
    jibun_address: string;
    lat: number;
    lon: number;
};

export default function Home() {
    const { user, needsOnboarding, markOnboardingComplete } = useAuth();
    const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [show3D, setShow3D] = useState(false);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const [mapViewMode, setMapViewMode] = useState<'2D' | '3D'>('2D');
    const [selectedApt, setSelectedApt] = useState<AptInfo | null>(null);
    const [isCardExpanded, setIsCardExpanded] = useState(false);
    const [hoveredPOI, setHoveredPOI] = useState<POIItem | null>(null);
    const [isDistrictOverlayActive, setIsDistrictOverlayActive] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [currentMapType, setCurrentMapType] = useState<'ROADMAP' | 'SATELLITE'>('ROADMAP');
    const [favorites, setFavorites] = useState<Set<number>>(new Set());
    const [showFavoritePopup, setShowFavoritePopup] = useState(false);
    const [favoriteAptName, setFavoriteAptName] = useState('');
    const [showMyImjang, setShowMyImjang] = useState(false);
    const [editingMemo, setEditingMemo] = useState<{
        id: string;
        title: string;
        body: string;
        photoUrl?: string;
    } | null>(null);
    const [showFavoritePins, setShowFavoritePins] = useState(true);
    const [sidebarApartmentAttachment, setSidebarApartmentAttachment] = useState<{
        id: number;
        name: string;
        address: string;
        lat: number;
        lon: number;
    } | null>(null);
    const [chatbotInitialMessage, setChatbotInitialMessage] = useState<string>('');
    const [newApartmentAttachment, setNewApartmentAttachment] = useState<{
        id: number;
        name: string;
        address: string;
        lat: number;
        lon: number;
    } | null>(null);

    // ✅ 지도 인스턴스 ref 추가
    const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
    const refreshFavoritesRef = useRef<(() => void) | null>(null);

    // 즐겨찾기 로드
    const loadFavorites = async () => {
        if (!user) return;

        try {
            const favoritesRef = collection(db, 'users', user.uid, 'favorites');
            const snapshot = await getDocs(favoritesRef);
            
            const favoriteIds = new Set(
                snapshot.docs.map(doc => parseInt(doc.id))
            );
            
            setFavorites(favoriteIds);
        } catch (error) {
            console.error('즐겨찾기 로드 실패:', error);
        }
    };

    // 사용자 로그인 시 즐겨찾기 로드
    useEffect(() => {
        if (user) {
            loadFavorites();
        } else {
            setFavorites(new Set());
        }
    }, [user]);

    // 지적편집도 토글 핸들러
    const handleDistrictOverlayToggle = () => {
        setIsDistrictOverlayActive(prev => !prev);
    };

    // 지도 타입 변경 핸들러
    const handleMapTypeChange = (mapType: 'ROADMAP' | 'SATELLITE') => {
        if (!mapInstanceRef.current || !window.kakao?.maps?.MapTypeId) return;

        const map = mapInstanceRef.current;
        const kakaoMapType = mapType === 'SATELLITE' 
            ? window.kakao.maps.MapTypeId.SKYVIEW  // SATELLITE 대신 SKYVIEW 사용
            : window.kakao.maps.MapTypeId.ROADMAP;

        try {
            map.setMapTypeId(kakaoMapType);
            setCurrentMapType(mapType);
            console.log(`🗺️ 지도 타입 변경: ${mapType}`);
        } catch (error) {
            console.error('❌ 지도 타입 변경 오류:', error);
        }
    };

    // 즐겨찾기 토글 핸들러
    const handleFavoriteToggle = async (apt: AptInfo) => {
        if (!user) return;

        try {
            const favoriteRef = doc(db, 'users', user.uid, 'favorites', apt.id.toString());
            const isFavorited = favorites.has(apt.id);

            if (isFavorited) {
                // 즐겨찾기 제거
                await deleteDoc(favoriteRef);
                setFavorites(prev => {
                    const newFavorites = new Set(prev);
                    newFavorites.delete(apt.id);
                    return newFavorites;
                });
                // 지도 마커 새로고침
                refreshFavoritesRef.current?.();
            } else {
                // 즐겨찾기 추가
                await setDoc(favoriteRef, {
                    aptId: apt.id,
                    aptName: apt.apt_nm,
                    aptAddress: apt.jibun_address,
                    lat: apt.lat,
                    lon: apt.lon,
                    createdAt: new Date()
                });
                setFavorites(prev => new Set([...prev, apt.id]));
                setFavoriteAptName(apt.apt_nm);
                setShowFavoritePopup(true);
                // 지도 마커 새로고침
                refreshFavoritesRef.current?.();
            }
        } catch (error) {
            console.error('❌ 즐겨찾기 토글 오류:', error);
        }
    };

    // 지도 네비게이션 핸들러 (스마트 링크용)
    const handleMapNavigate = async (data: { lat: number; lon: number; name: string; type: string }) => {
        console.log('🗺️ 지도 네비게이션:', data);
        
        if (!mapInstanceRef.current) {
            console.warn('⚠️ 지도 인스턴스가 없습니다.');
            return;
        }

        const map = mapInstanceRef.current;
        
        // 지도 중심을 해당 위치로 이동
        const newCenter = new kakao.maps.LatLng(data.lat, data.lon);
        map.setCenter(newCenter);
        map.setLevel(3); // 확대
        
        // 아파트인 경우 검색 API로 정확한 정보 가져와서 요약카드 표시
        if (data.type === 'apartment') {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(data.name)}`);
                const searchResults = await response.json();
                
                if (searchResults && searchResults.length > 0) {
                    const apt = searchResults[0];
                    setSelectedApt(apt);
                    setPoint({ lat: apt.lat, lng: apt.lon });
                    console.log('✅ 아파트 요약카드 표시:', apt.apt_nm);
                    return; // 아파트인 경우 여기서 종료
                }
            } catch (error) {
                console.error('❌ 아파트 정보 조회 오류:', error);
            }
        }
        
        // 아파트가 아니거나 아파트 조회 실패한 경우 임시 마커 표시
        const markerPosition = new kakao.maps.LatLng(data.lat, data.lon);
        const marker = new kakao.maps.Marker({
            position: markerPosition,
            title: data.name
        });
        marker.setMap(map);

        // 아이콘에 따른 정보창 스타일링
        const getIconForType = (type: string) => {
            const icons: Record<string, string> = {
                apartment: '🏢',
                subway: '🚇',
                bus_stop: '🚌',
                school: '🏫',
                hospital: '🏥',
                mart: '🛒',
                park: '🌳',
                government: '🏛️',
                bank: '🏦',
                restaurant: '🍴'
            };
            return icons[type] || '📍';
        };

        // 정보창 표시
        const icon = getIconForType(data.type);
        const infoWindow = new kakao.maps.InfoWindow({
            content: `
                <div style="
                    padding: 8px 12px; 
                    font-size: 14px; 
                    font-weight: 500;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    border: none;
                    min-width: 120px;
                    text-align: center;
                ">
                    <div style="color: #1e40af; margin-bottom: 2px;">${icon}</div>
                    <div style="color: #374151;">${data.name}</div>
                </div>
            `
        });
        infoWindow.open(map, marker);

        // 5초 후 정보창과 마커 제거
        setTimeout(() => {
            infoWindow.close();
            marker.setMap(null);
        }, 5000);
        
        // point 상태도 업데이트
        setPoint({ lat: data.lat, lng: data.lon });
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-100">
            {/* 상단바 - 3D 모드에서도 표시되도록 z-index 증가 */}
            <div className={mapViewMode === '3D' ? 'relative z-[300]' : 'relative'}>
                <TopBar
                    onOpen3D={() => setShow3D(true)}
                    onOpen2D={() => setShowMiniMap(prev => !prev)}
                    mapViewMode={mapViewMode}
                    onSearchResult={(results) => {
                        if (results.length > 0) {
                            setSelectedApt(results[0]);
                            setPoint({ lat: results[0].lat, lng: results[0].lon });
                        }
                    }}
                    onOpenAuth={() => setShowAuth(true)}
                    onOpenMyImjang={() => setShowMyImjang(true)}
                    onOpenProfile={() => setShowProfile(true)}
                />
            </div>

            {/* 지도 */}
            <main className="absolute inset-0 top-16">
                {mapViewMode === '2D' && (
                    <MapContainer
                        onMapClick={(lat, lon) => setPoint({ lat, lng: lon })}
                        onAptSelected={(apt) => {
                            setSelectedApt(apt);
                            setPoint({ lat: apt.lat, lng: apt.lon });
                        }}
                        onMapReady={(map, refreshFavorites) => {
                            mapInstanceRef.current = map;
                            refreshFavoritesRef.current = refreshFavorites;
                        }}
                        selectedApt={
                            selectedApt ? { lat: selectedApt.lat, lon: selectedApt.lon } : null
                        }
                        isCardExpanded={isCardExpanded}
                        cardWidth={isCardExpanded ? 464 : 320}
                        tempMarker={hoveredPOI}
                        showFavoritePins={showFavoritePins}
                    />
                )}
                {/* 통합된 3D 뷰어 - 팝업 모드일 때와 메인 모드일 때 모두 처리 */}
                <MapPrime3DViewer
                    isVisible={show3D || mapViewMode === '3D'}
                    onClose={() => {
                        if (mapViewMode === '3D') {
                            setMapViewMode('2D');
                        } else {
                            setShow3D(false);
                        }
                    }}
                    selectedLocation={
                        selectedApt
                            ? { lat: selectedApt.lat, lon: selectedApt.lon }
                            : point
                                ? { lat: point.lat, lon: point.lng }
                                : null
                    }
                    selectedApt={selectedApt}
                    mapViewMode={mapViewMode === '3D' ? '3D' : '2D'}
                    onToggleMapView={() => {
                        if (show3D) {
                            // 팝업에서 전환: 팝업 닫고 메인을 3D로
                            setShow3D(false);
                            setMapViewMode('3D');
                            setShowMiniMap(true);
                        } else {
                            // 메인에서 전환: 메인을 2D로 하고 팝업 열기
                            setMapViewMode('2D');
                            setShow3D(true);
                            setShowMiniMap(false);
                        }
                    }}
                />
            </main>

            {/* 지도 조작 UI - 2D 모드에서만 표시 */}
            {mapViewMode === '2D' && (
                <MapControls
                    map={mapInstanceRef.current}
                    isDistrictOverlayActive={isDistrictOverlayActive}
                    onToggleDistrictOverlay={handleDistrictOverlayToggle}
                    onMapTypeChange={handleMapTypeChange}
                    currentMapType={currentMapType}
                    showFavoritePins={showFavoritePins}
                    onToggleFavoritePins={() => setShowFavoritePins(!showFavoritePins)}
                />
            )}

            {/* 요약 카드 - 최상위에서 직접 위치 */}
            <SummaryCard
            selectedApt={selectedApt}
            point={point}
            onMore={() => {
                if (selectedApt) {
                    console.log("🔍 자세히보기 클릭:", selectedApt);
                    alert(`${selectedApt.apt_nm}의 상세 정보를 표시할 예정입니다.`);
                }
            }}
            onExpandChange={setIsCardExpanded}
            onPOIHover={setHoveredPOI}
            onFavoriteToggle={handleFavoriteToggle}
            isFavorited={selectedApt ? favorites.has(selectedApt.id) : false}
            onOpenChatbot={() => {
                if (selectedApt) {
                    // 새로운 첨부 방식: ChatbotSidebar에 아파트 정보 직접 전달
                    setNewApartmentAttachment({
                        id: selectedApt.id,
                        name: selectedApt.apt_nm,
                        address: selectedApt.jibun_address,
                        lat: selectedApt.lat,
                        lon: selectedApt.lon
                    });
                    
                    console.log('🤖 임장봇 버튼 - 새로운 첨부블록 생성:', {
                        id: selectedApt.id,
                        name: selectedApt.apt_nm,
                        address: selectedApt.jibun_address,
                        lat: selectedApt.lat,
                        lon: selectedApt.lon
                    });
                    
                    // 첨부 완료 후 상태 초기화를 위한 타이머
                    setTimeout(() => {
                        setNewApartmentAttachment(null);
                    }, 100);
                }
            }}
            onWriteMemo={() => setShowMemoModal(true)}
            onOpenMyImjang={() => setShowMyImjang(true)}
            />


            {/* 3D 메인 모드일 때 우상단에 2D 미니맵 표시 (3D 팝업과 완전히 동일한 UI) */}
            {mapViewMode === '3D' && showMiniMap && (
                <div className="fixed top-20 right-12 z-[200] bg-white border shadow-lg rounded-lg w-80 h-60">
                    {/* 3D 팝업과 동일한 버튼 구조 */}
                    <div className="absolute top-2 right-2 flex gap-2 z-10">
                        {/* 아파트 단지명 표시 (3D 팝업과 동일) */}
                        {selectedApt && (
                            <div className="bg-blue-500/90 text-white rounded shadow-sm px-2 py-1 text-xs max-w-48">
                                🏠 <span className="font-medium">{selectedApt.apt_nm}</span>
                            </div>
                        )}

                        {/* X 닫기 버튼 (3D 팝업과 동일한 스타일) */}
                        <button
                            onClick={() => setShowMiniMap(false)}
                            className="bg-gray-500/90 hover:bg-gray-600 text-white rounded shadow-sm transition-all w-6 h-6 flex items-center justify-center text-xs"
                            title="닫기"
                        >
                            ✕
                        </button>

                        {/* 전환 버튼 (3D 팝업과 동일한 스타일) */}
                        <button
                            onClick={() => {
                                setMapViewMode('2D');
                                setShowMiniMap(false);
                                setShow3D(true);
                            }}
                            className="bg-white/90 hover:bg-white border border-gray-300 text-gray-700 rounded shadow-sm transition-all px-3 py-1 text-xs"
                            title="2D 모드로 전환"
                        >
                            전환
                        </button>
                    </div>

                    {/* 2D 지도 컨테이너 */}
                    <MapContainer
                        onMapClick={(lat, lon) => setPoint({ lat, lng: lon })} // 미니맵에서도 클릭 가능
                        onAptSelected={(apt) => {
                            setSelectedApt(apt);
                            setPoint({ lat: apt.lat, lng: apt.lon });
                        }}
                        selectedApt={
                            selectedApt ? { lat: selectedApt.lat, lon: selectedApt.lon } : null
                        }
                        isCardExpanded={false}
                        cardWidth={0}
                        tempMarker={hoveredPOI}
                        showFavoritePins={showFavoritePins}
                        isMiniMap={true}
                    />
                </div>
            )}


            {/* 메모 작성/수정 모달 */}
            <MemoCreateModal
                isOpen={showMemoModal}
                onClose={() => {
                    setShowMemoModal(false);
                    setEditingMemo(null);
                }}
                selectedApt={selectedApt ? {
                    id: selectedApt.id.toString(),
                    apt_nm: selectedApt.apt_nm,
                    jibun_address: selectedApt.jibun_address,
                    lat: selectedApt.lat,
                    lon: selectedApt.lon
                } : null}
                editMemo={editingMemo}
                onMemoUpdated={() => {
                    // 메모 수정 후 즐겨찾기 마커 새로고침
                    refreshFavoritesRef.current?.();
                    setEditingMemo(null);
                }}
            />

            {/* 즐겨찾기 확인 팝업 */}
            <FavoriteConfirmPopup
                isOpen={showFavoritePopup}
                onClose={() => setShowFavoritePopup(false)}
                onWriteMemo={() => setShowMemoModal(true)}
                aptName={favoriteAptName}
            />

            {/* 내 임장 모달 */}
            <MyImjangModal
                isOpen={showMyImjang}
                onClose={() => setShowMyImjang(false)}
                onEditMemo={(memo) => {
                    setEditingMemo({
                        id: memo.id,
                        title: memo.title,
                        body: memo.body,
                        photoUrl: memo.photoUrl
                    });
                    setShowMemoModal(true);
                }}
                onMemoDeleted={() => {
                    // 메모 삭제 후 즐겨찾기 마커 새로고침
                    refreshFavoritesRef.current?.();
                }}
                onOpenChatbot={() => {
                    // 사이드바 챗봇만 사용
                    setChatbotInitialMessage('');
                }}
            />

            {/* 인증 모달 */}
            <AuthPage
                isOpen={showAuth}
                onClose={() => setShowAuth(false)}
            />

            {/* 온보딩 모달 */}
            <UserOnboardingModal
                isOpen={user !== null && needsOnboarding}
                onComplete={markOnboardingComplete}
                onSkip={markOnboardingComplete}
            />

            {/* 프로필 수정 모달 */}
            <UserProfileModal
                isOpen={showProfile}
                onClose={() => setShowProfile(false)}
            />


            {/* 새로운 임장봇 사이드바 - 3D 모드에서도 표시되도록 z-index 증가 */}
            <div className={mapViewMode === '3D' ? 'relative z-[300]' : 'relative'}>
                <ChatbotSidebar 
                    contextData={undefined}
                    onMapNavigate={handleMapNavigate}
                    onAptSelected={(apt) => {
                        setSelectedApt({
                            id: apt.id,
                            apt_nm: apt.apt_nm,
                            jibun_address: apt.address,
                            lat: apt.lat,
                            lon: apt.lon
                        });
                        setPoint({ lat: apt.lat, lng: apt.lon });
                    }}
                    attachedApartment={sidebarApartmentAttachment}
                    onApartmentDetach={() => setSidebarApartmentAttachment(null)}
                    initialMessage={chatbotInitialMessage}
                    onInitialMessageUsed={() => setChatbotInitialMessage('')} // 사용된 초기 메시지 초기화
                    onAddAttachment={newApartmentAttachment} // 새로운 아파트 첨부 요청 전달
                />
            </div>
        </div>
    );
}
