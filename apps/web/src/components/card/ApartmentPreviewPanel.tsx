import React, { useState, useEffect } from 'react';
import { useDeveloperMode } from "@/contexts/DeveloperModeProvider";

interface PresetPoint {
    id: number;
    lat: number;
    lon: number;
    height?: number; // 🆕 높이 정보 추가
    apt_nm: string;
    jibun_address: string;
    dong: string;
    ho: string;
    exclu_use_ar: number;
    apt_id: number; // 🆕 아파트 ID 추가
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
    onAreaClickNavigate?: (area: number) => void; // 전용면적 클릭 시 실거래가 탭으로 이동
    highlightedPresetId?: number | null; // 하이라이팅할 프리셋 ID
}

const ApartmentPreviewPanel: React.FC<ApartmentPreviewPanelProps> = ({
    aptId,
    aptName,
    onPresetSelect,
    onFloorplanView,
    onWindowViewAction,
    onShadeAnalysisAction,
    onDeletePreset,
    onAreaClickNavigate,
    highlightedPresetId
}) => {
    const [presets, setPresets] = useState<PresetPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingPresetId, setDeletingPresetId] = useState<number | null>(null);

    // 🔧 개발자 모드용 좌표 수정 상태
    const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
    const [editCoords, setEditCoords] = useState<{lat: number, lon: number, height: number}>({lat: 0, lon: 0, height: 0});
    const [updatingPresetId, setUpdatingPresetId] = useState<number | null>(null);

    // 개발자 모드 상태
    const { isDeveloperMode } = useDeveloperMode();

    // 하이라이팅된 프리셋으로 스크롤
    useEffect(() => {
        if (highlightedPresetId && presets.length > 0) {
            const element = document.getElementById(`preset-${highlightedPresetId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('📍 하이라이팅된 프리셋으로 스크롤:', highlightedPresetId);
            }
        }
    }, [highlightedPresetId, presets]);

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

    const handleAreaClick = (area: number, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('📐 전용면적 클릭됨:', area);
        onAreaClickNavigate?.(area);
    };

    const handleFloorplanClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('📐 평면도 보기:', preset);
        onFloorplanView?.(preset);
    };

    const handleWindowViewClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('🪟 창가뷰 실행 (ID 기반):', preset);

        // 🔥 새로운 ID 기반 함수 사용으로 항상 최신 데이터 조회
        if (window.MapPrime3DNavigator?.executeWindowViewAtPresetById) {
            window.MapPrime3DNavigator.executeWindowViewAtPresetById(preset.id)
                .then(() => {
                    console.log('✅ ID 기반 창가뷰 완료');
                })
                .catch((error) => {
                    console.error('❌ ID 기반 창가뷰 실패:', error);
                    // 실패 시 기존 방식으로 폴백
                    console.log('🔄 기존 방식으로 폴백 실행');
                    onWindowViewAction?.(preset);
                });
        } else {
            // Navigator가 준비되지 않은 경우 기존 방식 사용
            console.warn('⚠️ ID 기반 Navigator가 준비되지 않음, 기존 방식 사용');
            onWindowViewAction?.(preset);
        }
    };

    const handleShadeAnalysisClick = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('☀️ 음영분석 실행 (ID 기반):', preset);

        // 🔥 새로운 ID 기반 함수 사용으로 항상 최신 데이터 조회
        if (window.MapPrime3DNavigator?.executeShadeAnalysisAtPresetById) {
            window.MapPrime3DNavigator.executeShadeAnalysisAtPresetById(preset.id)
                .then(() => {
                    console.log('✅ ID 기반 음영분석 완료');
                })
                .catch((error) => {
                    console.error('❌ ID 기반 음영분석 실패:', error);
                    // 실패 시 기존 방식으로 폴백
                    console.log('🔄 기존 방식으로 폴백 실행');
                    onShadeAnalysisAction?.(preset);
                });
        } else {
            // Navigator가 준비되지 않은 경우 기존 방식 사용
            console.warn('⚠️ ID 기반 Navigator가 준비되지 않음, 기존 방식 사용');
            onShadeAnalysisAction?.(preset);
        }
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

    // 🔧 개발자 모드용 좌표 수정 함수들
    const handleEditCoordinates = (preset: PresetPoint, e: React.MouseEvent) => {
        e.stopPropagation(); // 프리셋 선택 이벤트 방지
        console.log('🔧 편집할 프리셋 정보:', preset);
        setEditingPresetId(preset.id);
        setEditCoords({
            lat: preset.lat,
            lon: preset.lon,
            height: preset.height !== undefined ? preset.height : 0
        });
        console.log('🔧 편집 폼 초기값:', {
            lat: preset.lat,
            lon: preset.lon,
            height: preset.height !== undefined ? preset.height : 0
        });
    };

    const handleCancelEdit = () => {
        setEditingPresetId(null);
        setEditCoords({lat: 0, lon: 0, height: 0});
    };

    const handleSaveCoordinates = async (presetId: number) => {
        try {
            setUpdatingPresetId(presetId);

            console.log('🔧 좌표 수정 요청:', {
                presetId,
                coords: editCoords,
                url: `/api/preset-points/update-coordinates/${presetId}`
            });

            const response = await fetch(`/api/preset-points/update-coordinates/${presetId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lat: editCoords.lat,
                    lon: editCoords.lon,
                    height: editCoords.height
                })
            });

            console.log('🔧 API 응답 상태:', response.status, response.statusText);

            const result = await response.json();
            console.log('🔧 API 응답 내용:', result);

            if (response.ok && result.success) {
                // 성공 시 로컬 상태 업데이트
                setPresets(prev => prev.map(p =>
                    p.id === presetId
                        ? { ...p, lat: editCoords.lat, lon: editCoords.lon, height: editCoords.height }
                        : p
                ));

                setEditingPresetId(null);
                console.log('✅ 프리셋 좌표 수정 성공:', result.data);

                // 🔥 3D 지도의 프리셋 포인트들을 새로고침하여 실시간 반영
                if (window.MapPrime3DNavigator?.reloadPresetPoints) {
                    console.log('🔄 3D 지도 프리셋 포인트 새로고침 실행');
                    window.MapPrime3DNavigator.reloadPresetPoints(aptId)
                        .then(() => {
                            console.log('✅ 3D 지도 프리셋 포인트 새로고침 완료');

                            // 🎯 추가: 업데이트된 좌표로 현재 실행 중인 기능들 재실행
                            const updatedPreset = {
                                id: presetId,
                                lat: editCoords.lat,
                                lon: editCoords.lon,
                                height: editCoords.height,
                                dong: presets.find(p => p.id === presetId)?.dong || '',
                                ho: presets.find(p => p.id === presetId)?.ho || ''
                            };

                            console.log('🎯 업데이트된 프리셋으로 기능 재실행 준비:', updatedPreset);
                        })
                        .catch((error) => {
                            console.error('❌ 3D 지도 새로고침 실패:', error);
                        });
                } else {
                    console.warn('⚠️ MapPrime3DNavigator가 준비되지 않음');
                }

                alert('좌표가 성공적으로 수정되었습니다!');
            } else {
                console.error('❌ 프리셋 좌표 수정 실패:', {
                    status: response.status,
                    result
                });
                alert(`좌표 수정에 실패했습니다: ${result.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('❌ 프리셋 좌표 수정 중 네트워크 오류:', error);
            alert(`좌표 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setUpdatingPresetId(null);
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
                        id={`preset-${preset.id}`}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            highlightedPresetId === preset.id
                                ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                                : 'border-gray-200 hover:bg-gray-50'
                        }`}
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
                                            <span
                                                className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded cursor-pointer hover:bg-purple-200 transition-colors"
                                                onClick={(e) => handleAreaClick(preset.exclu_use_ar, e)}
                                                title="클릭하여 실거래가 탭으로 이동"
                                            >
                                                {preset.exclu_use_ar}㎡
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-xs text-gray-500">
                                        등록일: {new Date(preset.created_at).toLocaleDateString('ko-KR')}
                                    </div>
                                </div>

                                {/* 개발자 모드 버튼들 */}
                                {isDeveloperMode && (
                                    <div className="flex items-center gap-1">
                                        {/* 좌표 편집 버튼 */}
                                        <button
                                            onClick={(e) => handleEditCoordinates(preset, e)}
                                            disabled={editingPresetId === preset.id}
                                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                                            title="좌표 편집 (개발자 모드)"
                                        >
                                            📍
                                        </button>
                                        {/* 삭제 버튼 */}
                                        <button
                                            onClick={(e) => handleDeleteClick(preset.id, e)}
                                            disabled={deletingPresetId === preset.id}
                                            className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                                            title="프리셋 삭제 (개발자 모드)"
                                        >
                                            {deletingPresetId === preset.id ? '⏳' : '🗑️'}
                                        </button>
                                    </div>
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

                        {/* 🔧 개발자 모드용 좌표 편집 폼 */}
                        {isDeveloperMode && editingPresetId === preset.id && (
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                                <div className="text-xs font-medium text-orange-800 mb-2">📍 좌표 편집</div>

                                <div className="space-y-2">
                                    {/* 위도 */}
                                    <div>
                                        <label className="text-xs text-gray-600">위도 (Latitude)</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={editCoords.lat}
                                            onChange={(e) => setEditCoords(prev => ({...prev, lat: parseFloat(e.target.value) || 0}))}
                                            className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
                                            placeholder="37.123456"
                                        />
                                    </div>

                                    {/* 경도 */}
                                    <div>
                                        <label className="text-xs text-gray-600">경도 (Longitude)</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={editCoords.lon}
                                            onChange={(e) => setEditCoords(prev => ({...prev, lon: parseFloat(e.target.value) || 0}))}
                                            className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
                                            placeholder="127.123456"
                                        />
                                    </div>

                                    {/* 높이 */}
                                    <div>
                                        <label className="text-xs text-gray-600">높이 (Height, m)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editCoords.height}
                                            onChange={(e) => setEditCoords(prev => ({...prev, height: parseFloat(e.target.value) || 0}))}
                                            className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
                                            placeholder="50.0"
                                        />
                                    </div>
                                </div>

                                {/* 버튼 그룹 */}
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        onClick={() => handleSaveCoordinates(preset.id)}
                                        disabled={updatingPresetId === preset.id}
                                        className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-50"
                                    >
                                        {updatingPresetId === preset.id ? '⏳ 저장중...' : '✅ 저장'}
                                    </button>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded transition-colors"
                                    >
                                        ❌ 취소
                                    </button>
                                </div>
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