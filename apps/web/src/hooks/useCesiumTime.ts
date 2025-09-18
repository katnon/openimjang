import { useState, useCallback, useEffect, useRef } from 'react';

// 시간 프리셋 타입
export interface TimePreset {
  hour: number;
  minute: number;
  label: string;
  icon: string;
}

// 시간 프리셋 정의
export const TIME_PRESETS: Record<string, TimePreset> = {
  dawn: { hour: 5, minute: 30, label: '새벽', icon: '🌅' },
  morning: { hour: 9, minute: 0, label: '오전', icon: '🌞' },
  noon: { hour: 12, minute: 0, label: '정오', icon: '☀️' },
  afternoon: { hour: 15, minute: 0, label: '오후', icon: '🌤️' },
  evening: { hour: 18, minute: 0, label: '저녁', icon: '🌆' },
  night: { hour: 22, minute: 0, label: '밤', icon: '🌙' },
  midnight: { hour: 0, minute: 0, label: '자정', icon: '🌃' }
};

export interface CesiumTimeState {
  date: Date;
  hour: number;
  minute: number;
  isAnimating: boolean;
  animationSpeed: number;
}

export interface CesiumTimeHook {
  // 상태
  timeState: CesiumTimeState;

  // 시간 설정 함수들
  setDate: (date: Date) => void;
  setHour: (hour: number) => void;
  setMinute: (minute: number) => void;
  setDateTime: (date: Date, hour: number, minute: number) => void;

  // 프리셋 함수들
  applyPreset: (presetKey: string) => void;

  // 애니메이션 제어
  startAnimation: () => void;
  stopAnimation: () => void;
  setAnimationSpeed: (speed: number) => void;

  // 유틸리티
  getCurrentDateTime: () => Date;
  getFormattedTime: () => string;
  getFormattedDate: () => string;
  isNightTime: () => boolean;

  // 조명 시스템
  initializeLighting: () => void;
}

