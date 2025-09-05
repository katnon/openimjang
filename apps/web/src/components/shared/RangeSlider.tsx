import React, { useState, useRef, useEffect, useCallback } from 'react';

type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  valueToLinear?: (value: number) => number;
  linearToValue?: (linear: number) => number;
  formatValue?: (value: number) => string;
  ticks?: Array<{ value: number; label: string }>;
  className?: string;
  showInputControls?: boolean;
  inputUnit?: string; // 입력 단위 (예: "만원")
  inputStep?: number; // 입력 step 단위 (실제 값)
  valueToInputUnit?: (value: number) => number; // 실제 값을 입력 단위로 변환
  inputUnitToValue?: (inputValue: number) => number; // 입력 단위를 실제 값으로 변환
};

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  valueToLinear,
  linearToValue,
  formatValue = (val) => val.toString(),
  ticks = [],
  className = "",
  showInputControls = false,
  inputUnit = "",
  inputStep = 1,
  valueToInputUnit = (val) => val,
  inputUnitToValue = (val) => val
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);

  // 값을 선형 비율로 변환하는 함수 (기본값 또는 사용자 정의)
  const getLinearPercent = useCallback((val: number) => {
    if (valueToLinear) {
      return valueToLinear(val);
    }
    return ((val - min) / (max - min)) * 100;
  }, [min, max, valueToLinear]);

  // 선형 비율을 실제 값으로 변환하는 함수
  const getValueFromPercent = useCallback((percent: number) => {
    if (linearToValue) {
      return linearToValue(percent);
    }
    const rawValue = min + (percent / 100) * (max - min);
    return Math.round(rawValue / step) * step;
  }, [min, max, step, linearToValue]);

  // 마우스/터치 이벤트로부터 퍼센트 계산
  const getPercentFromEvent = useCallback((event: MouseEvent | TouchEvent) => {
    if (!sliderRef.current) return 0;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    
    return Math.max(0, Math.min(100, percent));
  }, []);

  // 드래그 핸들러
  const handleMouseDown = useCallback((type: 'min' | 'max') => (event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(type);
  }, []);

  // 마우스 이동 핸들러 (값 역전 시 자동 스위치)
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const percent = getPercentFromEvent(event);
    const newValue = getValueFromPercent(percent);
    
    if (isDragging === 'min') {
      if (newValue > value[1]) {
        // min이 max를 넘어서면 스위치
        onChange([value[1], newValue]);
      } else {
        onChange([newValue, value[1]]);
      }
    } else {
      if (newValue < value[0]) {
        // max가 min보다 작아지면 스위치
        onChange([newValue, value[0]]);
      } else {
        onChange([value[0], newValue]);
      }
    }
  }, [isDragging, value, onChange, getPercentFromEvent, getValueFromPercent]);

  // 마우스 업 핸들러
  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // 슬라이더 클릭 핸들러 (가장 가까운 핸들 이동)
  const handleSliderClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return;
    
    const percent = getPercentFromEvent(event.nativeEvent);
    const clickValue = getValueFromPercent(percent);
    
    const distToMin = Math.abs(clickValue - value[0]);
    const distToMax = Math.abs(clickValue - value[1]);
    
    if (distToMin < distToMax) {
      onChange([Math.min(clickValue, value[1]), value[1]]);
    } else {
      onChange([value[0], Math.max(clickValue, value[0])]);
    }
  }, [value, onChange, isDragging, getPercentFromEvent, getValueFromPercent]);

  // 이벤트 리스너 등록
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove as any);
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove as any);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const minPercent = getLinearPercent(value[0]);
  const maxPercent = getLinearPercent(value[1]);

  // 입력 컨트롤용 함수들 (값 역전 시 자동 스위치)
  const handleInputChange = (type: 'min' | 'max', inputValue: string) => {
    const numValue = parseFloat(inputValue) || 0;
    const realValue = Math.max(min, Math.min(max, inputUnitToValue(numValue)));
    
    if (type === 'min') {
      if (realValue > value[1]) {
        // min이 max를 넘어서면 스위치
        onChange([value[1], realValue]);
      } else {
        onChange([realValue, value[1]]);
      }
    } else {
      if (realValue < value[0]) {
        // max가 min보다 작아지면 스위치
        onChange([realValue, value[0]]);
      } else {
        onChange([value[0], realValue]);
      }
    }
  };
  
  const handleStepChange = (type: 'min' | 'max', direction: 'up' | 'down') => {
    const currentInputValue = valueToInputUnit(value[type === 'min' ? 0 : 1]);
    const change = direction === 'up' ? inputStep : -inputStep;
    const newInputValue = currentInputValue + change;
    const newRealValue = inputUnitToValue(newInputValue);
    
    if (type === 'min') {
      const newMin = Math.max(min, Math.min(newRealValue, value[1]));
      onChange([newMin, value[1]]);
    } else {
      const newMax = Math.min(max, Math.max(newRealValue, value[0]));
      onChange([value[0], newMax]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 메인 슬라이더 영역 */}
      <div
        ref={sliderRef}
        className="relative h-6 cursor-pointer"
        onClick={handleSliderClick}
      >
        {/* 배경 트랙 */}
        <div className="absolute top-2 w-full h-2 bg-gray-200 rounded-lg" />
        
        {/* 선택된 범위 하이라이트 */}
        <div
          className="absolute top-2 h-2 bg-primary-500 rounded-lg"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`
          }}
        />
        
        {/* 최솟값 핸들 */}
        <div
          className={`absolute top-0 w-6 h-6 bg-primary-500 border-2 border-white rounded-full shadow-lg cursor-pointer transform -translate-x-3 transition-transform ${
            isDragging === 'min' ? 'scale-110' : 'hover:scale-110'
          }`}
          style={{ left: `${minPercent}%` }}
          onMouseDown={handleMouseDown('min')}
          onTouchStart={(e) => {
            e.preventDefault();
            setIsDragging('min');
          }}
        />
        
        {/* 최댓값 핸들 */}
        <div
          className={`absolute top-0 w-6 h-6 bg-primary-500 border-2 border-white rounded-full shadow-lg cursor-pointer transform -translate-x-3 transition-transform ${
            isDragging === 'max' ? 'scale-110' : 'hover:scale-110'
          }`}
          style={{ left: `${maxPercent}%` }}
          onMouseDown={handleMouseDown('max')}
          onTouchStart={(e) => {
            e.preventDefault();
            setIsDragging('max');
          }}
        />
      </div>
      
      {/* 현재 값 표시 */}
      <div className="text-sm text-gray-700 mt-3 text-center">
        {formatValue(value[0])} ~ {formatValue(value[1])}
      </div>
      
      {/* 입력 컨트롤 */}
      {showInputControls && (
        <div className="flex items-center justify-center gap-4 mt-4">
          {/* 최솟값 입력 */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <input
              type="number"
              value={valueToInputUnit(value[0])}
              onChange={(e) => handleInputChange('min', e.target.value)}
              className="w-20 text-center bg-transparent text-sm font-medium outline-none"
              step={inputStep}
            />
            <span className="text-sm text-gray-600">{inputUnit}</span>
          </div>
          
          <span className="text-gray-400">~</span>
          
          {/* 최댓값 입력 */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <input
              type="number"
              value={valueToInputUnit(value[1])}
              onChange={(e) => handleInputChange('max', e.target.value)}
              className="w-20 text-center bg-transparent text-sm font-medium outline-none"
              step={inputStep}
            />
            <span className="text-sm text-gray-600">{inputUnit}</span>
          </div>
        </div>
      )}
    </div>
  );
};