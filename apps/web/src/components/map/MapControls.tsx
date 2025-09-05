import { useCallback } from 'react';

interface MapControlsProps {
    map: kakao.maps.Map | null;
    isDistrictOverlayActive?: boolean;
    onToggleDistrictOverlay?: () => void;
    onMapTypeChange?: (mapType: 'ROADMAP' | 'SATELLITE') => void;
    currentMapType?: 'ROADMAP' | 'SATELLITE';
    showFavoritePins?: boolean;
    onToggleFavoritePins?: () => void;
}

export default function MapControls({
    map,
    isDistrictOverlayActive = false,
    onToggleDistrictOverlay,
    onMapTypeChange,
    currentMapType = 'ROADMAP',
    showFavoritePins = true,
    onToggleFavoritePins
}: MapControlsProps) {

    // 줌 인
    const handleZoomIn = useCallback(() => {
        if (map) {
            const level = map.getLevel();
            map.setLevel(level - 1);
            console.log(`🔍 줌 인: 레벨 ${level - 1}`);
        }
    }, [map]);

    // 줌 아웃
    const handleZoomOut = useCallback(() => {
        if (map) {
            const level = map.getLevel();
            map.setLevel(level + 1);
            console.log(`🔍 줌 아웃: 레벨 ${level + 1}`);
        }
    }, [map]);

    // 지적편집도 토글
    const handleDistrictOverlayToggle = useCallback(() => {
        if (map && onToggleDistrictOverlay) {
            if (isDistrictOverlayActive) {
                map.removeOverlayMapTypeId(window.kakao.maps.MapTypeId.USE_DISTRICT);
                console.log('🗺️ 지적편집도 비활성화');
            } else {
                map.addOverlayMapTypeId(window.kakao.maps.MapTypeId.USE_DISTRICT);
                console.log('🗺️ 지적편집도 활성화');
            }
            onToggleDistrictOverlay();
        }
    }, [map, isDistrictOverlayActive, onToggleDistrictOverlay]);

    // 위성지도 토글
    const handleMapTypeToggle = useCallback(() => {
        if (onMapTypeChange) {
            const newMapType = currentMapType === 'ROADMAP' ? 'SATELLITE' : 'ROADMAP';
            onMapTypeChange(newMapType);
        }
    }, [currentMapType, onMapTypeChange]);

    const btn = "w-10 h-10 rounded-xl border border-neutral-300 bg-white hover:border-primary-500 shadow transition-all";
    const btnActive = "w-10 h-10 rounded-xl border border-primary-500 bg-primary-500 text-white shadow transition-all";

    return (
        <div className="absolute right-4 top-20 z-20 flex flex-col gap-2">
            <button
                className={btn}
                onClick={handleZoomIn}
                title="확대"
            >
                ＋
            </button>

            <button
                className={btn}
                onClick={handleZoomOut}
                title="축소"
            >
                －
            </button>

            <button
                className={isDistrictOverlayActive ? btnActive : btn}
                onClick={handleDistrictOverlayToggle}
                title="지적편집도"
                disabled={!map}
            >
                🗺️
            </button>

            <button
                className={currentMapType === 'SATELLITE' ? btnActive : btn}
                onClick={handleMapTypeToggle}
                title={currentMapType === 'ROADMAP' ? '위성지도' : '일반지도'}
                disabled={!map}
            >
                {currentMapType === 'ROADMAP' ? '🛰️' : '🌍'}
            </button>

            <button
                className={showFavoritePins ? btnActive : btn}
                onClick={onToggleFavoritePins}
                title={showFavoritePins ? '즐겨찾기 핀 숨기기' : '즐겨찾기 핀 보기'}
            >
                ⭐
            </button>

        </div>
    );
}