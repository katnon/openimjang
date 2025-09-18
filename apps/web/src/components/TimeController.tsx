import React, { useState, useRef, useEffect } from 'react';
import { useCesiumTime, TIME_PRESETS, type CesiumTimeHook } from '../hooks/useCesiumTime';

interface TimeControllerProps {
  isVisible: boolean;
  onClose: () => void;
  viewer: any;
  position?: { x: number; y: number };
}

export const TimeController: React.FC<TimeControllerProps> = ({
  isVisible,
  onClose,
  viewer,
  position = { x: 100, y: 100 }
}) => {
  // 컴팩트 팝업용 상태 (드래그 제거)
  const popupRef = useRef<HTMLDivElement>(null);

  // 세슘 시간 제어 훅
  const {
    timeState,
    setDate,
    setHour,
    setMinute,
    applyPreset,
    startAnimation,
    stopAnimation,
    setAnimationSpeed,
    getFormattedTime,
    getFormattedDate,
    isNightTime
  }: CesiumTimeHook = useCesiumTime(viewer);

  // 컴팩트 팝업에서는 드래그 기능 제거

  // 날짜 입력 핸들러
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setDate(newDate);
    }
  };

  // 현재 날짜를 YYYY-MM-DD 형식으로 변환
  const getDateInputValue = () => {
    const year = timeState.date.getFullYear();
    const month = (timeState.date.getMonth() + 1).toString().padStart(2, '0');
    const day = timeState.date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (!isVisible) return null;

  const nightMode = isNightTime();

  return (
    <>
      {/* 컴팩트 팝업 - 버튼 위에 튀어나오는 형태 */}
      <div
        ref={popupRef}
        className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 border rounded-lg shadow-xl z-[800] w-80 transition-all duration-300 ${
          nightMode
            ? 'bg-gradient-to-br from-slate-900 to-blue-900 border-blue-500/30'
            : 'bg-gradient-to-br from-white to-blue-50 border-blue-300'
        }`}
        style={{
          animation: isVisible ? 'slideUp 0.2s ease-out' : 'slideDown 0.2s ease-in'
        }}
      >
        {/* 컴팩트 헤더 */}
        <div className={`px-3 py-2 rounded-t-lg flex justify-between items-center ${
          nightMode
            ? 'bg-gradient-to-r from-slate-800 to-blue-800 text-white'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">🕐 시간 조작</span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors text-sm"
            title="닫기"
          >
            ✕
          </button>
        </div>

        {/* 컴팩트 내용 */}
        <div className="p-4 space-y-4">
          {/* 현재 시간 표시 (컴팩트) */}
          <div className={`text-center p-2 rounded-lg ${
            nightMode
              ? 'bg-slate-800/50 border border-blue-500/30'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className={`text-lg font-bold ${nightMode ? 'text-blue-300' : 'text-blue-700'}`}>
              {getFormattedTime()}
            </div>
            <div className={`text-xs ${nightMode ? 'text-slate-300' : 'text-gray-600'}`}>
              {getFormattedDate()}
            </div>
          </div>

          {/* 빠른 시간대 버튼들 (컴팩트) */}
          <div className="space-y-2">
            <label className={`text-xs font-medium ${nightMode ? 'text-slate-300' : 'text-gray-700'}`}>
              ⚡ 빠른 시간대
            </label>
            <div className="grid grid-cols-4 gap-1">
              {Object.entries(TIME_PRESETS).slice(0, 4).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`px-1 py-1 text-xs rounded transition-all hover:scale-105 ${
                    nightMode
                      ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                      : 'bg-white hover:bg-blue-50 text-gray-700 border border-gray-300'
                  }`}
                  title={`${preset.hour}:${preset.minute.toString().padStart(2, '0')}`}
                >
                  <div className="text-sm">{preset.icon}</div>
                  <div className="text-xs">{preset.label}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(TIME_PRESETS).slice(4).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`px-1 py-1 text-xs rounded transition-all hover:scale-105 ${
                    nightMode
                      ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                      : 'bg-white hover:bg-blue-50 text-gray-700 border border-gray-300'
                  }`}
                  title={`${preset.hour}:${preset.minute.toString().padStart(2, '0')}`}
                >
                  <div className="text-sm">{preset.icon}</div>
                  <div className="text-xs">{preset.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 애니메이션 제어 (컴팩트) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-medium ${nightMode ? 'text-slate-300' : 'text-gray-700'}`}>
                🎬 애니메이션
              </label>
              <button
                onClick={timeState.isAnimating ? stopAnimation : startAnimation}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  timeState.isAnimating
                    ? (nightMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white')
                    : (nightMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white')
                }`}
              >
                {timeState.isAnimating ? '⏸️' : '▶️'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs ${nightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                속도: {timeState.animationSpeed}x
              </span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={timeState.animationSpeed}
                onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-gray-200 rounded appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 커스텀 슬라이더 스타일 + 애니메이션 */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: ${nightMode ? '#3b82f6' : '#2563eb'};
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: ${nightMode ? '#3b82f6' : '#2563eb'};
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .slider::-webkit-slider-track {
          background: ${nightMode ? '#475569' : '#e5e7eb'};
          border-radius: 3px;
          height: 4px;
        }

        .slider::-moz-range-track {
          background: ${nightMode ? '#475569' : '#e5e7eb'};
          border-radius: 3px;
          height: 4px;
        }
      `}</style>
    </>
  );
};

export default TimeController;