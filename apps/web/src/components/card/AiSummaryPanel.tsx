import { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import axios from "axios";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

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

    // 저장된 AI 요약 결과 로드
    useEffect(() => {
        const loadSavedSummary = async () => {
            if (!user || !aptId) return;
            
            setIsLoadingSaved(true);
            try {
                const summaryDoc = await getDoc(doc(db, 'users', user.uid, 'ai_summaries', aptId.toString()));
                if (summaryDoc.exists()) {
                    const data = summaryDoc.data();
                    if (data?.summary && data?.createdAt) {
                        // 7일 이내의 요약만 사용 (너무 오래된 정보 방지)
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                        
                        if (data.createdAt.toDate() > sevenDaysAgo) {
                            setSummary(data.summary);
                        }
                    }
                }
            } catch (error) {
                console.error("저장된 요약 로드 오류:", error);
            } finally {
                setIsLoadingSaved(false);
            }
        };

        loadSavedSummary();
    }, [user, aptId]);

    // AI 요약 결과를 Firebase에 저장
    const saveSummaryToFirebase = async (summaryText: string) => {
        if (!user || !aptId) return;
        
        try {
            await setDoc(doc(db, 'users', user.uid, 'ai_summaries', aptId.toString()), {
                aptId: aptId,
                aptName: aptName,
                aptAddress: jibunAddress,
                summary: summaryText,
                createdAt: new Date(),
                lat: lat,
                lon: lon
            });
            console.log("AI 요약 결과 저장 완료");
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

            const aiResponse = await axios.post("/api/ai/analyze", {
                type: "apartment_summary",
                data: analysisData,
                prompt: `${aptName} 물건에 대해 브리핑 드리겠습니다.

**🏠 물건 개요**
- 위치: ${jibunAddress}
- 수집된 데이터: 실거래 ${dealsData?.length || 0}건, 건물정보 ${buildingData?.total_count > 0 ? '있음' : '부족'}, 용도지역 ${landuseData?.landuse_zones?.length || 0}개

**📋 브리핑 내용:**

**1. 시세 현황**
최근 실거래가를 보시면, 현재 이 단지가 어느 정도 가격대에서 거래되고 있는지, 거래량은 어떤지 말씀드릴게요. 면적별로 어떤 평형이 인기가 있는지도 확인해드립니다.

**2. 단지 기본 정보**
${buildingData?.total_count > 0 ? '건축물대장을 보니' : '확인된 정보로는'} 건축연도, 총 세대수, 주차 여건 같은 거주하실 때 꼭 알아두셔야 할 기본 정보들 정리해드립니다.

**3. 용도지역 확인**
${landuseData?.landuse_zones?.length > 0 ? 
`현재 이 지역이 ${landuseData.landuse_zones.filter(zone => 
zone.name.includes('주거') || 
zone.name.includes('상업') || 
zone.name.includes('준공업') ||
zone.name.includes('공업')
).map(zone => zone.name).join(', ')} 등으로 지정되어 있어서` : 
'용도지역상'} 향후 주변에 어떤 시설들이 들어올 수 있는지 제약사항이 있는지 확인해드립니다.

**4. 교통 및 생활편의성**
실제 거주하시면서 중요한 교통접근성, 학군, 쇼핑, 병원 등 생활에 필요한 편의시설들이 얼마나 가까이 있는지 체크해드립니다.

**5. 실거주 관점 총평**
전체적으로 이 물건이 실제 살기에는 어떤지, 주의해서 보셔야 할 부분은 무엇인지 솔직하게 말씀드립니다.

**작성 가이드:**
- 실제 중개사가 고객에게 설명하는 방식으로 친근하게
- 데이터에 없는 내용은 추측하지 말고 "확인 필요" 명시
- 거주자 관점에서 실용적인 정보 중심
- 투자나 개발 관련 언급은 하지 않음
- 용도지역은 주요한 것(주거, 상업, 공업계열)만 언급`
            });

            const responseText = aiResponse.data.response;
            setSummary(responseText);
            
            // 결과를 Firebase에 저장하여 비용 절약
            await saveSummaryToFirebase(responseText);

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