import { useEffect, useRef, useCallback, useState } from 'react';
import { useSimpleWMSOverlay } from './useWMSOverlay';

export function useWMSTileset(map: kakao.maps.Map | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeTilesets, setActiveTilesets] = useState<Set<string>>(new Set());
  const loadingImagesRef = useRef<Set<string>>(new Set());
  const currentCycleIdRef = useRef<number>(0);
  const remainingIdsRef = useRef<Set<string>>(new Set());
  const clearedCycleIdRef = useRef<number>(-1);
  const prevCenterRef = useRef<any>(null);
  const panBaseCenterRef = useRef<any>(null);
  const isPanningRef = useRef<boolean>(false);

  const {
    layers,
    availableLayers,
    debugEnvironment,
    fetchAvailableLayers,
    toggleLayer,
    setLayerOpacity,
    hideAllLayers,
    // getMapImageUrl
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

    // 고스트 캔버스: 드래그/줌 중 즉각적인 이동감을 주기 위한 복사본
    const ghost = document.createElement('canvas');
    ghost.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9;
      opacity: 1;
    `;

    // Canvas 크기 설정
    const updateCanvasSize = () => {
      const rect = mapContainer.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ghost.width = rect.width;
      ghost.height = rect.height;
    };

    updateCanvasSize();
    mapContainer.appendChild(ghost);
    mapContainer.appendChild(canvas);
    canvasRef.current = canvas;
    ghostCanvasRef.current = ghost;

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
  const drawWMSLayer = useCallback(async (layer: any, cycleId?: number) => {
    if (!map || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // 레이어가 현재 비가시 상태면 시작도 하지 않음
      const latest = layers.find(l => l.id === layer.id);
      if (!latest || !latest.visible) return;

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
        // 다른 사이클이면 그리지 않음
        if (cycleId !== undefined && cycleId !== currentCycleIdRef.current) {
          loadingImagesRef.current.delete(layer.id);
          return;
        }
        // 이미 로드되는 사이에 사용자가 레이어를 꺼버렸다면 중단
        const latest = layers.find(l => l.id === layer.id);
        if (!latest || !latest.visible) {
          loadingImagesRef.current.delete(layer.id);
          return;
        }
        // 첫 이미지 도착 시에만 메인 캔버스를 클리어 (기존 프레임 지우기 시점 제어)
        if (cycleId !== undefined && clearedCycleIdRef.current !== cycleId) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          clearedCycleIdRef.current = cycleId;
        }
        // 단일 레이어 그리기
        ctx.save();
        ctx.globalAlpha = latest.opacity;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        console.log(`✅ ${layer.displayName} 그리기 완료`);
        loadingImagesRef.current.delete(layer.id);

        // 모든 레이어 로딩 완료 시 고스트 클리어
        if (remainingIdsRef.current.has(layer.id)) {
          remainingIdsRef.current.delete(layer.id);
        }
        if (remainingIdsRef.current.size === 0) {
          if (ghostCanvasRef.current) {
            const gctx = ghostCanvasRef.current.getContext('2d');
            if (gctx) gctx.clearRect(0, 0, ghostCanvasRef.current.width, ghostCanvasRef.current.height);
          }
        }
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
    if (ghostCanvasRef.current) {
      const gctx = ghostCanvasRef.current.getContext('2d');
      if (gctx) gctx.clearRect(0, 0, ghostCanvasRef.current.width, ghostCanvasRef.current.height);
    }
  }, []);

  // 모든 활성 레이어 다시 그리기
  const redrawAllLayers = useCallback(() => {
    if (!canvasRef.current) return;

    const visibleLayers = layers.filter(layer => layer.visible);

    // 고스트에 현재 화면을 복사해 두기 (메인은 비우지 않음, 첫 onload에서 클리어)
    if (ghostCanvasRef.current && canvasRef.current) {
      const gctx = ghostCanvasRef.current.getContext('2d');
      if (gctx) {
        gctx.clearRect(0, 0, ghostCanvasRef.current.width, ghostCanvasRef.current.height);
        gctx.drawImage(canvasRef.current, 0, 0);
      }
    }

    // 새 사이클 시작
    currentCycleIdRef.current += 1;
    const cycleId = currentCycleIdRef.current;
    remainingIdsRef.current = new Set(visibleLayers.map(l => l.id));

    if (visibleLayers.length === 0) {
      // 모두 꺼진 경우 두 캔버스 모두 클리어
      clearCanvas();
      return;
    }

    visibleLayers.forEach(layer => drawWMSLayer(layer, cycleId));
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

  // 지도 이동/줌 시 Canvas 업데이트 (연속성 개선)
  useEffect(() => {
    if (!map) return;

    // idle: 정식 타일 재요청 및 재그리기 (약간의 디바운스)
    let idleTimer: any;
    const handleIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        redrawAllLayers();
        // 변환 초기화 및 팬 상태 종료
        if (canvasRef.current) canvasRef.current.style.transform = 'translate(0px, 0px)';
        if (ghostCanvasRef.current) ghostCanvasRef.current.style.transform = 'translate(0px, 0px)';
        isPanningRef.current = false;
        prevCenterRef.current = map.getCenter();
      }, 120);
    };

    // center_changed / zoom_changed 동안에는 고스트 캔버스를 즉시 이동시키는 효과
    // lastCenter not needed currently
    const copyToGhost = () => {
      if (!canvasRef.current || !ghostCanvasRef.current) return;
      const gctx = ghostCanvasRef.current.getContext('2d');
      if (!gctx) return;
      gctx.clearRect(0, 0, ghostCanvasRef.current.width, ghostCanvasRef.current.height);
      gctx.drawImage(canvasRef.current, 0, 0);
    };

    const handleCenterChanged = () => {
      // 현재 캔버스를 고스트로 복사해 한 박자 늦는 느낌 완화
      copyToGhost();
      try {
        const proj: any = (map as any).getProjection?.();
        if (!proj?.containerPointFromCoords) return;
        if (!prevCenterRef.current) prevCenterRef.current = map.getCenter();
        if (!isPanningRef.current) {
          panBaseCenterRef.current = prevCenterRef.current;
          isPanningRef.current = true;
        }
        const base = panBaseCenterRef.current || prevCenterRef.current;
        const now = map.getCenter();
        const a = proj.containerPointFromCoords(base);
        const b = proj.containerPointFromCoords(now);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (canvasRef.current) canvasRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        if (ghostCanvasRef.current) ghostCanvasRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      } catch (_e) {
        // projection 불가 시 변환 생략
      }
    };

    const handleZoomChanged = () => {
      copyToGhost();
    };

    // 지도 이벤트 리스너
    kakao.maps.event.addListener(map, 'idle', handleIdle);
    kakao.maps.event.addListener(map, 'center_changed', handleCenterChanged);
    kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChanged);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      // 중복 리스너 누적 방지: 동일 핸들러 해제
      try {
        kakao.maps.event.removeListener(map, 'idle', handleIdle);
        kakao.maps.event.removeListener(map, 'center_changed', handleCenterChanged);
        kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChanged);
      } catch (_e) { }
    };
  }, [map, redrawAllLayers]);

  // ✅ 지도 클릭 시 중심부 GetFeatureInfo로 라벨 텍스트 가져오기
  useEffect(() => {
    if (!map) return;
    const handleClick = async () => {
      const bounds = map.getBounds();
      if (!bounds || !canvasRef.current) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bbox = `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      // center not used; bbox + center pixel로 질의

      // 화면 중심 픽셀 좌표를 대략적으로 캔버스의 가운데로 가정
      const i = Math.floor(width / 2);
      const j = Math.floor(height / 2);

      const firstVisible = layers.find(l => l.visible);
      if (!firstVisible) return;

      try {
        const url = `/api/vworld/featureinfo?` + new URLSearchParams({
          layers: firstVisible.name,
          styles: firstVisible.styles || '',
          bbox,
          width: String(width),
          height: String(height),
          crs: 'EPSG:4326',
          i: String(i),
          j: String(j)
        }).toString();
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        // 간단한 라벨 추출 (속성 중 이름/구역 텍스트로 보이는 첫 값)
        const label = (() => {
          const f = json?.features?.[0];
          if (!f) return '';
          const props = f.properties || {};
          const keys = Object.keys(props);
          const key = keys.find(k => /name|nm|zone|class|type|지구|지역/i.test(k));
          return key ? String(props[key]) : '';
        })();

        if (label) {
          console.log('🛈 영역 라벨:', label);
        }
      } catch (e) {
        // noop
      }
    };

    kakao.maps.event.addListener(map, 'click', handleClick);
    return () => {
      try { kakao.maps.event.removeListener(map, 'click', handleClick); } catch (_e) { }
    };
  }, [map, layers]);

  // 정리
  useEffect(() => {
    return () => {
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      if (ghostCanvasRef.current && ghostCanvasRef.current.parentNode) {
        ghostCanvasRef.current.parentNode.removeChild(ghostCanvasRef.current);
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
