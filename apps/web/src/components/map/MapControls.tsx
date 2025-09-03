import { useCallback } from 'react';

interface MapControlsProps {
    map: kakao.maps.Map | null;
}

export default function MapControls({
    map
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


    const btn = "w-10 h-10 rounded-xl border border-neutral-300 bg-white hover:border-indigo-500 shadow transition-all";
    const btnActive = "w-10 h-10 rounded-xl border border-indigo-500 bg-indigo-50 text-indigo-600 shadow transition-all";

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

        </div>
    );
}