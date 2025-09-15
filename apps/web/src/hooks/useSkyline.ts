import { useState, useCallback } from 'react';

export interface SkylineResult {
    terrainSkyline?: {
        image: string;
        skyRatio: number;
        landRatio: number;
    };
    fullSkyline?: {
        image: string;
        skyRatio: number;
        landRatio: number;
    };
}

export function useSkyline(viewer: any, onSkylineClose?: () => void) {
    const [isSkylineAnalyzing, setIsSkylineAnalyzing] = useState(false);
    const [skylineResult, setSkylineResult] = useState<SkylineResult | null>(null);
    const [showSkylineResult, setShowSkylineResult] = useState(false);
    const [skylineError, setSkylineError] = useState<string | null>(null);

    // 스카이라인 분석 시작
    const startSkylineAnalysis = useCallback(async () => {
        if (!viewer || !viewer._startAnalysisSkyline) {
            const error = '스카이라인 분석 API를 사용할 수 없습니다';
            console.warn('⚠️', error);
            setSkylineError(error);
            return;
        }

        console.log('🌆 스카이라인 분석 시작');
        setIsSkylineAnalyzing(true);
        setSkylineResult(null);
        setSkylineError(null);

        try {
            const result = await viewer._startAnalysisSkyline({
                onClose: () => {
                    console.log('🔄 스카이라인 분석 종료');
                    setShowSkylineResult(false);
                    // 스카이라인 분석 종료 시 콜백 호출 (카메라 락 해제)
                    if (onSkylineClose) {
                        onSkylineClose();
                    }
                }
            });

            console.log('✅ 스카이라인 분석 완료:', result);
            setSkylineResult(result);
            setShowSkylineResult(true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '스카이라인 분석 중 오류가 발생했습니다';
            console.error('❌ 스카이라인 분석 실패:', error);
            setSkylineError(errorMessage);
        } finally {
            setIsSkylineAnalyzing(false);
        }
    }, [viewer]);

    // 스카이라인 분석 결과 초기화
    const clearSkylineAnalysis = useCallback(() => {
        if (viewer && viewer._removeAnalysisSkyline) {
            viewer._removeAnalysisSkyline();
        }
        setShowSkylineResult(false);
        setSkylineResult(null);
        setIsSkylineAnalyzing(false);
        setSkylineError(null);
        console.log('🧹 스카이라인 분석 결과 초기화');
    }, [viewer]);

    // 스카이라인 결과 모달 닫기
    const closeSkylineResult = useCallback(() => {
        setShowSkylineResult(false);
        // 모달 닫을 때도 콜백 호출 (카메라 락 해제)
        if (onSkylineClose) {
            onSkylineClose();
        }
    }, [onSkylineClose]);

    // 스카이라인 에러 초기화
    const clearSkylineError = useCallback(() => {
        setSkylineError(null);
    }, []);

    return {
        // 상태
        isSkylineAnalyzing,
        skylineResult,
        showSkylineResult,
        skylineError,
        
        // 함수들
        startSkylineAnalysis,
        clearSkylineAnalysis,
        closeSkylineResult,
        clearSkylineError,
    };
}