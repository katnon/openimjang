import React from 'react';

interface FloorplanPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  floorplanImageUrl?: string;
  aptName?: string;
  dong?: string;
  ho?: string;
  exclu_use_ar?: number;
}

export const FloorplanPopup: React.FC<FloorplanPopupProps> = ({
  isOpen,
  onClose,
  title = "평면도",
  floorplanImageUrl,
  aptName,
  dong,
  ho,
  exclu_use_ar
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />

      {/* 팝업 컨테이너 */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            {aptName && dong && ho && (
              <p className="text-sm text-gray-600 mt-1">
                {aptName} {dong}동 {ho}호
                {exclu_use_ar && ` · ${typeof exclu_use_ar === 'number' ? exclu_use_ar.toFixed(1) : parseFloat(exclu_use_ar).toFixed(1)}㎡`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 평면도 이미지 */}
        <div className="p-4">
          {floorplanImageUrl ? (
            <div className="flex justify-center">
              <img
                src={floorplanImageUrl}
                alt="평면도"
                className="max-w-full max-h-96 object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = target.nextElementSibling as HTMLDivElement;
                  if (errorDiv) errorDiv.style.display = 'flex';
                }}
              />
              {/* 이미지 로드 실패 시 표시 */}
              <div
                className="hidden items-center justify-center w-full h-96 bg-gray-100 rounded-lg"
                style={{ display: 'none' }}
              >
                <div className="text-center">
                  <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                  <p className="text-gray-600 font-medium">평면도를 불러올 수 없습니다</p>
                  <p className="text-gray-500 text-sm mt-1">이미지 URL을 확인해주세요</p>
                </div>
              </div>
            </div>
          ) : (
            /* 평면도 없을 때 플레이스홀더 */
            <div className="flex items-center justify-center w-full h-96 bg-gray-100 rounded-lg">
              <div className="text-center">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 12l2 2 4-4" />
                  <path d="M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                <p className="text-gray-600 font-medium">평면도 준비 중</p>
                <p className="text-gray-500 text-sm mt-1">곧 제공될 예정입니다</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 (선택사항) */}
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500 text-center">
            평면도는 참고용이며 실제와 다를 수 있습니다
          </div>
        </div>
      </div>
    </div>
  );
};