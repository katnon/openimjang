import { useState, useCallback } from 'react';

export interface SimpleWMSLayer {
    id: string;
    name: string;
    displayName: string;
    description: string;
    visible: boolean;
    opacity: number;
    styles?: string; // ✅ 스타일 정보 추가
}

// ✅ VWorld 실제 레이어와 스타일 매핑
export const USEFUL_LAYERS: SimpleWMSLayer[] = [
    {
        id: 'cadastral',
        name: 'lp_pa_cbnd_bonbun,lp_pa_cbnd_bubun',
        displayName: '연속지적도',
        description: '토지 경계 및 지번 정보',
        styles: 'lp_pa_cbnd_bonbun_line,lp_pa_cbnd_bubun_line',
        visible: false,
        opacity: 0.7
    },
    {
        id: 'urban_planning',
        name: 'lt_c_uq111',
        displayName: '도시지역',
        description: '주거/상업/공업지역 구분',
        styles: 'lt_c_uq111',
        visible: false,
        opacity: 0.6
    },
    {
        id: 'administrative',
        name: 'lt_c_ademd',
        displayName: '읍면동 경계',
        description: '행정구역 경계',
        styles: 'lt_c_ademd',
        visible: false,
        opacity: 0.5
    }
];

export function useSimpleWMSOverlay() {
    const [layers, setLayers] = useState<SimpleWMSLayer[]>(() =>
        USEFUL_LAYERS.map(layer => ({ ...layer }))
    );

    const [availableLayers, setAvailableLayers] = useState<string[]>([]);

    // BFF 환경변수 디버깅
    const debugEnvironment = useCallback(async () => {
        try {
            const response = await fetch('/api/vworld/debug');
            const data = await response.json();
            console.log('🔐 BFF 환경변수 상태:', data);
            return data;
        } catch (error) {
            console.error('환경변수 디버깅 실패:', error);
            return null;
        }
    }, []);

    // BFF에서 사용 가능한 레이어 목록 가져오기
    const fetchAvailableLayers = useCallback(async () => {
        try {
            console.log('🔍 레이어 목록 요청...');
            const response = await fetch('/api/vworld/capabilities');

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 레이어 데이터:', data);
                setAvailableLayers(data.layers.map((l: any) => l.name));
                return data.layers;
            } else {
                const errorData = await response.json();
                console.error('❌ 레이어 요청 실패:', errorData);
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('레이어 목록 가져오기 실패:', error);
            throw error;
        }
    }, []);

    // 레이어 토글
    const toggleLayer = useCallback((layerId: string) => {
        setLayers(prev =>
            prev.map(layer =>
                layer.id === layerId
                    ? { ...layer, visible: !layer.visible }
                    : layer
            )
        );
    }, []);

    // 투명도 설정
    const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
        setLayers(prev =>
            prev.map(layer =>
                layer.id === layerId
                    ? { ...layer, opacity }
                    : layer
            )
        );
    }, []);

    // 모든 레이어 끄기
    const hideAllLayers = useCallback(() => {
        setLayers(prev =>
            prev.map(layer => ({ ...layer, visible: false }))
        );
    }, []);

    // ✅ 올바른 BBOX 생성 (카카오맵 bounds → WMS BBOX)
    const getMapImageUrl = useCallback((layer: SimpleWMSLayer, bounds: any, width = 256, height = 256) => {
        if (!bounds) return null;

        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // xmin,ymin,xmax,ymax 형식으로 전달 (BFF에서 EPSG:4326용으로 변환)
        const bbox = `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`;

        const params = new URLSearchParams({
            layers: layer.name,
            styles: layer.styles || layer.name, // 스타일 지정
            bbox,
            width: width.toString(),
            height: height.toString(),
            crs: 'EPSG:4326',
            format: 'image/png',
            transparent: 'true'
        });

        return `/api/vworld/map?${params.toString()}`;
    }, []);

    return {
        layers,
        availableLayers,
        debugEnvironment,
        fetchAvailableLayers,
        toggleLayer,
        setLayerOpacity,
        hideAllLayers,
        getMapImageUrl
    };
}
