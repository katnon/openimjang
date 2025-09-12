import { useCallback, useState } from 'react';

export type SeasonPreset = 'spring' | 'summer' | 'autumn' | 'winter';

interface ShadeAnalysisOptions {
  start?: Date;
  end?: Date;
  interval?: number; // 분 단위
  seasonPreset?: SeasonPreset;
  useStoredPosition?: boolean; // 저장된 포인트 사용 여부
}

interface ShadeAnalysisHook {
  isAnalyzing: boolean;
  startShadeAnalysis: (options?: ShadeAnalysisOptions) => Promise<void>;
  clearShadeAnalysis: () => void;
  clearShadeResults: () => void; // 포인트는 유지하고 결과만 제거
  error: string | null;
  setSeasonPreset: (season: SeasonPreset) => void;
  getSeasonDate: (season: SeasonPreset) => Date;
}

export function useShadeAnalysis(
  viewer: any,
  abortController?: AbortController | null
): ShadeAnalysisHook {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedPosition, setStoredPosition] = useState<any>(null); // 선택된 포인트 저장

  // 4계절 날짜 프리셋 함수
  const getSeasonDate = useCallback((season: SeasonPreset): Date => {
    const currentYear = new Date().getFullYear();
    switch (season) {
      case 'spring': // 춘분
        return new Date(currentYear, 2, 20, 14, 0, 0); // 3월 20일 오후 2시
      case 'summer': // 하지
        return new Date(currentYear, 5, 21, 14, 0, 0); // 6월 21일 오후 2시
      case 'autumn': // 추분
        return new Date(currentYear, 8, 23, 14, 0, 0); // 9월 23일 오후 2시
      case 'winter': // 동지
        return new Date(currentYear, 11, 22, 14, 0, 0); // 12월 22일 오후 2시
      default:
        return new Date();
    }
  }, []);

  // 시간 설정 함수 (MapPrime3D viewer용)
  const setSeasonPreset = useCallback((season: SeasonPreset) => {
    if (!viewer || !viewer.clock) {
      console.warn('⚠️ Viewer가 준비되지 않음');
      return;
    }

    try {
      const seasonDate = getSeasonDate(season);

      // Cesium JulianDate로 변환하여 viewer 시간 설정
      if (window.Cesium && window.Cesium.JulianDate) {
        viewer.clock.currentTime = window.Cesium.JulianDate.fromDate(seasonDate);
        console.log(`🗓️ ${season} 시간 설정 완료:`, seasonDate.toISOString());
      }
    } catch (err) {
      console.error('❌ 계절 프리셋 설정 실패:', err);
    }
  }, [viewer, getSeasonDate]);

  // 음영분석 실행
  const startShadeAnalysis = useCallback(async (options?: ShadeAnalysisOptions) => {
    console.log('🌅 startShadeAnalysis 호출됨:', options);
    console.log('🔍 뷰어 상태 확인:', {
      viewer: !!viewer,
      _drawAction: typeof viewer?._drawAction,
      _startAnalysisShade: typeof viewer?._startAnalysisShade,
      cesiumWidget: !!viewer?.cesiumWidget,
      screenSpaceEventHandler: !!viewer?.cesiumWidget?.screenSpaceEventHandler
    });
    
    if (!viewer || !viewer._drawAction || !viewer._startAnalysisShade) {
      console.error('⚠️ MapPrime3D 음영분석 API가 준비되지 않음');
      setError('음영분석 API가 준비되지 않았습니다.');
      return;
    }

    if (abortController?.signal.aborted) {
      console.log('🚫 음영분석 실행 취소됨');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);

      let selectedPoint;

      // 1. 저장된 포인트 사용 여부 확인
      if (options?.useStoredPosition && storedPosition) {
        console.log('📍 저장된 지점 사용:', storedPosition);
        selectedPoint = storedPosition;
      } else {
        console.log('🎯 음영분석을 위한 지점 선택 시작');

        // 🔧 shade.html처럼 간단하게 _drawAction 호출
        console.log('🎯 _drawAction 호출 시작...');
        
        try {
          const drawResult = await viewer._drawAction({
            shapeType: 0, // 점 선택
          });

          console.log('🎯 drawResult 완료:', drawResult);
          console.log('📊 선택된 위치 정보:', drawResult?.data?.positions);
        } catch (drawError) {
          console.error('❌ _drawAction 실행 중 오류:', drawError);
          throw drawError;
        }

        // 작업 취소 확인
        if (abortController?.signal.aborted) {
          console.log('🚫 지점 선택 후 작업 취소됨');
          setIsAnalyzing(false);
          return;
        }

        // 사용자가 취소했거나 지점을 선택하지 않은 경우
        if (!drawResult || !drawResult.data || !drawResult.data.positions || drawResult.data.positions.length === 0) {
          console.log('🚫 사용자가 지점 선택을 취소했거나 지점이 선택되지 않음');
          setIsAnalyzing(false);
          return;
        }

        selectedPoint = drawResult.data.positions[0];
        console.log('📍 새로 선택된 지점:', selectedPoint);

        // 새로 선택된 포인트 저장
        setStoredPosition(selectedPoint);
      }

      // 2. 음영분석 옵션 설정
      let baseDate = new Date();

      // 계절 프리셋이 설정된 경우 해당 날짜 사용
      if (options?.seasonPreset) {
        baseDate = getSeasonDate(options.seasonPreset);
        console.log(`🌱 ${options.seasonPreset} 프리셋 적용:`, baseDate.toISOString());
      }

      const analysisOptions = {
        position: selectedPoint,
        start: options?.start || new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 4, 0, 0), // 오전 4시
        end: options?.end || new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 20, 0, 0), // 오후 8시  
        interval: options?.interval || 15 // 15분 간격
      };

      console.log('🌅 음영분석 실행:', analysisOptions);

      // 3. 음영분석 실행
      const analysisResult = await viewer._startAnalysisShade(analysisOptions);

      if (abortController?.signal.aborted) {
        console.log('🚫 음영분석 완료 후 작업 취소됨');
        setIsAnalyzing(false);
        return;
      }

      console.log('✅ 음영분석 완료:', analysisResult);

      if (analysisResult?.data?.Result) {
        console.log('📊 분석 결과:', analysisResult.data.Result);
      }

    } catch (err) {
      console.error('❌ 음영분석 실패:', err);

      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [viewer, abortController, getSeasonDate, storedPosition]);

  // 음영분석 결과만 정리 (포인트는 유지)
  const clearShadeResults = useCallback(() => {
    try {
      console.log('🧹 음영분석 결과만 정리 (포인트 유지)');
      if (viewer && viewer._removeAnalysisShade) {
        viewer._removeAnalysisShade();
      }
      setError(null);
      setIsAnalyzing(false);
    } catch (err) {
      console.warn('⚠️ 음영분석 결과 정리 중 오류:', err);
    }
  }, [viewer]);

  // 음영분석 완전 초기화 (포인트도 제거)
  const clearShadeAnalysis = useCallback(() => {
    try {
      console.log('🧹 음영분석 완전 초기화');
      clearShadeResults();
      setStoredPosition(null); // 저장된 포인트도 초기화
    } catch (err) {
      console.warn('⚠️ 음영분석 초기화 중 오류:', err);
    }
  }, [clearShadeResults]);

  return {
    isAnalyzing,
    startShadeAnalysis,
    clearShadeAnalysis,
    clearShadeResults,
    error,
    setSeasonPreset,
    getSeasonDate
  };
}