import { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import axios from "axios";

type AiSummaryPanelProps = {
    aptId: number;
    aptName: string;
    lat: number;
    lon: number;
    jibunAddress: string;
};

export default function AiSummaryPanel({ aptId, aptName, lat, lon, jibunAddress }: AiSummaryPanelProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);

    // PostgreSQL에서 공유된 AI 요약 결과 로드
    useEffect(() => {
        const loadSavedSummary = async () => {
            if (!aptId) return;  // user 체크 제거 - 로그인 안해도 조회 가능
            
            setIsLoadingSaved(true);
            try {
                const response = await axios.get(`/api/ai/summary/${aptId}`);
                
                if (response.data.success && response.data.summary) {
                    // 7일 이내의 요약만 사용 (너무 오래된 정보 방지)
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    const createdAt = new Date(response.data.createdAt);
                    if (createdAt > sevenDaysAgo) {
                        setSummary(response.data.summary);
                    }
                }
            } catch (error) {
                console.log("저장된 요약이 없습니다.");
            } finally {
                setIsLoadingSaved(false);
            }
        };

        loadSavedSummary();
    }, [aptId]);  // user 의존성 제거

    // AI 요약 결과를 PostgreSQL에 저장 (공유 저장소)
    const saveSummaryToDatabase = async (summaryText: string) => {
        if (!user || !aptId) return;
        
        try {
            await axios.post('/api/ai/summary/save', {
                aptId: aptId,
                aptName: aptName,
                jibunAddress: jibunAddress,
                summary: summaryText,
                userId: user.uid
            });
            console.log("AI 요약 결과 DB 저장 완료 (공유됨)");
        } catch (error) {
            console.error("AI 요약 결과 저장 오류:", error);
        }
    };

    const handleAnalyze = async () => {
        if (!user) {
            setError("로그인이 필요합니다.");
            return;
        }

        setIsLoading(true);
        setError("");
        setSummary("");

        try {
            // 1. 실거래가 데이터 가져오기
            const dealsResponse = await axios.get(`/api/search/deals/${aptId}`);
            const dealsData = dealsResponse.data;

            // 2. 건물/토지 정보 가져오기 (PNU 기반)
            const [pnuResponse, buildingResponse, landuseResponse] = await Promise.all([
                axios.get(`/api/search/pnu/${aptId}`),
                axios.get(`/api/search/building-info/${aptId}`),
                axios.get(`/api/search/landuse/${aptId}`)
            ]);

            const pnuData = pnuResponse.data;
            const buildingData = buildingResponse.data;
            const landuseData = landuseResponse.data;

            // 데이터 디버깅 로그
            console.log('🔍 AI 분석 데이터 수집:');
            console.log('- 실거래가:', dealsData?.length || 0, '건');
            console.log('- PNU 정보:', pnuData?.pnu ? '✓' : '✗');
            console.log('- 건물 정보:', buildingData?.total_count || 0, '건');
            console.log('- 토지이용계획:', landuseData?.landuse_zones?.length || 0, '개');
            console.log('- 주변 정보:', '수집 예정');

            // 3. 주변 정보 가져오기
            const nearbyResponse = await axios.get(`/api/search/nearby?lat=${lat}&lon=${lon}&radius=500`);
            const nearbyData = nearbyResponse.data;

            // 4. AI 분석 요청
            const analysisData = {
                aptInfo: {
                    name: aptName,
                    address: jibunAddress,
                    lat,
                    lon
                },
                deals: dealsData,
                pnu: pnuData,
                building: buildingData,
                landuse: landuseData,
                nearby: nearbyData
            };

            const aiResponse = await axios.post("/api/ai/apartment-summary", {
                type: "apartment_summary",
                data: analysisData
            });

            // 새 API 응답 구조에 맞게 수정
            const responseText = aiResponse.data.data?.summary || aiResponse.data.response;
            setSummary(responseText);
            
            // 결과를 PostgreSQL에 저장 (모든 사용자가 공유)
            await saveSummaryToDatabase(responseText);

        } catch (error) {
            console.error("AI 분석 오류:", error);
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
                } else if (error.response?.data?.error) {
                    setError(error.response.data.error);
                } else {
                    setError("분석 중 오류가 발생했습니다.");
                }
            } else {
                setError(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 로그인하지 않은 경우, 기존 요약이 있으면 보여주고 없으면 로그인 안내
    if (!user && !summary) {
        return (
            <div className="p-4 h-full overflow-y-auto">
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="mb-6">
                        <div className="text-6xl mb-4">🔐</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">로그인이 필요합니다</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            이 아파트에 대한 AI 요약이 아직 없습니다.<br />
                            로그인하여 AI 스마트 요약을 생성하고<br />
                            다른 사용자들과 정보를 공유해보세요!
                        </p>
                    </div>
                    
                    <button
                        onClick={() => {
                            // 로그인 페이지로 이동 또는 로그인 모달 열기
                            window.location.href = '/login';
                        }}
                        className="px-6 py-3 bg-[#14e3dc] text-white rounded-lg hover:bg-[#12d4cc] transition-colors flex items-center gap-2"
                    >
                        로그인하기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 h-full overflow-y-auto">
            {!summary ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="mb-6">
                        <div className="text-6xl mb-4">🤖</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">AI 스마트 요약</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            실거래가, 건물정보, 주변환경을 종합 분석하여<br />
                            전문적인 부동산 인사이트를 제공합니다.
                        </p>
                    </div>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    {user ? (
                        <button
                            onClick={handleAnalyze}
                            disabled={isLoading || isLoadingSaved}
                            className="px-6 py-3 bg-[#14e3dc] text-white rounded-lg hover:bg-[#12d4cc] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    분석 중...
                                </>
                            ) : isLoadingSaved ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    저장된 요약 확인 중...
                                </>
                            ) : (
                                "AI 분석 시작하기"
                            )}
                        </button>
                    ) : (
                        <div className="text-center">
                            <p className="text-gray-500 text-sm mb-3">
                                아직 이 아파트의 AI 요약이 없습니다
                            </p>
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                로그인하여 요약 생성하기
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            🤖 AI 종합 분석 결과
                        </h3>
                        {user && (
                            <button
                                onClick={() => {
                                    setSummary("");
                                    setError("");
                                }}
                                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                                새로 분석
                            </button>
                        )}
                    </div>
                    
                    <div className="max-w-none">
                        <div 
                            className="text-gray-700 text-sm leading-normal space-y-3"
                            dangerouslySetInnerHTML={{ 
                                __html: summary
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
                                    .replace(/## (.*?)$/gm, '<h3 class="text-base font-bold mt-4 mb-2 text-gray-900 border-b border-gray-200 pb-1">$1</h3>')
                                    .replace(/### (.*?)$/gm, '<h4 class="text-sm font-semibold mt-3 mb-1 text-gray-800">$1</h4>')
                                    .replace(/^\*\s+(.*?)$/gm, '<div class="flex items-start gap-2 mb-1"><span class="text-[#14e3dc] mt-1">•</span><span class="flex-1">$1</span></div>')
                                    .replace(/^-\s+(.*?)$/gm, '<div class="flex items-start gap-2 mb-1"><span class="text-[#14e3dc] mt-1">•</span><span class="flex-1">$1</span></div>')
                                    .replace(/^\d+\.\s+(.*?)$/gm, '<div class="flex items-start gap-2 mb-2"><span class="text-[#14e3dc] font-semibold">•</span><span class="flex-1 font-medium">$1</span></div>')
                                    .replace(/\n\n+/g, '</div><div class="mt-3">')
                                    .replace(/\n/g, '<br class="leading-tight">')
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}