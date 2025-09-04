import React from "react";

type FavoriteConfirmPopupProps = {
    isOpen: boolean;
    onClose: () => void;
    onWriteMemo: () => void;
    aptName: string;
};

const FavoriteConfirmPopup: React.FC<FavoriteConfirmPopupProps> = ({ 
    isOpen, 
    onClose, 
    onWriteMemo, 
    aptName 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 mx-4 max-w-md w-full shadow-xl">
                {/* 아이콘 */}
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </div>
                </div>

                {/* 메시지 */}
                <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        즐겨찾기 등록 완료!
                    </h3>
                    <p className="text-gray-600">
                        <span className="font-medium">{aptName}</span>이<br />
                        즐겨찾기에 추가되었습니다.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        임장 메모를 작성하시겠어요?
                    </p>
                </div>

                {/* 버튼들 */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                        다음에
                    </button>
                    <button
                        onClick={() => {
                            onWriteMemo();
                            onClose();
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                        메모 작성
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FavoriteConfirmPopup;