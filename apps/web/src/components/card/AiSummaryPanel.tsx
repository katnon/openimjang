import { useState } from "react";
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
            const pnuResponse = await axios.get(`/api/search/pnu/${aptId}`);
            const pnuData = pnuResponse.data;

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
                building: pnuData,
                nearby: nearbyData
            };

            const aiResponse = await axios.post("/api/ai/analyze", {
                type: "apartment_summary",
                data: analysisData,
                prompt: `다음 아파트에 대한 종합 분석을 해주세요:
                
                **아파트 정보:**
                - 이름: ${aptName}
                - 주소: ${jibunAddress}
                - 위치: ${lat}, ${lon}
                
                **분석 요청사항:**
                1. 실거래가 동향 분석 (최근 거래 가격, 평당 가격, 가격 변동 추세)
                2. 건물/토지 정보 분석 (건축연도, 면적, 층수, 건물 상태)
                3. 주변 환경 분석 (교통, 교육, 생활편의시설, 상권)
                4. 투자 가치 평가 (장점, 단점, 향후 전망)
                5. 종합 점수 및 추천도 (10점 만점)
                
                **출력 형식:**
                마크다운 형식으로 깔끔하게 정리해주세요. 각 섹션을 명확히 구분하고, 핵심 포인트는 굵게 표시해주세요.`
            });

            setSummary(aiResponse.data.response);

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
                    
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className="px-6 py-3 bg-[#14e3dc] text-white rounded-lg hover:bg-[#12d4cc] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                분석 중...
                            </>
                        ) : (
                            "AI 분석 시작하기"
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            🤖 AI 종합 분석 결과
                        </h3>
                        <button
                            onClick={() => {
                                setSummary("");
                                setError("");
                            }}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                            새로 분석
                        </button>
                    </div>
                    
                    <div className="prose prose-sm max-w-none">
                        <div 
                            className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ 
                                __html: summary
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/## (.*?)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-800">$1</h3>')
                                    .replace(/### (.*?)$/gm, '<h4 class="text-md font-semibold mt-3 mb-2 text-gray-700">$1</h4>')
                                    .replace(/- (.*?)$/gm, '<li class="ml-4">$1</li>')
                                    .replace(/\n/g, '<br>')
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}