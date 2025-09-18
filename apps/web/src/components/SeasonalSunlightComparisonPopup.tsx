import React, { useState, useEffect, useRef } from 'react';
import {
  SEASON_CONFIG,
  HOUR_LABELS,
  type SunlightData
} from '../hooks/useShadeAnalysis';

interface SeasonalSunlightComparisonPopupProps {
  isVisible: boolean;
  onClose: () => void;
  sunlightData: SunlightData[]; // 계절별 일조시간 데이터
  position?: { x: number; y: number }; // 팝업 초기 위치
}

export const SeasonalSunlightComparisonPopup: React.FC<SeasonalSunlightComparisonPopupProps> = ({
  isVisible,
  onClose,
  sunlightData,
  position = { x: 200, y: 150 }
}) => {
  const [popupPosition, setPopupPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      const rect = popupRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  // 드래그 중
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPopupPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  // 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 드래그 이벤트 리스너 등록/해제
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);


  if (!isVisible) return null;

  return (
    <>
      {/* 팝업 */}
      <div
        ref={popupRef}
        className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[700] min-w-[600px] max-w-[800px]"
        style={{
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 헤더 */}
        <div className="drag-handle bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">☀️ 계절별 일조시간 비교</div>
            <div className="text-sm opacity-90">음영분석 결과</div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            title="닫기"
          >
            ✕
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          {/* 범례 */}
          <div className="flex justify-center gap-6 mb-6">
            {sunlightData.map((data) => (
              <div key={data.season} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: data.color }}
                />
                <span className="text-sm font-medium">
                  {data.seasonName} ({SEASON_CONFIG[data.season].date})
                </span>
                <span className="text-xs text-gray-600">
                  {data.totalSunlightHours}시간
                </span>
              </div>
            ))}
          </div>

          {/* 시간축 그래프 */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            {/* 시간 라벨 (상단) */}
            <div className="flex justify-between text-xs text-gray-600 mb-2 px-12">
              {HOUR_LABELS.filter((_, i) => i % 2 === 0).map((hour) => (
                <div key={hour} className="text-center">{hour}</div>
              ))}
            </div>

            {/* 계절별 그래프 행 */}
            <div className="space-y-3">
              {sunlightData.map((data) => (
                <div key={data.season} className="flex items-center gap-3">
                  {/* 계절 라벨 */}
                  <div className="w-16 text-sm font-medium text-right">
                    {data.seasonName}
                  </div>

                  {/* 일조시간 바 */}
                  <div className="flex-1 flex">
                    {data.sunlightHours.map((hasSunlight, hourIndex) => (
                      <div
                        key={hourIndex}
                        className="flex-1 h-8 border-r border-gray-300 last:border-r-0"
                        style={{
                          backgroundColor: hasSunlight
                            ? data.color
                            : '#e5e7eb',
                          opacity: hasSunlight ? 0.8 : 0.3
                        }}
                        title={`${hourIndex + 4}시: ${hasSunlight ? '일조' : '음영'}`}
                      />
                    ))}
                  </div>

                  {/* 시간 정보 */}
                  <div className="w-24 text-xs text-gray-600">
                    {data.sunriseTime} ~ {data.sunsetTime}
                  </div>
                </div>
              ))}
            </div>

            {/* 시간 라벨 (하단) */}
            <div className="flex justify-between text-xs text-gray-600 mt-2 px-12">
              {HOUR_LABELS.filter((_, i) => i % 2 === 1).map((hour) => (
                <div key={hour} className="text-center">{hour}</div>
              ))}
            </div>
          </div>

          {/* 요약 정보 */}
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-800">
              <div className="font-semibold mb-2">📊 일조시간 요약</div>
              <div className="grid grid-cols-2 gap-2">
                <div>최대 일조: <span className="font-medium text-red-600">하지 ({sunlightData.find(d => d.season === 'summer')?.totalSunlightHours || 0}시간)</span></div>
                <div>최소 일조: <span className="font-medium text-blue-600">동지 ({sunlightData.find(d => d.season === 'winter')?.totalSunlightHours || 0}시간)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SeasonalSunlightComparisonPopup;