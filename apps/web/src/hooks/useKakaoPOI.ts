import { useState, useCallback, useRef } from 'react';
import { POI_CATEGORIES } from '../types/poi';
import type { POIItem, POISearchResponse, POICategory } from '../types/poi';

interface POISearchParams {
    x: number; // longitude
    y: number; // latitude
    radius?: number;
}

interface CategoryPOIData {
    categoryId: string;
    categoryName: string;
    icon: string;
    color: string;
    items: POIItem[];
    isLoading: boolean;
    error: string | null;
}

interface UsePOIReturn {
    poiData: CategoryPOIData[];
    isLoading: boolean;
    error: string | null;
    searchPOI: (params: POISearchParams) => Promise<void>;
    refreshCategory: (categoryId: string, params: POISearchParams) => Promise<void>;
    toggleCategoryLoading: (categoryId: string, isLoading: boolean) => void;
}

export function useKakaoPOI(): UsePOIReturn {
    const [poiData, setPOIData] = useState<CategoryPOIData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // POI 데이터 초기화
    const initializePOIData = useCallback(() => {
        const allCategories: CategoryPOIData[] = [];
        
        POI_CATEGORIES.forEach(group => {
            group.categories.forEach(category => {
                allCategories.push({
                    categoryId: category.id,
                    categoryName: category.name,
                    icon: category.icon,
                    color: category.color,
                    items: [],
                    isLoading: false,
                    error: null
                });
            });
        });

        setPOIData(allCategories);
    }, []);

    // 단일 카테고리 검색
    const searchSingleCategory = useCallback(async (
        category: POICategory,
        params: POISearchParams,
        signal?: AbortSignal
    ): Promise<POIItem[]> => {
        const { x, y, radius = 1000 } = params;
        
        try {
            let url = `/api/poi/search?`;
            const searchParams = new URLSearchParams({
                x: x.toString(),
                y: y.toString(),
                radius: radius.toString(),
                size: '15'
            });

            // 키워드 검색 우선, 그 다음 카테고리 코드
            if (category.keywords && category.keywords.length > 0) {
                searchParams.append('query', category.keywords[0]);
                // 키워드 검색 시 카테고리 코드는 제외 (더 넓은 검색 결과)
            } else if (category.id && category.id !== 'BUS_STOP') {
                searchParams.append('category_group_code', category.id);
            }

            url += searchParams.toString();


            const response = await fetch(url, { signal });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${category.name}: ${response.status}`);
            }

            const data: POISearchResponse = await response.json();
            
            
            return data.documents || [];

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return [];
            }
            
            throw error;
        }
    }, []);

    // 전체 POI 검색
    const searchPOI = useCallback(async (params: POISearchParams) => {
        // 이전 요청 취소
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
            // POI 데이터 초기화
            initializePOIData();

            // 모든 카테고리에 대해 병렬 검색
            const allCategories: POICategory[] = [];
            POI_CATEGORIES.forEach(group => {
                allCategories.push(...group.categories);
            });


            // 카테고리별 로딩 상태 업데이트
            setPOIData(prev => prev.map(item => ({ ...item, isLoading: true })));

            // 병렬 검색 실행
            const searchPromises = allCategories.map(async (category) => {
                try {
                    const items = await searchSingleCategory(category, params, controller.signal);
                    return { categoryId: category.id, items, error: null };
                } catch (error) {
                    return { 
                        categoryId: category.id, 
                        items: [], 
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });

            const results = await Promise.all(searchPromises);
            
            // 검색 결과 업데이트
            setPOIData(prev => prev.map(categoryData => {
                const result = results.find(r => r.categoryId === categoryData.categoryId);
                if (result) {
                    return {
                        ...categoryData,
                        items: result.items,
                        isLoading: false,
                        error: result.error
                    };
                }
                return { ...categoryData, isLoading: false };
            }));

            const totalResults = results.reduce((sum, result) => sum + result.items.length, 0);

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }

            setError(error instanceof Error ? error.message : 'POI 검색 중 오류가 발생했습니다.');
            
            // 모든 카테고리의 로딩 상태 해제
            setPOIData(prev => prev.map(item => ({ ...item, isLoading: false })));
        } finally {
            setIsLoading(false);
        }
    }, [initializePOIData, searchSingleCategory]);

    // 특정 카테고리만 새로고침
    const refreshCategory = useCallback(async (categoryId: string, params: POISearchParams) => {
        const category = POI_CATEGORIES
            .flatMap(group => group.categories)
            .find(cat => cat.id === categoryId);

        if (!category) {
            return;
        }

        // 해당 카테고리 로딩 상태 설정
        setPOIData(prev => prev.map(item => 
            item.categoryId === categoryId 
                ? { ...item, isLoading: true, error: null }
                : item
        ));

        try {
            const items = await searchSingleCategory(category, params);
            
            setPOIData(prev => prev.map(item => 
                item.categoryId === categoryId 
                    ? { ...item, items, isLoading: false, error: null }
                    : item
            ));

        } catch (error) {
            setPOIData(prev => prev.map(item => 
                item.categoryId === categoryId 
                    ? { 
                        ...item, 
                        isLoading: false, 
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                    : item
            ));
        }
    }, [searchSingleCategory]);

    // 카테고리 로딩 상태 토글
    const toggleCategoryLoading = useCallback((categoryId: string, loading: boolean) => {
        setPOIData(prev => prev.map(item => 
            item.categoryId === categoryId 
                ? { ...item, isLoading: loading }
                : item
        ));
    }, []);

    return {
        poiData,
        isLoading,
        error,
        searchPOI,
        refreshCategory,
        toggleCategoryLoading
    };
}