import { useState } from 'react';
import { createPortal } from 'react-dom';
import MapContainer from '@/components/map/MapContainer';
import { useResizable } from '@/hooks/useResizable';
import type { POIItem } from '@/types/poi';
import type { CameraFrustum } from '@/hooks/useCameraFrustum';

interface MiniMapPopupOptions {
    mapViewMode: '2D' | '3D';
    selectedApt?: {
        id: number;
        apt_nm: string;
        jibun_address: string;
        lat: number;
        lon: number;
    } | null;
    showFavoritePins?: boolean;
    hoveredPOI?: POIItem | null;
    cameraFrustum?: CameraFrustum | null;
    showCameraFrustum?: boolean;
    onMapClick?: (lat: number, lng: number) => void;
    onAptSelected?: (apt: any) => void;
    onPoint?: (point: { lat: number; lng: number }) => void;
    onToggleMapView?: () => void;
    onToggleCameraFrustum?: () => void;
}

export function useMiniMapPopup() {
    const [isVisible, setIsVisible] = useState(false);

    // 리사이즈 기능
    const { width: miniMapWidth, height: miniMapHeight, resizeHandle: miniMapResizeHandle } = useResizable({
        initialWidth: 320,
        initialHeight: 240,
        minWidth: 200,
        minHeight: 150,
        maxWidth: typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800,
        maxHeight: typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600,
        direction: 'bottom-left'
    });

    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);
    const toggle = () => setIsVisible(!isVisible);

    const renderPopup = (options: MiniMapPopupOptions) => {
        if (!isVisible) return null;

        if (typeof document === 'undefined') return null;

        const popup = (
            <div
                className="fixed top-20 right-4 z-[9999] bg-white border shadow-lg rounded-lg"
                style={{ width: miniMapWidth, height: miniMapHeight }}
            >
                {/* 버튼 컨트롤 영역 */}
                <div className="absolute top-2 right-2 flex gap-2 z-10">
                    {/* 아파트명 표시 */}
                    {options.selectedApt && (
                        <div className="bg-blue-500/90 text-white rounded shadow-sm px-2 py-1 text-xs max-w-48">
                            🏠 <span className="font-medium">{options.selectedApt.apt_nm}</span>
                        </div>
                    )}

                    {/* 3D 시야 토글 버튼 (3D 모드일 때만) */}
                    {options.mapViewMode === '3D' && (
                        <button
                            onClick={options.onToggleCameraFrustum}
                            className={`${
                                options.showCameraFrustum
                                    ? 'bg-blue-500/90 hover:bg-blue-600 text-white'
                                    : 'bg-white/90 hover:bg-white border border-gray-300 text-gray-700'
                            } rounded shadow-sm transition-all px-3 py-1 text-xs`}
                            title={options.showCameraFrustum ? "3D 시야 숨기기" : "3D 시야 보기"}
                        >
                            {options.showCameraFrustum ? '🎯' : '👁️'}
                        </button>
                    )}

                    {/* 전환 버튼 */}
                    <button
                        onClick={options.onToggleMapView}
                        className="bg-white/90 hover:bg-white border border-gray-300 text-gray-700 rounded shadow-sm transition-all px-3 py-1 text-xs"
                        title="맵 모드 전환"
                    >
                        전환
                    </button>

                    {/* 닫기 버튼 */}
                    <button
                        onClick={hide}
                        className="bg-gray-500/90 hover:bg-gray-600 text-white rounded shadow-sm transition-all w-6 h-6 flex items-center justify-center text-xs"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* 지도 컨테이너 */}
                <MapContainer
                    onMapClick={options.onMapClick}
                    onAptSelected={options.onAptSelected}
                    selectedApt={
                        options.selectedApt ? { lat: options.selectedApt.lat, lon: options.selectedApt.lon } : null
                    }
                    isCardExpanded={false}
                    cardWidth={0}
                    tempMarker={options.hoveredPOI}
                    showFavoritePins={options.showFavoritePins}
                    isMiniMap={true}
                    cameraFrustum={options.showCameraFrustum ? options.cameraFrustum : null}
                    mapViewMode={options.mapViewMode}
                />

                {/* 리사이즈 핸들 */}
                <div
                    className={`absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-10 ${
                        miniMapResizeHandle.isDragging ? 'bg-[#3D7D7B]' : 'bg-gray-300 hover:bg-[#14E3DC]'
                    } rounded-bl-lg opacity-60 hover:opacity-100 transition-all duration-200`}
                    onMouseDown={miniMapResizeHandle.onMouseDown}
                    title="크기 조절"
                >
                    <div className="absolute bottom-1 left-1 text-white text-xs">
                        ⤢
                    </div>
                </div>
            </div>
        );

        return createPortal(popup, document.body);
    };

    return {
        isVisible,
        show,
        hide,
        toggle,
        renderPopup
    };
}