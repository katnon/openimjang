import { useState } from 'react';
import type { WMSLayerCategory, WMSLayer } from '@/types/wms';

interface WMSLayerControlProps {
    categories: WMSLayerCategory[];
    layers: WMSLayer[];
    onToggleLayer: (layerId: string) => void;
    onToggleCategory: (categoryId: string) => void;
    onSetOpacity: (layerId: string, opacity: number) => void;
    onHideAll: () => void;
    onClose?: () => void;
}

export default function WMSLayerControl({
    categories,
    layers,
    onToggleLayer,
    onToggleCategory,
    onSetOpacity,
    onHideAll,
    onClose
}: WMSLayerControlProps) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['zoning'])); // 기본으로 용도지역지구 열어둠

    const toggleCategoryExpansion = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const getLayerById = (layerId: string) => layers.find(layer => layer.id === layerId);

    const isCategoryVisible = (categoryId: string) => {
        const categoryLayers = categories.find(cat => cat.id === categoryId)?.layers || [];
        return categoryLayers.some(catLayer => getLayerById(catLayer.id)?.visible);
    };

    const getVisibleLayersCount = () => layers.filter(layer => layer.visible).length;

    // 디버깅용 - 환경변수 체크
    const hasVWorldKey = !!import.meta.env.VITE_VWORLD_KEY;
    const vworldDomain = import.meta.env.VITE_VWORLD_DOMAIN;

    return (
        <div className="absolute top-4 right-4 z-10">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 overflow-hidden">
                {/* 헤더 */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-blue-500 bg-blue-100 rounded"></div>
                            <h3 className="font-semibold text-gray-900">지도 레이어</h3>
                            {getVisibleLayersCount() > 0 && (
                                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                    {getVisibleLayersCount()}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onHideAll}
                                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                모두 끄기
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                                    title="닫기"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                        아파트 임장에 필요한 정보를 확인하세요
                    </p>

                    {/* 디버깅 정보 */}
                    <div className="mt-2 text-xs">
                        <div className={`${hasVWorldKey ? 'text-green-600' : 'text-red-600'}`}>
                            VWorld Key: {hasVWorldKey ? '✓ 설정됨' : '✗ 없음'}
                        </div>
                        <div className="text-gray-500">
                            Domain: {vworldDomain || 'localhost'}
                        </div>
                    </div>
                </div>

                {/* 레이어 목록 */}
                <div className="max-h-80 overflow-y-auto">
                    {categories.map(category => (
                        <div key={category.id} className="border-b border-gray-100 last:border-b-0">
                            {/* 카테고리 헤더 */}
                            <div
                                className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => toggleCategoryExpansion(category.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleCategory(category.id);
                                                console.log(`🔄 카테고리 토글: ${category.name}`);
                                            }}
                                            className={`px-2 py-1 text-xs rounded transition-colors ${isCategoryVisible(category.id)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-600'
                                                }`}
                                            title={isCategoryVisible(category.id) ? "카테고리 끄기" : "카테고리 켜기"}
                                        >
                                            {isCategoryVisible(category.id) ? '켜짐' : '꺼짐'}
                                        </button>
                                        <span className="font-medium text-sm text-gray-900">
                                            {category.name}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {expandedCategories.has(category.id) ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* 레이어 목록 */}
                            {expandedCategories.has(category.id) && (
                                <div className="bg-white">
                                    {category.layers.map(categoryLayer => {
                                        const layer = getLayerById(categoryLayer.id);
                                        if (!layer) return null;

                                        return (
                                            <div key={layer.id} className="p-3 border-b border-gray-50 last:border-b-0">
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        onClick={() => {
                                                            onToggleLayer(layer.id);
                                                            console.log(`🔄 레이어 토글: ${layer.name} (${layer.layer})`);
                                                        }}
                                                        className={`mt-0.5 px-2 py-1 text-xs rounded transition-colors ${layer.visible
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-200 text-gray-600'
                                                            }`}
                                                        title={layer.visible ? "레이어 끄기" : "레이어 켜기"}
                                                    >
                                                        {layer.visible ? '표시' : '숨김'}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {layer.name}
                                                            </span>
                                                            <span className="text-xs text-gray-500 font-mono">
                                                                {layer.layer}
                                                            </span>
                                                        </div>

                                                        <p className="text-xs text-gray-600 mt-1">
                                                            {layer.description}
                                                        </p>

                                                        {layer.visible && (
                                                            <div className="mt-2">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-xs text-gray-600">투명도</label>
                                                                    <input
                                                                        type="range"
                                                                        min="0.1"
                                                                        max="1"
                                                                        step="0.1"
                                                                        value={layer.opacity}
                                                                        onChange={(e) => onSetOpacity(layer.id, parseFloat(e.target.value))}
                                                                        className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                                    />
                                                                    <span className="text-xs text-gray-600 w-8">
                                                                        {Math.round(layer.opacity * 100)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
