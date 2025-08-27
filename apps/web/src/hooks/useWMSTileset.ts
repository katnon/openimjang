import { useEffect, useRef, useCallback, useState } from 'react';
import { useSimpleWMSOverlay } from './useWMSOverlay';

export function useWMSTileset(map: kakao.maps.Map | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeTilesets, setActiveTilesets] = useState<Set<string>>(new Set());
  const loadingImagesRef = useRef<Set<string>>(new Set());

  const {
    layers,
    availableLayers,
    debugEnvironment,
    fetchAvailableLayers,
    toggleLayer,
    setLayerOpacity,
    hideAllLayers,
    getMapImageUrl
  } = useSimpleWMSOverlay();

  // Canvas 초기화
  const initializeCanvas = useCallback(() => {
    if (!map || canvasRef.current) return;

    // 지도 컨테이너 찾기
    const mapContainer = document.querySelector('#kakao-map-container') as HTMLDivElement;
    if (!mapContainer) {
      console.error('지도 컨테이너를 찾을 수 없습니다');
      return;
    }

    mapContainerRef.current = mapContainer;

    // Canvas 생성
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;

    // Canvas 크기 설정
    const updateCanvasSize = () => {
      const rect = mapContainer.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateCanvasSize();
    mapContainer.appendChild(canvas);
    canvasRef.current = canvas;

    // 리사이즈 이벤트
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(mapContainer);

    console.log('✅ Canvas 오버레이 초기화 완료');

    return () => {
      resizeObserver.disconnect();
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [map]);

  // WMS 이미지를 Canvas에 그리기
  const drawWMSLayer = useCallback(async (layer: any) => {
    if (!map || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // 현재 지도 bounds 가져오기
      const bounds = map.getBounds();
      if (!bounds) return;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // WMS 이미지 URL 생성 - 정확한 BBOX 형식
      const bbox = `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`;
      const imageUrl = `/api/vworld/map?` + new URLSearchParams({
        layers: layer.name,
        styles: layer.styles || layer.name,
        bbox,
        width: canvas.width.toString(),
        height: canvas.height.toString(),
        crs: 'EPSG:4326',
        format: 'image/png',
        transparent: 'true'
      }).toString();

      console.log(`🗺️ WMS 요청: ${layer.displayName}`, {
        bbox,
        size: `${canvas.width}x${canvas.height}`,
        url: imageUrl
      });

      // 이미지 로드 및 그리기
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // 레이어별 Canvas 영역 클리어 (완전 다시 그리기)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 모든 활성 레이어 다시 그리기
        layers.filter(l => l.visible).forEach(activeLayer => {
          if (activeLayer.id === layer.id) {
            // 현재 로드된 이미지 그리기
            ctx.globalAlpha = activeLayer.opacity;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            console.log(`✅ ${activeLayer.displayName} 그리기 완료`);
          }
        });

        ctx.globalAlpha = 1.0;
        loadingImagesRef.current.delete(layer.id);
      };

      img.onerror = (error) => {
        console.error(`❌ WMS 이미지 로드 실패: ${layer.displayName}`, error);
        loadingImagesRef.current.delete(layer.id);
      };

      loadingImagesRef.current.add(layer.id);
      img.src = imageUrl;

    } catch (error) {
      console.error(`❌ WMS 레이어 그리기 실패: ${layer.displayName}`, error);
      loadingImagesRef.current.delete(layer.id);
    }
  }, [map, layers]);

  // Canvas 전체 지우기
  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // 모든 활성 레이어 다시 그리기
  const redrawAllLayers = useCallback(() => {
    if (!canvasRef.current) return;

    clearCanvas();

    // 보이는 레이어들만 순서대로 그리기
    const visibleLayers = layers.filter(layer => layer.visible);
    visibleLayers.forEach(layer => {
      drawWMSLayer(layer);
    });
  }, [layers, clearCanvas, drawWMSLayer]);

  // 지도 컨테이너에 ID 추가 (Canvas 초기화용)
  useEffect(() => {
    if (!map) return;

    // 지도 컨테이너에 ID 추가
    const mapDiv = document.querySelector('.kakao-map') as HTMLDivElement;
    if (mapDiv && !mapDiv.id) {
      mapDiv.id = 'kakao-map-container';
    }

    const cleanup = initializeCanvas();
    return cleanup;
  }, [map, initializeCanvas]);

  // 레이어 상태 변화 시 Canvas 업데이트
  useEffect(() => {
    const visibleLayers = layers.filter(layer => layer.visible);
    const currentActive = new Set(visibleLayers.map(l => l.id));

    // 활성 레이어 상태 업데이트
    setActiveTilesets(currentActive);

    if (visibleLayers.length === 0) {
      clearCanvas();
    } else {
      redrawAllLayers();
    }
  }, [layers, clearCanvas, redrawAllLayers]);

  // 지도 이동/줌 시 Canvas 업데이트
  useEffect(() => {
    if (!map) return;

    const handleMapUpdate = () => {
      // 조금 지연을 두고 업데이트 (지도 애니메이션 완료 후)
      setTimeout(() => {
        redrawAllLayers();
      }, 300);
    };

    // 지도 이벤트 리스너
    kakao.maps.event.addListener(map, 'idle', handleMapUpdate);
    kakao.maps.event.addListener(map, 'zoom_changed', handleMapUpdate);

    return () => {
      // 정리 (실제로는 removeListener 필요)
    };
  }, [map, redrawAllLayers]);

  // 정리
  useEffect(() => {
    return () => {
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      loadingImagesRef.current.clear();
    };
  }, []);

  return {
    layers,
    availableLayers,
    activeTilesets,
    debugEnvironment,
    fetchAvailableLayers,
    toggleLayer,
    setLayerOpacity,
    hideAllLayers,
    clearCanvas,
    redrawAllLayers
  };
}
