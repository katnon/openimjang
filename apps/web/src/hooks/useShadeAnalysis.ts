import { useCallback, useState } from 'react';

export type SeasonPreset = 'spring' | 'summer' | 'autumn' | 'winter';

// 계절별 일조시간 데이터 인터페이스
export interface SunlightData {
  season: SeasonPreset;
  seasonName: string;
  color: string;
  sunlightHours: boolean[]; // 4시~20시 각 시간대별 일조 여부 (17개 시간)
  sunriseTime: string;
  sunsetTime: string;
  totalSunlightHours: number;
}

// 계절별 설정 정보
export const SEASON_CONFIG: Record<SeasonPreset, { name: string; color: string; date: string }> = {
  spring: { name: '춘분', color: '#22c55e', date: '3월 20일' }, // 연두색
  summer: { name: '하지', color: '#ef4444', date: '6월 21일' }, // 빨간색
  autumn: { name: '추분', color: '#f59e0b', date: '9월 23일' }, // 주황색
  winter: { name: '동지', color: '#3b82f6', date: '12월 22일' }, // 파란색
};

// 시간 라벨 (4시~20시)
export const HOUR_LABELS = Array.from({ length: 17 }, (_, i) => `${i + 4}:00`);

interface ShadeAnalysisOptions {
  start?: Date;
  end?: Date;
  interval?: number; // 분 단위
  seasonPreset?: SeasonPreset;
  useStoredPosition?: boolean; // 저장된 포인트 사용 여부
  position?: any; // 직접 전달할 위치 (Cesium Cartesian3)
}

interface ShadeAnalysisHook {
  isAnalyzing: boolean;
  startShadeAnalysis: (options?: ShadeAnalysisOptions) => Promise<void>;
  clearShadeAnalysis: () => void;
  clearShadeResults: () => void; // 포인트는 유지하고 결과만 제거
  error: string | null;
  setSeasonPreset: (season: SeasonPreset) => void;
  getSeasonDate: (season: SeasonPreset) => Date;
  // 계절별 비교 데이터 생성
  generateSeasonalComparisonData: () => Promise<SunlightData[]>;
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
      let drawResult; // drawResult 변수를 상위 스코프에 선언

