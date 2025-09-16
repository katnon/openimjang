import React, { useState, useEffect } from 'react';
import { useDeveloperMode } from "@/contexts/DeveloperModeProvider";

interface PresetPoint {
    id: number;
    lat: number;
    lon: number;
    apt_nm: string;
    jibun_address: string;
    dong: string;
    ho: string;
    exclu_use_ar: number;
    floorplan_image_url?: string;
    created_at: string;
}

interface ApartmentPreviewPanelProps {
    aptId: number;
    aptName: string;
    onPresetSelect?: (preset: PresetPoint) => void; // 프리셋 선택 시 콜백
    onFloorplanView?: (preset: PresetPoint) => void; // 평면도 보기 콜백
    onWindowViewAction?: (preset: PresetPoint) => void; // 창가뷰 실행 콜백
    onShadeAnalysisAction?: (preset: PresetPoint) => void; // 음영분석 실행 콜백
    onDeletePreset?: (presetId: number) => void; // 프리셋 삭제 콜백 (개발자 모드)
}

const ApartmentPreviewPanel: React.FC<ApartmentPreviewPanelProps> = ({
    aptId,
    aptName,
    onPresetSelect,
    onFloorplanView,
    onWindowViewAction,
    onShadeAnalysisAction,
    onDeletePreset
}) => {
    const [presets, setPresets] = useState<PresetPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingPresetId, setDeletingPresetId] = useState<number | null>(null);

    // 개발자 모드 상태
    const { isDeveloperMode } = useDeveloperMode();

    // 아파트의 프리셋 포인트 로드
    useEffect(() => {
        const loadPresets = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/preset-points/by-apartment/${aptId}`);
                const result = await response.json();

                if (result.success) {
                    setPresets(result.data);
                } else {
                    setError(result.error || '프리셋 로딩 실패');
                }
            } catch (err) {
                setError('네트워크 오류가 발생했습니다.');
                console.error('프리셋 로딩 오류:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (aptId) {
            loadPresets();
        }
    }, [aptId]);

    const handlePresetClick = (preset: PresetPoint) => {
        console.log('🏠 프리셋 선택:', preset);
        onPresetSelect?.(preset);
    };

    const handleFloorplanClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('📐 평면도 보기:', preset);
        onFloorplanView?.(preset);
    };

    const handleWindowViewClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('🪟 창가뷰 실행:', preset);
        onWindowViewAction?.(preset);
    };

    const handleShadeAnalysisClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('☀️ 음영분석 실행:', preset);
        onShadeAnalysisAction?.(preset);
    };

    const handleDeleteClick = async (presetId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지

        if (!confirm('이 프리셋 포인트를 삭제하시겠습니까?')) {
            return;
        }

        try {
            setDeletingPresetId(presetId);

            const response = await fetch(`/api/preset-points/${presetId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                // 목록에서 삭제된 프리셋 제거
                setPresets(prev => prev.filter(p => p.id !== presetId));
                console.log('✅ 프리셋 삭제 성공:', result.data);

                // 부모 컴포넌트에 삭제 알림
                onDeletePreset?.(presetId);
            } else {
                console.error('❌ 프리셋 삭제 실패:', result.error);
                alert(`삭제에 실패했습니다: ${result.error}`);
            }
        } catch (error) {
            console.error('❌ 프리셋 삭제 중 오류:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setDeletingPresetId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <span className="ml-3 text-gray-600">프리셋 포인트 로딩 중...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-500 mb-2">⚠️ 오류</div>
                <div className="text-sm text-gray-600">{error}</div>
            </div>
        );
    }

    if (presets.length === 0) {
        return (
            <div className="p-6 text-center">
                <div className="text-gray-400 mb-2">📍</div>
                <div className="text-sm text-gray-600 mb-2">
                    {aptName}에 등록된 프리셋 포인트가 없습니다.
                </div>
                <div className="text-xs text-gray-500">
                    3D 지도에서 개발자 모드를 활성화하여 프리셋을 생성해보세요.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* 헤더 */}
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-1">
                    🏠 {aptName} 프리셋 포인트
                </h3>
                <p className="text-sm text-gray-600">
                    총 {presets.length}개의 등록된 포인트
                </p>
            </div>

            {/* 프리셋 목록 */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {presets.map((preset) => (
                    <div
                        key={preset.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handlePresetClick(preset)}
                    >
                        <div className="space-y-3">
                            {/* 메인 정보 */}
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                            {preset.dong}
                                        </span>
                                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                            {preset.ho}
                                        </span>
                                        {preset.exclu_use_ar && (
                                            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">
                                                {preset.exclu_use_ar}㎡
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-xs text-gray-500">
                                        등록일: {new Date(preset.created_at).toLocaleDateString('ko-KR')}
                                    </div>
                                </div>

                                {/* 개발자 모드 삭제 버튼 */}
                                {isDeveloperMode && (
                                    <button
                                        onClick={(e) => handleDeleteClick(preset.id, e)}
                                        disabled={deletingPresetId === preset.id}
                                        className="ml-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                                        title="프리셋 삭제 (개발자 모드)"
                                    >
                                        {deletingPresetId === preset.id ? '⏳' : '🗑️'}
                                    </button>
                                )}
                            </div>

                            {/* 액션 버튼 그룹 */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* 창가뷰 버튼 */}
                                <button
                                    onClick={(e) => handleWindowViewClick(preset, e)}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs px-3 py-1 rounded transition-colors flex items-center gap-1"
                                    title="창가뷰로 이동"
                                >
                                    🪟 창가뷰
                                </button>

                                {/* 음영분석 버튼 */}
                                <button
                                    onClick={(e) => handleShadeAnalysisClick(preset, e)}
                                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-3 py-1 rounded transition-colors flex items-center gap-1"
                                    title="음영분석 실행"
                                >
                                    ☀️ 음영분석
                                </button>

                                {/* 평면도 버튼 */}
                                {preset.floorplan_image_url && (
                                    <button
                                        onClick={(e) => handleFloorplanClick(preset, e)}
                                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs px-3 py-1 rounded transition-colors flex items-center gap-1"
                                        title="평면도 보기"
                                    >
                                        📐 평면도
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 평면도 썸네일 (있는 경우) */}
                        {preset.floorplan_image_url && (
                            <div className="mt-3">
                                <img
                                    src={preset.floorplan_image_url}
                                    alt={`${preset.dong} ${preset.ho} 평면도`}
                                    className="w-full h-24 object-cover rounded border border-gray-200"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 푸터 */}
            <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                    💡 프리셋을 클릭하면 3D 지도에서 해당 위치를 확인할 수 있습니다
                </p>
            </div>
        </div>
    );
};

export default ApartmentPreviewPanel;