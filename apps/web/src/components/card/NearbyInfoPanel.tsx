import { useEffect, useState, useCallback } from 'react';
import { useKakaoPOI } from '@/hooks/useKakaoPOI';
import { POI_CATEGORIES } from '@/types/poi';
import type { POIGroup, POIItem } from '@/types/poi';

interface NearbyInfoPanelProps {
    lat: number;
    lon: number;
    aptName: string;
    onPOIHover?: (poi: POIItem | null) => void;
}

interface CategorySectionProps {
    group: POIGroup;
    categoryData: any[];
    onToggle: (groupId: string) => void;
    isExpanded: boolean;
    expandedCategories: Set<string>;
    onToggleCategory: (categoryId: string) => void;
    onPOIHover?: (poi: POIItem | null) => void;
}

function CategorySection({ group, categoryData, onToggle, isExpanded, expandedCategories, onToggleCategory, onPOIHover }: CategorySectionProps) {
    const totalCount = categoryData.reduce((sum, cat) => sum + cat.items.length, 0);
    const isAnyLoading = categoryData.some(cat => cat.isLoading);

    return (
        <div className="border border-gray-200 rounded-lg mb-3">
            <button
                onClick={() => onToggle(group.id)}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-t-lg"
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">{group.icon}</span>
                    <span className="font-medium text-gray-800">{group.name}</span>
                    {isAnyLoading && (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {totalCount}개
                    </span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-gray-200">
                    {categoryData.map((categoryItem) => (
                        <div key={categoryItem.categoryId} className="p-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{categoryItem.icon}</span>
                                    <span className="text-sm font-medium text-gray-700">
                                        {categoryItem.categoryName}
                                    </span>
                                    {categoryItem.isLoading && (
                                        <div className="w-3 h-3 border border-gray-300 border-t-blue-400 rounded-full animate-spin"></div>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400">
                                    {categoryItem.items.length}개
                                </span>
                            </div>

                            {categoryItem.error && (
                                <div className="text-xs text-red-500 mb-2">
                                    오류: {categoryItem.error}
                                </div>
                            )}

                            <div className="space-y-2">
                                {/* 상위 5개 또는 전체 표시 */}
                                {(
                                    expandedCategories.has(categoryItem.categoryId) 
                                        ? categoryItem.items 
                                        : categoryItem.items.slice(0, 5)
                                ).map((poi: any, index: number) => (
                                    <div 
                                        key={poi.id || index} 
                                        className="text-xs text-gray-600 pl-4 cursor-pointer hover:bg-gray-50 -ml-1 pl-5 py-1 rounded transition-colors"
                                        onMouseEnter={() => onPOIHover?.(poi)}
                                        onMouseLeave={() => onPOIHover?.(null)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-800 truncate">
                                                    {poi.place_name}
                                                </div>
                                            </div>
                                            <div className="ml-2 text-xs text-gray-400 flex-shrink-0">
                                                {poi.distance}m
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* 확장/축소 버튼 */}
                                {categoryItem.items.length > 5 && (
                                    <button
                                        onClick={() => onToggleCategory(categoryItem.categoryId)}
                                        className="w-full text-xs text-blue-600 text-center py-2 hover:bg-blue-50 rounded transition-colors"
                                    >
                                        {expandedCategories.has(categoryItem.categoryId) 
                                            ? '접기' 
                                            : `+${categoryItem.items.length - 5}개 더 보기`
                                        }
                                    </button>
                                )}

                                {categoryItem.items.length === 0 && !categoryItem.isLoading && (
                                    <div className="text-xs text-gray-400 text-center py-2">
                                        주변에 {categoryItem.categoryName}이(가) 없습니다
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function NearbyInfoPanel({ lat, lon, aptName, onPOIHover }: NearbyInfoPanelProps) {
    const { poiData, isLoading, error, searchPOI } = useKakaoPOI();
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['transport']));
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [hasSearched, setHasSearched] = useState(false);

    // POI 검색 실행 (lat, lon 변경 시 재검색)
    useEffect(() => {
        if (lat && lon) {
            setHasSearched(false); // 위치 변경 시 검색 상태 리셋
            searchPOI({ x: lon, y: lat, radius: 1000 });
            setHasSearched(true);
        }
    }, [lat, lon, aptName, searchPOI]);

    // 그룹 토글 핸들러
    const toggleGroup = useCallback((groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    }, []);

    // 새로고침 핸들러
    const handleRefresh = useCallback(() => {
        setHasSearched(false);
        searchPOI({ x: lon, y: lat, radius: 1000 });
    }, [searchPOI, lon, lat]);

    // 카테고리 토글 핸들러
    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    }, []);

    // POI 데이터를 그룹별로 분류
    const groupedData = POI_CATEGORIES.map(group => ({
        ...group,
        categoryData: group.categories.map(category => 
            poiData.find(data => data.categoryId === category.id) || {
                categoryId: category.id,
                categoryName: category.name,
                icon: category.icon,
                color: category.color,
                items: [],
                isLoading: false,
                error: null
            }
        )
    }));

    if (error) {
        return (
            <div className="p-4 h-full flex flex-col items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 mb-2">❌</div>
                    <div className="text-sm text-gray-600 mb-4">
                        주변 정보를 가져올 수 없습니다
                    </div>
                    <div className="text-xs text-red-500 mb-4">
                        {error}
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    const totalPOIs = poiData.reduce((sum, category) => sum + category.items.length, 0);

    return (
        <div className="h-full flex flex-col">
            {/* 헤더 */}
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">주변 정보</h3>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        title="새로고침"
                    >
                        <span className={`inline-block ${isLoading ? 'animate-spin' : ''}`}>
                            🔄
                        </span>
                    </button>
                </div>
                <div className="text-xs text-gray-500">
                    반경 1km 내 · 총 {totalPOIs}개 시설
                </div>
                {isLoading && !hasSearched && (
                    <div className="text-xs text-blue-600 mt-1">
                        검색 중...
                    </div>
                )}
            </div>

            {/* 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
                {!hasSearched && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <div className="text-2xl mb-2">🗺️</div>
                        <div className="text-sm text-center">
                            주변 정보를 검색합니다...
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {groupedData.map(group => (
                            <CategorySection
                                key={group.id}
                                group={group}
                                categoryData={group.categoryData}
                                onToggle={toggleGroup}
                                isExpanded={expandedGroups.has(group.id)}
                                expandedCategories={expandedCategories}
                                onToggleCategory={toggleCategory}
                                onPOIHover={onPOIHover}
                            />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}