      // 1. 직접 전달된 위치 사용 여부 확인
      if (options?.position) {
        console.log('📍 직접 전달된 위치 사용 (프리셋 포인트):', options.position);
        selectedPoint = options.position;
        // 프리셋 포인트도 storedPosition에 저장
        console.log('💾 storedPosition 업데이트 (프리셋):', selectedPoint);
        setStoredPosition(selectedPoint);
      } else if (options?.useStoredPosition && storedPosition) {
        console.log('📍 저장된 지점 사용:', storedPosition);
        selectedPoint = storedPosition;
      } else {
        console.log('🎯 음영분석을 위한 지점 선택 시작');

        // 🔧 shade.html처럼 간단하게 _drawAction 호출
        console.log('🎯 _drawAction 호출 시작...');

        try {
          drawResult = await viewer._drawAction({
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

        // 선택된 포인트를 항상 저장 (일조시간 비교를 위해)
        console.log('💾 storedPosition 업데이트:', selectedPoint);
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

  // 계절별 실제 음영분석 데이터 생성
  const generateSeasonalComparisonData = useCallback(async (): Promise<SunlightData[]> => {
    console.log('🔍 일조시간 비교 데이터 생성 시작...');
    console.log('- viewer:', !!viewer);
    console.log('- viewer._startAnalysisShade:', !!viewer?._startAnalysisShade);
    console.log('- storedPosition:', !!storedPosition, storedPosition);

    if (!viewer || !viewer._startAnalysisShade || !storedPosition) {
      console.warn('⚠️ 뷰어, 분석 API 또는 저장된 위치가 준비되지 않음. 목업 데이터 사용');
      console.warn('- 누락된 항목:', {
        viewer: !viewer,
        analysisAPI: !viewer?._startAnalysisShade,
        storedPosition: !storedPosition
      });
      return generateMockSeasonalData();
    }

    console.log('🌅 실제 계절별 음영분석 시작...');
    const seasons: SeasonPreset[] = ['spring', 'summer', 'autumn', 'winter'];
    const results: SunlightData[] = [];

    try {
      for (const season of seasons) {
        console.log(`🔍 ${season} 분석 시작...`);

        const seasonDate = getSeasonDate(season);
        const analysisOptions = {
          position: storedPosition,
          start: new Date(seasonDate.getFullYear(), seasonDate.getMonth(), seasonDate.getDate(), 4, 0, 0), // 오전 4시
          end: new Date(seasonDate.getFullYear(), seasonDate.getMonth(), seasonDate.getDate(), 20, 0, 0), // 오후 8시
          interval: 15 // 15분 간격
        };

        const analysisResult = await viewer._startAnalysisShade(analysisOptions);
        console.log(`✅ ${season} 분석 완료:`, analysisResult);

        // 분석 결과를 SunlightData로 변환
        const sunlightHours = parseAnalysisResult(analysisResult);
        const { sunrise, sunset } = calculateSunriseSunset(sunlightHours);
        const totalHours = sunlightHours.filter(Boolean).length;

        results.push({
          season,
          seasonName: SEASON_CONFIG[season].name,
          color: SEASON_CONFIG[season].color,
          sunlightHours,
          sunriseTime: sunrise,
          sunsetTime: sunset,
          totalSunlightHours: totalHours
        });

        // 각 분석 사이에 잠시 대기 (API 안정성)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('🎉 모든 계절별 분석 완료:', results);
      return results;

    } catch (error) {
      console.error('❌ 계절별 분석 중 오류 발생:', error);
      console.log('🔄 목업 데이터로 대체');
      return generateMockSeasonalData();
    }
  }, [viewer, storedPosition, getSeasonDate]);

  // MapPrime3D 분석 결과를 파싱하여 시간별 일조 여부 배열로 변환
  const parseAnalysisResult = (analysisResult: any): boolean[] => {
    const hourlyData = new Array(17).fill(false); // 4시~20시 (17개 시간)

    try {
      // MapPrime3D API 결과 구조 확인
      if (!analysisResult?.data?.Result) {
        console.warn('⚠️ 분석 결과 데이터가 없음:', analysisResult);
        return hourlyData;
      }

      const result = analysisResult.data.Result;
      console.log('📊 분석 결과 상세:', result);
      console.log('📊 전체 응답 구조:', analysisResult.data);
      console.log('📊 Result 타입:', typeof result, Array.isArray(result));
      if (typeof result === 'object' && result !== null) {
        console.log('📊 Result 키들:', Object.keys(result));
      }

      // 일조량 분석 API와 유사한 구조 확인
      if (analysisResult.data.AverageResult) {
        console.log('📊 AverageResult 발견:', analysisResult.data.AverageResult);
        const avgResult = analysisResult.data.AverageResult;

        // AverageResult가 시간별 데이터를 포함하는 경우
        if (Array.isArray(avgResult)) {
          avgResult.forEach((timeData: any, index: number) => {
            if (index < hourlyData.length) {
              // fraction 값이 일조도를 나타내는 경우 (0~1 범위)
              if (typeof timeData.fraction === 'number') {
                hourlyData[index] = timeData.fraction > 0.1; // 10% 이상이면 일조
              } else if (typeof timeData.sunlight === 'boolean') {
                hourlyData[index] = timeData.sunlight;
              } else {
                // 기타 일조 관련 속성 확인
                hourlyData[index] = Boolean(timeData.light || timeData.sun || !timeData.shade);
              }
            }
          });

          console.log('✅ AverageResult로 파싱 완료:', hourlyData);
          return hourlyData;
        }
      }

      // MapPrime3D 음영분석 결과 파싱 - {time: '14:45', directSun: true} 형태
      if (Array.isArray(result)) {
        console.log('📊 배열 형태 결과 파싱 시작. 총 항목:', result.length);

        result.forEach((item: any, index: number) => {
          if (item && typeof item === 'object') {
            // directSun 속성이 있는 경우 (실제 API 응답 구조)
            if (typeof item.directSun === 'boolean') {
              if (item.time) {
                // 시간 문자열에서 시간 추출 (예: '14:45' -> 14)
                const timeStr = item.time;
                const hour = parseInt(timeStr.split(':')[0]);

                // 4시~20시 범위 내의 시간만 처리
                if (hour >= 4 && hour <= 20) {
                  const hourIndex = hour - 4;
                  if (hourIndex >= 0 && hourIndex < hourlyData.length) {
                    hourlyData[hourIndex] = item.directSun;
                    console.log(`📅 ${hour}시 (인덱스 ${hourIndex}): ${item.directSun ? '일조' : '음영'}`);
                  }
                }
              } else if (index < hourlyData.length) {
                // 시간 정보가 없으면 순서대로 배치
                hourlyData[index] = item.directSun;
              }
            }
            // 기존 로직도 유지 (다른 형태의 응답을 위해)
            else if (index < hourlyData.length) {
              hourlyData[index] = Boolean(item?.sunlight || item?.light || !item?.shade || item > 0);
            }
          }
        });
      } else if (typeof result === 'object') {
        // 객체 형태의 결과
        if (result.hourlyData && Array.isArray(result.hourlyData)) {
          result.hourlyData.forEach((value: any, index: number) => {
            if (index < hourlyData.length) {
              hourlyData[index] = Boolean(value);
            }
          });
        } else if (result.sunlightHours && Array.isArray(result.sunlightHours)) {
          result.sunlightHours.forEach((value: any, index: number) => {
            if (index < hourlyData.length) {
              hourlyData[index] = Boolean(value);
            }
          });
        } else if (result.shadeData && Array.isArray(result.shadeData)) {
          // 음영 데이터인 경우 반전 (음영=false, 일조=true)
          result.shadeData.forEach((isShade: any, index: number) => {
            if (index < hourlyData.length) {
              hourlyData[index] = !Boolean(isShade);
            }
          });
        } else {
          // 다른 구조의 경우 기본 파싱 시도
          console.log('🔍 알 수 없는 결과 구조, 기본 파싱 시도:', Object.keys(result));

          // 시간 관련 키를 찾아 파싱
          const timeKeys = Object.keys(result).filter(key =>
            key.toLowerCase().includes('time') ||
            key.toLowerCase().includes('hour') ||
            key.toLowerCase().includes('sunlight') ||
            key.toLowerCase().includes('shade')
          );

          if (timeKeys.length > 0) {
            const timeData = result[timeKeys[0]];
            if (Array.isArray(timeData)) {
              timeData.forEach((value: any, index: number) => {
                if (index < hourlyData.length) {
                  hourlyData[index] = Boolean(value);
                }
              });
            }
          }
        }
      }

      // 추가적인 구조 파싱 - 시간/일조 배열 쌍
      if (result.times && result.sunlight) {
        // 시간-일조 배열 형태
        result.times.forEach((timeStr: string, index: number) => {
          try {
            const time = new Date(timeStr);
            const hour = time.getHours();

            if (hour >= 4 && hour <= 20) {
              const hourIndex = hour - 4;
              if (hourIndex >= 0 && hourIndex < 17) {
                hourlyData[hourIndex] = result.sunlight[index] || false;
              }
            }
          } catch (parseError) {
            console.warn('⚠️ 시간 파싱 오류:', timeStr, parseError);
          }
        });
      }

      console.log('📊 파싱된 시간별 일조 데이터:', hourlyData);
      return hourlyData;

    } catch (error) {
      console.error('❌ 분석 결과 파싱 오류:', error);
      console.log('🔄 기본 패턴으로 폴백 시도...');

      // 폴백: 일반적인 패턴으로 시도
      try {
        const result = analysisResult?.data?.Result;

        if (result && typeof result === 'object') {
          // 숫자 배열을 찾아서 불린으로 변환
          const possibleArrays = Object.values(result).filter(val => Array.isArray(val));

          for (const arr of possibleArrays) {
            if ((arr as any[]).length >= 10 && (arr as any[]).length <= 20) {
              // 적절한 길이의 배열 발견
              (arr as any[]).forEach((val: any, index: number) => {
                if (index < hourlyData.length) {
                  // 숫자인 경우 0보다 크면 일조, 불린인 경우 그대로
                  hourlyData[index] = typeof val === 'number' ? val > 0 : Boolean(val);
                }
              });
              console.log('✅ 폴백 파싱 성공:', hourlyData);
              return hourlyData;
            }
          }
        }
      } catch (fallbackError) {
        console.error('❌ 폴백 파싱도 실패:', fallbackError);
      }

      // 최종 폴백: 무작위 패턴 생성
      console.log('🎲 최종 폴백: 시뮬레이션 데이터 생성');
      for (let i = 0; i < hourlyData.length; i++) {
        // 일반적인 일조 패턴 시뮬레이션 (오전 6시~오후 6시 주로 일조)
        const hour = i + 4;
        hourlyData[i] = hour >= 6 && hour <= 18 && Math.random() > 0.3;
      }

      return hourlyData;
    }
  };

  // 목업 데이터 생성 함수 (실제 분석 실패 시 사용)
  const generateMockSeasonalData = (): SunlightData[] => {
    const seasons: SeasonPreset[] = ['spring', 'summer', 'autumn', 'winter'];

    return seasons.map(season => {
      const sunlightHours = generateMockSunlightHours(season);
      const { sunrise, sunset } = calculateSunriseSunset(sunlightHours);
      const totalHours = sunlightHours.filter(Boolean).length;

      return {
        season,
        seasonName: SEASON_CONFIG[season].name,
        color: SEASON_CONFIG[season].color,
        sunlightHours,
        sunriseTime: sunrise,
        sunsetTime: sunset,
        totalSunlightHours: totalHours
      };
    });
  };

  // 계절별 목업 일조시간 생성
  const generateMockSunlightHours = (season: SeasonPreset): boolean[] => {
    const hours = new Array(17).fill(false);

    switch (season) {
      case 'spring':
        // 춘분: 6시~18시 (12시간)
        for (let i = 2; i < 14; i++) hours[i] = true;
        break;
      case 'summer':
        // 하지: 5시~19시 (14시간)
        for (let i = 1; i < 15; i++) hours[i] = true;
        break;
      case 'autumn':
        // 추분: 6시~18시 (12시간)
        for (let i = 2; i < 14; i++) hours[i] = true;
        break;
      case 'winter':
        // 동지: 7시~17시 (10시간)
        for (let i = 3; i < 13; i++) hours[i] = true;
        break;
    }

    return hours;
  };

  // 일조시간 배열에서 일출/일몰 시간 계산
  const calculateSunriseSunset = (sunlightHours: boolean[]): { sunrise: string; sunset: string } => {
    const sunriseIndex = sunlightHours.findIndex(hasSunlight => hasSunlight);
    const sunsetIndex = sunlightHours.lastIndexOf(true);

    const sunrise = sunriseIndex >= 0 ? `${sunriseIndex + 4}:00` : '--:--';
    const sunset = sunsetIndex >= 0 ? `${sunsetIndex + 4}:00` : '--:--';

    return { sunrise, sunset };
  };

  return {
    isAnalyzing,
    startShadeAnalysis,
    clearShadeAnalysis,
    clearShadeResults,
    error,
    setSeasonPreset,
    getSeasonDate,
    generateSeasonalComparisonData
  };
}