import React, { useState, useEffect } from 'react';

interface PointData {
    lat: number;
    lon: number;
    height?: number;
    detectedApt: any;
    dong: string;
    ho: string;
    exclu_use_ar: string;
    floorplan_image_url?: string;
}

interface PointInputModalProps {
    isOpen: boolean;
    pointData: PointData | null;
    onSave: (data: PointData) => void;
    onClose: () => void;
}

const PointInputModal: React.FC<PointInputModalProps> = ({ 
    isOpen, 
    pointData, 
    onSave, 
    onClose 
}) => {
    const [formData, setFormData] = useState<PointData>({
        lat: 0,
        lon: 0,
        detectedApt: null,
        dong: '',
        ho: '',
        exclu_use_ar: '',
        floorplan_image_url: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // pointData가 변경될 때 formData 업데이트
    useEffect(() => {
        if (pointData) {
            setFormData(pointData);
        }
    }, [pointData]);

    const handleInputChange = (field: keyof PointData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB 제한
                alert('파일 크기는 5MB 이하로 업로드해주세요.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드 가능합니다.');
                return;
            }
            setSelectedFile(file);
        }
    };

    const uploadFloorplan = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('floorplan', file);

        const response = await fetch('/api/upload/floorplan', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('파일 업로드 실패');
        }

        const result = await response.json();
        return result.url;
    };

    const handleSave = async () => {
        // 필수 필드 검증
        if (!formData.dong.trim() || !formData.ho.trim()) {
            alert('동과 호수를 입력해주세요.');
            return;
        }

        setIsUploading(true);
        
        try {
            let floorplanUrl = formData.floorplan_image_url;
            
            // 새로운 파일이 선택된 경우 업로드
            if (selectedFile) {
                floorplanUrl = await uploadFloorplan(selectedFile);
            }

            onSave({
                ...formData,
                floorplan_image_url: floorplanUrl
            });
        } catch (error) {
            console.error('업로드 오류:', error);
            alert('평면도 업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen || !pointData) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[600]">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">프리셋 포인트 생성</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-xl"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="space-y-4">
                    {/* 좌표 정보 표시 */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">📍 선택된 위치</h4>
                        <p className="text-sm text-gray-600">
                            위도: {formData.lat.toFixed(6)}, 경도: {formData.lon.toFixed(6)}
                        </p>
                    </div>

                    {/* 자동 감지된 아파트 정보 표시 */}
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">🏠 감지된 아파트</h4>
                        {formData.detectedApt ? (
                            <div>
                                <p className="text-sm font-medium text-blue-700">
                                    {formData.detectedApt.apt_nm}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    {formData.detectedApt.jibun_address}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-blue-600">
                                아파트 정보를 감지하지 못했습니다.
                            </p>
                        )}
                    </div>
                    
                    {/* 사용자 입력 필드들 */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    동 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="예: 101동"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    value={formData.dong}
                                    onChange={(e) => handleInputChange('dong', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    호 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="예: 1001호"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    value={formData.ho}
                                    onChange={(e) => handleInputChange('ho', e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                전용면적 (㎡)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="예: 84.91"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                value={formData.exclu_use_ar}
                                onChange={(e) => handleInputChange('exclu_use_ar', e.target.value)}
                            />
                        </div>

                        {/* 평면도 업로드 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📐 평면도 (선택사항)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                {selectedFile ? (
                                    <div className="space-y-2">
                                        <div className="text-green-600 text-sm">
                                            ✅ {selectedFile.name} 선택됨
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            파일 크기: {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFile(null)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                        >
                                            파일 선택 취소
                                        </button>
                                    </div>
                                ) : formData.floorplan_image_url ? (
                                    <div className="space-y-2">
                                        <div className="text-blue-600 text-sm">
                                            📐 기존 평면도가 등록되어 있습니다
                                        </div>
                                        <img 
                                            src={formData.floorplan_image_url} 
                                            alt="기존 평면도"
                                            className="max-h-20 mx-auto rounded border"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-gray-500 text-sm">
                                            평면도 이미지를 업로드하세요
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            JPG, PNG 파일 / 최대 5MB
                                        </div>
                                    </div>
                                )}
                                
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="floorplan-upload"
                                />
                                <label
                                    htmlFor="floorplan-upload"
                                    className="inline-block mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors text-sm"
                                >
                                    파일 선택
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 버튼 영역 */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isUploading ? '업로드 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PointInputModal;