export function useCesiumTime(viewer: any): CesiumTimeHook {
  // 기존 설정된 시간 유지 또는 정오로 기본 설정
  const getInitialTime = () => {
    // 뷰어에 이미 시간이 설정되어 있다면 그 시간 사용
    if (viewer && viewer.clock && viewer.clock.currentTime) {
      try {
        const cesiumDate = window.Cesium.JulianDate.toDate(viewer.clock.currentTime);
        return {
          date: new Date(cesiumDate.getFullYear(), cesiumDate.getMonth(), cesiumDate.getDate()),
          hour: cesiumDate.getHours(),
          minute: cesiumDate.getMinutes()
        };
      } catch (error) {
        console.log('기존 세슘 시간 읽기 실패, 정오로 설정');
      }
    }

    // 기본값: 오늘 정오 12시
    const today = new Date();
    return {
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      hour: 12,
      minute: 0
    };
  };

  const initialTime = getInitialTime();
  const [timeState, setTimeState] = useState<CesiumTimeState>({
    date: initialTime.date,
    hour: initialTime.hour,
    minute: initialTime.minute,
    isAnimating: false,
    animationSpeed: 1
  });

  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 세슘 조명 시스템 초기화
  const initializeLighting = useCallback(() => {
    if (!viewer || !viewer.scene) return;

    try {
      // 그림자 활성화
      viewer.shadows = true;
      viewer.terrainShadows = window.Cesium.ShadowMode.ENABLED;

      // 지구 조명 활성화
      viewer.scene.globe.enableLighting = true;

      // 태양광 설정
      viewer.scene.light = new window.Cesium.SunLight();

      // 대기 효과 활성화
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;

      // 그림자 품질 설정
      if (viewer.shadowMap) {
        viewer.shadowMap.maximumDistance = 10000;
        viewer.shadowMap.size = 2048;
      }

      console.log('✅ 세슘 조명 시스템 초기화 완료');
    } catch (error) {
      console.error('❌ 조명 시스템 초기화 실패:', error);
    }
  }, [viewer]);

  // 시간대별 환경 효과 업데이트
  const updateEnvironment = useCallback((hour: number) => {
    if (!viewer || !viewer.scene) return;

    try {
      const isNight = hour < 6 || hour >= 19;  // 19시부터 밤
      const isDawn = hour >= 5 && hour < 8;    // 새벽 시간 확장
      const isDusk = hour >= 17 && hour < 19;  // 저녁 시간 축소
      const isNoon = hour >= 11 && hour <= 13; // 정오 시간대

      // 세슘 자동 태양 위치 계산 사용 (수동 조명 강도 조절 제거)
      // scene.light = null일 때 세슘이 실제 태양 위치와 강도를 자동 계산함

      // 안개 효과 조절
      if (viewer.scene.fog) {
        viewer.scene.fog.enabled = true;
        if (isNight) {
          viewer.scene.fog.density = 0.00005; // 밤에는 안개 거의 없게
        } else if (isDawn || isDusk) {
          viewer.scene.fog.density = 0.0003; // 새벽/저녁 안개 증가
        } else {
          viewer.scene.fog.density = 0.0001; // 낮 적당한 안개
        }
      }

      // 대기 효과 조절
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
        if (isNight) {
          viewer.scene.skyAtmosphere.brightnessShift = -0.5; // 밤 더 어둡게
        } else if (isNoon) {
          viewer.scene.skyAtmosphere.brightnessShift = 0.3;  // 정오 밝게
        } else {
          viewer.scene.skyAtmosphere.brightnessShift = 0;
        }
      }

      // 렌더링 강제 업데이트
      viewer.scene.requestRender();

      const timeType = isNight ? '🌙 밤' : isDawn ? '🌅 새벽' : isDusk ? '🌆 저녁' : isNoon ? '☀️ 정오' : '🌞 낮';
      console.log(`🎨 환경 효과 업데이트: ${timeType} (${hour}시) - 세슘 자동 태양 위치 사용`);
    } catch (error) {
      console.error('❌ 환경 효과 업데이트 실패:', error);
    }
  }, [viewer]);

  // 세슘 뷰어에 시간 적용 + 환경 업데이트
  const applyCesiumTime = useCallback((date: Date, hour: number, minute: number) => {
    if (!viewer || !viewer.clock) return;

    try {
      // 테스트를 위해 한국 시간을 그대로 사용 (변환 없이)
      const localDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);

      // 세슘 JulianDate로 변환 (UTC 변환 없이 테스트)
      const julianDate = window.Cesium.JulianDate.fromDate(localDateTime);

      // 세슘 뷰어에 시간 적용
      viewer.clock.currentTime = julianDate;

      // 환경 효과 업데이트
      updateEnvironment(hour);

      console.log(`🕐 세슘 시간 업데이트: ${localDateTime.toLocaleString('ko-KR')} (직접 설정, 변환 없음)`);
      console.log(`🌍 Julian Date: ${window.Cesium.JulianDate.toDate(julianDate).toISOString()}`);

      // 태양 위치 디버깅
      if (viewer.scene && viewer.scene.sun) {
        console.log(`☀️ 태양 위치 디버깅 - 설정 시간: ${hour}:${minute}`);
      }
    } catch (error) {
      console.error('❌ 세슘 시간 설정 실패:', error);
    }
  }, [viewer, updateEnvironment]);

  // 날짜 설정
  const setDate = useCallback((date: Date) => {
    setTimeState(prev => {
      const newState = { ...prev, date };
      applyCesiumTime(date, prev.hour, prev.minute);
      return newState;
    });
  }, [applyCesiumTime]);

  // 시간 설정
  const setHour = useCallback((hour: number) => {
    const clampedHour = Math.max(0, Math.min(23, hour));
    setTimeState(prev => {
      const newState = { ...prev, hour: clampedHour };
      applyCesiumTime(prev.date, clampedHour, prev.minute);
      return newState;
    });
  }, [applyCesiumTime]);

  // 분 설정
  const setMinute = useCallback((minute: number) => {
    const clampedMinute = Math.max(0, Math.min(59, minute));
    setTimeState(prev => {
      const newState = { ...prev, minute: clampedMinute };
      applyCesiumTime(prev.date, prev.hour, clampedMinute);
      return newState;
    });
  }, [applyCesiumTime]);

  // 날짜와 시간 동시 설정
  const setDateTime = useCallback((date: Date, hour: number, minute: number) => {
    const clampedHour = Math.max(0, Math.min(23, hour));
    const clampedMinute = Math.max(0, Math.min(59, minute));

    setTimeState(prev => ({
      ...prev,
      date,
      hour: clampedHour,
      minute: clampedMinute
    }));

    applyCesiumTime(date, clampedHour, clampedMinute);
  }, [applyCesiumTime]);

  // 프리셋 적용
  const applyPreset = useCallback((presetKey: string) => {
    const preset = TIME_PRESETS[presetKey];
    if (!preset) return;

    console.log(`🎯 시간 프리셋 적용: ${preset.icon} ${preset.label} (${preset.hour}:${preset.minute.toString().padStart(2, '0')})`);

    setTimeState(prev => {
      const newState = { ...prev, hour: preset.hour, minute: preset.minute };
      applyCesiumTime(prev.date, preset.hour, preset.minute);
      return newState;
    });
  }, [applyCesiumTime]);

  // 애니메이션 시작
  const startAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }

    setTimeState(prev => ({ ...prev, isAnimating: true }));

    animationIntervalRef.current = setInterval(() => {
      setTimeState(prev => {
        let newMinute = prev.minute + (1 * prev.animationSpeed);
        let newHour = prev.hour;

        if (newMinute >= 60) {
          newMinute = 0;
          newHour += 1;
        }

        if (newHour >= 24) {
          newHour = 0;
        }

        applyCesiumTime(prev.date, newHour, newMinute);
        return { ...prev, hour: newHour, minute: newMinute };
      });
    }, 100); // 100ms마다 업데이트

    console.log('▶️ 시간 애니메이션 시작');
  }, [applyCesiumTime]);

  // 애니메이션 중지
  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    setTimeState(prev => ({ ...prev, isAnimating: false }));
    console.log('⏸️ 시간 애니메이션 중지');
  }, []);

  // 애니메이션 속도 설정
  const setAnimationSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.1, Math.min(10, speed));
    setTimeState(prev => ({ ...prev, animationSpeed: clampedSpeed }));
    console.log(`⚡ 애니메이션 속도: ${clampedSpeed}x`);
  }, []);

  // 현재 DateTime 객체 반환
  const getCurrentDateTime = useCallback((): Date => {
    return new Date(timeState.date.getFullYear(), timeState.date.getMonth(), timeState.date.getDate(), timeState.hour, timeState.minute);
  }, [timeState]);

  // 포맷된 시간 문자열 (시,분만 정수로 표시)
  const getFormattedTime = useCallback((): string => {
    const hour = Math.round(timeState.hour);
    const minute = Math.round(timeState.minute);

    if (hour === 0) {
      return `자정 12:${minute.toString().padStart(2, '0')}`;
    } else if (hour < 12) {
      return `오전 ${hour}:${minute.toString().padStart(2, '0')}`;
    } else if (hour === 12) {
      return `정오 12:${minute.toString().padStart(2, '0')}`;
    } else {
      return `오후 ${hour - 12}:${minute.toString().padStart(2, '0')}`;
    }
  }, [timeState.hour, timeState.minute]);

  // 포맷된 날짜 문자열
  const getFormattedDate = useCallback((): string => {
    return timeState.date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }, [timeState.date]);

  // 밤 시간인지 확인
  const isNightTime = useCallback((): boolean => {
    return timeState.hour >= 19 || timeState.hour < 6;
  }, [timeState.hour]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  // 뷰어가 처음 로드될 때만 초기 시간 설정
  useEffect(() => {
    if (viewer && viewer.clock) {
      // 뷰어에 이미 설정된 시간이 없거나 기본 시간인 경우에만 설정
      const currentCesiumTime = viewer.clock.currentTime;
      if (!currentCesiumTime || window.Cesium.JulianDate.toDate(currentCesiumTime).getFullYear() < 2000) {
        console.log('⏰ 뷰어 초기 시간 설정:', timeState.hour + ':' + timeState.minute);
        applyCesiumTime(timeState.date, timeState.hour, timeState.minute);
      } else {
        console.log('⏰ 기존 뷰어 시간 유지');
      }
    }
  }, [viewer]); // viewer가 변경될 때만 실행

  // 뷰어가 준비되면 조명 시스템 초기화
  useEffect(() => {
    if (viewer && viewer.scene) {
      // 조명 시스템 초기화는 뷰어가 완전히 로드된 후 실행
      setTimeout(() => {
        initializeLighting();
      }, 100);
    }
  }, [viewer, initializeLighting]);

  return {
    timeState,
    setDate,
    setHour,
    setMinute,
    setDateTime,
    applyPreset,
    startAnimation,
    stopAnimation,
    setAnimationSpeed,
    getCurrentDateTime,
    getFormattedTime,
    getFormattedDate,
    isNightTime,
    initializeLighting // 수동 초기화용
  };
}