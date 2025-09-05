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
import ChatbotModal from "@/components/chatbot/ChatbotModal";
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
    const [selectedApt, setSelectedApt] = useState<AptInfo | null>(null);
    const [isCardExpanded, setIsCardExpanded] = useState(false);
    const [hoveredPOI, setHoveredPOI] = useState<POIItem | null>(null);
    const [isDistrictOverlayActive, setIsDistrictOverlayActive] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showChatbot, setShowChatbot] = useState(false);
    const [chatbotContext, setChatbotContext] = useState<any>(null);
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

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-100">
            {/* 상단바 */}
            <TopBar
                onOpen3D={() => setShow3D(true)}
                onSearchResult={(results) => {
                    if (results.length > 0) {
                        setSelectedApt(results[0]);
                        setPoint({ lat: results[0].lat, lng: results[0].lon });
                    }
                }}
                onOpenAuth={() => setShowAuth(true)}
                onOpenMyImjang={() => setShowMyImjang(true)}
                onOpenProfile={() => setShowProfile(true)}
                onOpenChatbot={() => {
                    setChatbotContext({ type: 'general' });
                    setShowChatbot(true);
                }}
            />

            {/* 지도 */}
            <main className="absolute inset-0 top-16">
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
            </main>

            {/* 지도 조작 UI */}
            <MapControls
                map={mapInstanceRef.current}
                isDistrictOverlayActive={isDistrictOverlayActive}
                onToggleDistrictOverlay={handleDistrictOverlayToggle}
                onMapTypeChange={handleMapTypeChange}
                currentMapType={currentMapType}
                showFavoritePins={showFavoritePins}
                onToggleFavoritePins={() => setShowFavoritePins(!showFavoritePins)}
            />

            {/* 요약 카드 */}
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
                onOpenChatbot={(contextData) => {
                    setChatbotContext(contextData);
                    setShowChatbot(true);
                }}
            />

            {/* 3D 팝업 */}
            <MapPrime3DViewer
                visible={show3D}
                onClose={() => setShow3D(false)}
                selectedLocation={
                    selectedApt
                        ? { lat: selectedApt.lat, lon: selectedApt.lon }
                        : point
                            ? { lat: point.lat, lon: point.lng }
                            : null
                }
                selectedApt={selectedApt}
            />

            {/* 임장 하기 버튼 (로그인 + 아파트 선택 시에만 표시) */}
            {user && selectedApt && (
                <button
                    onClick={() => setShowMemoModal(true)}
                    className="fixed bottom-6 right-6 bg-[#14e3dc] hover:bg-[#12d4cc] text-white px-4 py-3 rounded-lg shadow-lg transition-colors z-40 flex items-center gap-2"
                    title="임장 메모 작성"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">임장 하기</span>
                </button>
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
                onOpenChatbot={(contextData) => {
                    setChatbotContext(contextData);
                    setShowChatbot(true);
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

            {/* 챗봇 모달 */}
            <ChatbotModal
                isOpen={showChatbot}
                onClose={() => {
                    setShowChatbot(false);
                    setChatbotContext(null);
                }}
                contextData={chatbotContext}
            />
        </div>
    );
}
