import React, { useState, useEffect, useRef } from 'react';

interface PresetPointLabelProps {
  dong: string;
  ho: string;
  exclu_use_ar: number;
  isHovered?: boolean;
  isExpanded?: boolean;
  onFloorplanClick?: () => void;
  recentDeals?: {
    sale?: { amount: number; date: string } | null;
    jeonse?: { amount: number; date: string } | null;
    monthly?: { deposit: number; rent: number; date: string } | null;
  };
}

export const PresetPointLabel: React.FC<PresetPointLabelProps> = ({
  dong,
  ho,
  exclu_use_ar,
  isHovered = false,
  isExpanded = false,
  onFloorplanClick,
  recentDeals
}) => {
  const [showExpanded, setShowExpanded] = useState(false);

  useEffect(() => {
    if (isHovered || isExpanded) {
      setShowExpanded(true);
    } else {
      const timer = setTimeout(() => setShowExpanded(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isHovered, isExpanded]);

  // 포맷팅 함수들
  const formatArea = (area: number) => {
    return area ? `${area.toFixed(1)}㎡` : '';
  };

  const formatPrice = (amount: number) => {
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(1)}억`;
    }
    return `${amount.toLocaleString()}만원`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="preset-point-label">
      {/* 기본 라벨 (항상 표시) */}
      <div className="bg-teal-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium min-w-max">
        <div className="text-center">
          <div className="font-bold">{dong}동 {ho}호</div>
          <div className="text-xs opacity-90">{formatArea(exclu_use_ar)}</div>
        </div>
      </div>

      {/* 확장된 라벨 (호버 시 표시) */}
      {showExpanded && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-10">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-64">
            {/* 헤더 */}
            <div className="text-center mb-3 pb-2 border-b border-gray-100">
              <div className="font-bold text-gray-800">{dong}동 {ho}호</div>
              <div className="text-sm text-gray-600">{formatArea(exclu_use_ar)}</div>
            </div>

            {/* 최근 거래 정보 */}
            {recentDeals && (
              <div className="space-y-2 mb-3">
                <div className="text-xs font-medium text-gray-700 mb-2">최근 거래</div>

                {recentDeals.sale && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-red-600 font-medium">매매</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {formatPrice(recentDeals.sale.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(recentDeals.sale.date)}
                      </div>
                    </div>
                  </div>
                )}

                {recentDeals.jeonse && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-blue-600 font-medium">전세</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {formatPrice(recentDeals.jeonse.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(recentDeals.jeonse.date)}
                      </div>
                    </div>
                  </div>
                )}

                {recentDeals.monthly && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-green-600 font-medium">월세</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {formatPrice(recentDeals.monthly.deposit)}/{recentDeals.monthly.rent}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(recentDeals.monthly.date)}
                      </div>
                    </div>
                  </div>
                )}

                {!recentDeals.sale && !recentDeals.jeonse && !recentDeals.monthly && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    최근 거래 없음
                  </div>
                )}
              </div>
            )}

            {/* 평면도 보기 버튼 */}
            <button
              onClick={onFloorplanClick}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
              평면도 보기
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .preset-point-label {
          position: relative;
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>
    </div>
  );
};