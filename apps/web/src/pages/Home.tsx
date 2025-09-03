// apps/web/src/pages/Home.tsx
import { useState, useRef } from "react";
import TopBar from "@/components/layout/TopBar";
import MapContainer from "@/components/map/MapContainer";
import MapControls from "@/components/map/MapControls";
import SummaryCard from "@/components/card/SummaryCard";
import MapPrime3DViewer from "@/components/MapPrime3DViewer";
import type { POIItem } from "@/types/poi";

type AptInfo = {
    id: number;
    apt_nm: string;
    jibun_address: string;
    lat: number;
    lon: number;
};

export default function Home() {
    const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [show3D, setShow3D] = useState(false);
    const [selectedApt, setSelectedApt] = useState<AptInfo | null>(null);
    const [isCardExpanded, setIsCardExpanded] = useState(false);
    const [hoveredPOI, setHoveredPOI] = useState<POIItem | null>(null);
    const [isDistrictOverlayActive, setIsDistrictOverlayActive] = useState(false);

    // ✅ 지도 인스턴스 ref 추가
    const mapInstanceRef = useRef<kakao.maps.Map | null>(null);

    // 지적편집도 토글 핸들러
    const handleDistrictOverlayToggle = () => {
        setIsDistrictOverlayActive(prev => !prev);
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
            />

            {/* 지도 */}
            <main className="absolute inset-0 top-16">
                <MapContainer
                    onMapClick={(lat, lon) => setPoint({ lat, lng: lon })}
                    onAptSelected={(apt) => {
                        console.log("🏠 Home에서 아파트 선택됨:", apt);
                        setSelectedApt(apt);
                        setPoint({ lat: apt.lat, lng: apt.lon });
                    }}
                    onMapReady={(map) => {
                        mapInstanceRef.current = map;
                    }}
                    selectedApt={
                        selectedApt ? { lat: selectedApt.lat, lon: selectedApt.lon } : null
                    }
                    isCardExpanded={isCardExpanded}
                    cardWidth={isCardExpanded ? 464 : 320}
                    tempMarker={hoveredPOI}
                />
            </main>

            {/* 지도 조작 UI */}
            <MapControls
                map={mapInstanceRef.current}
                isDistrictOverlayActive={isDistrictOverlayActive}
                onToggleDistrictOverlay={handleDistrictOverlayToggle}
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
        </div>
    );
}
