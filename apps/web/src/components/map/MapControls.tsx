import { useCallback } from 'react';

interface MapControlsProps {
    map: kakao.maps.Map | null;
    onToggleLayer?: () => void;
    onTestEnvironment?: () => void;
    onTestConnection?: () => void;
}

export default function MapControls({
    map,
    onToggleLayer,
    onTestEnvironment,
    onTestConnection
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

    // 현재 위치로 이동 (서울로 이동)
    const handleLocate = useCallback(() => {
        if (map) {
            const seoulCenter = new kakao.maps.LatLng(37.5665, 126.9780);
            map.setCenter(seoulCenter);
            map.setLevel(8);
            console.log('🏙️ 서울 중심으로 이동');
        }
    }, [map]);

    // WMS 연결 테스트
    const handleQuickTest = useCallback(async () => {
        try {
            console.log('🧪 빠른 WMS 테스트');

            // 환경변수 확인
            const envResponse = await fetch('/api/vworld/debug');
            const envData = await envResponse.json();

            if (!envData.hasVWorldKey) {
                alert('❌ VWorld API 키가 설정되지 않았습니다.');
                return;
            }

            // 연결 테스트
            const capResponse = await fetch('/api/vworld/capabilities');
            if (capResponse.ok) {
                const capData = await capResponse.json();
                alert(`✅ VWorld 연결 성공!\n레이어 ${capData.total}개 사용 가능`);
            } else {
                throw new Error('연결 실패');
            }

        } catch (error) {
            alert(`❌ WMS 테스트 실패:\n${error}`);
        }
    }, []);

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

            <button
                className={btn}
                onClick={handleLocate}
                title="서울로 이동"
            >
                🏙️
            </button>

            <button
                className={btn}
                onClick={handleQuickTest}
                title="WMS 빠른 테스트"
            >
                🧪
            </button>

            <button
                className={btn}
                onClick={onToggleLayer}
                title="레이어 설정"
            >
                📚
            </button>
        </div>
    );
}