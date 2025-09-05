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

            const aiResponse = await axios.post("/api/ai/analyze", {
                type: "apartment_summary",
                data: analysisData,
                prompt: `${aptName} 물건에 대해 전문적인 부동산 브리핑을 드리겠습니다.

**🏠 물건 개요**
- 위치: ${jibunAddress}
- 분석 기준: ${new Date().toISOString().split('T')[0]} 기준 데이터
- 수집된 데이터: 실거래 ${dealsData?.length || 0}건, 건물정보 ${buildingData?.total_count > 0 ? '있음' : '부족'}, 용도지역 ${landuseData?.landuse_zones?.length || 0}개, 주변시설 ${nearbyData?.pois?.length || 0}개

**📋 상세 브리핑 내용:**

**1. 📊 거래 시세 및 가격 추세 분석**
최근 1년간 거래 데이터를 바탕으로 다음과 같이 분석해드립니다:
- **매매**: 거래 건수, 최저/평균/최고 가격 (X억 X천만원 형식), 평당(㎡당) 평균 단가
- **전세**: 거래 건수, 보증금 범위 및 평균 (X억 X천만원 형식)
- **월세**: 거래 건수, 보증금/월세 범위 및 평균 (보증금 X억 X천만원, 월세 X만원 형식)
- **면적별 가격 분포**: 주요 평형대(60㎡, 84㎡ 등)별 거래 현황
- **가격 변동 추세**: 최근 6개월 대비 상승/하락 여부
- **거래 활성도**: 월평균 거래량과 시장 유동성

**2. 🏗️ 건물 상세 제원 및 단지 구성**
건축물대장 기준으로 다음 정보를 상세히 제공합니다:
- **기본 정보**: 건축연도, 사용승인일, 총 세대수
- **단지 구성**: 주거동 X동, 전용면적 구성 (예: 59㎡, 84㎡, 114㎡)
- **면적 정보**: 대지면적, 건축면적, 연면적 (㎡ 단위)
- **구조 정보**: 지상층수, 지하층수, 지붕구조, 주요 구조 형태
- **주차 환경**: 총 주차대수 → **세대당 주차대수: X.XX대** (소수점 둘째자리까지 정확 계산)
- **편의시설**: 난방시스템, 커뮤니티센터 등 특수동 포함 부대시설
- **건물 노후도**: 건축연도 기준 경과년수

**3. 🎓 학군 및 교육 환경 구체화**
교육시설을 카테고리별로 상세 분석합니다:
- **초등학교 배정**: "이 아파트단지에 살면 ○○초등학교 배정이 됩니다" (실제 학교명, 도보 거리)
- **중학교**: 인근 중학교명과 도보/차량 거리
- **고등학교**: 주요 고등학교와 접근성
- **어린이집/유치원**: 반경 500m 내 개수와 대표 시설
- **학원가**: 주요 학원가 위치와 도보 시간
- **교육 환경 평가**: 학군의 객관적 장단점 (근거 기반)

**4. 🏛️ 공공기관 및 안전시설 접근성**
생활 필수 공공서비스 접근성을 체크합니다:
- **행정기관**: 주민센터(동주민센터) - 거리, 도보시간
- **안전시설**: 소방서, 119안전센터, 파출소, 지구대 - 각각의 위치와 거리
- **의료/보건**: 보건소, 보건지소 접근성
- **우편/금융**: 우체국, 주요 은행 지점
- **응급상황 대응**: 가장 가까운 응급실까지 소요시간

**5. 🚇 교통 및 대중교통 상세 분석**
교통 접근성을 구체적으로 분석합니다:
- **지하철**: 가장 가까운 역명, 노선, 도보/차량 시간, 환승역 정보
- **버스**: 주요 버스정류장과 운행 노선 (간선/지선/마을버스)
- **도로 접근성**: 주요 간선도로, 고속도로 진입로까지 거리
- **출퇴근 시간**: 강남/종로/여의도 등 주요 업무지구까지 대중교통 소요시간
- **주차**: 근린 주차 환경과 노상주차 가능 여부

**6. 🌳 주변 환경 및 안전성 평가**
거주 환경의 장단점을 객관적으로 분석합니다:
- **자연환경**: 공원, 하천, 산 등 녹지 접근성과 산책로
- **소음 환경**: 대로변, 철도, 공항 등 소음 발생 요인
- **산업시설**: 공장, 물류창고 등 악취/소음 유발 시설 유무
- **안전성**: 가로등, CCTV 설치 현황, 심야 치안 상태
- **자연재해**: 홍수/산사태 위험지역 여부 (가능한 경우)

**7. 📜 용도지역 및 개발 계획**
법적 제약사항과 향후 개발 가능성을 검토합니다:
- **용도지역**: 주거/상업/공업/녹지 등 상세 구역 분류
- **건폐율/용적률**: 법적 한계와 추가 개발 가능성
- **개발제한구역**: 그린벨트, 계획관리구역 등 개발 제약
- **재개발**: 향후 재개발 계획이나 정비사업 예정 여부
- **도시계획**: 주변 개발 계획과 교통/상업시설 확충 예정

**8. 💰 투자 관점 및 시장성 (간단히)**
- **임대 시장**: 전세/월세 수요와 공실률 추정
- **매매 시장**: 유사 단지 대비 가격 경쟁력
- **향후 전망**: 지역 개발과 교통망 확충에 따른 가치 변화 가능성

**9. 🏠 실거주 관점 정보 요약**
가족 구성과 라이프스타일별 주요 고려 요소들을 정리합니다:
- **신혼부부**: 교통 접근성, 편의시설 현황
- **자녀 있는 가족**: 학군 정보, 놀이시설, 안전시설 현황  
- **1인 가구**: 대중교통, 편의점, 배달 가능 지역 여부
- **노년층**: 의료시설, 공원, 대중교통 접근성 현황
- 위 정보들을 객관적 사실 위주로 정리하여 직접 판단할 수 있도록 제공

**⚠️ 데이터 한계 및 확인 사항**
- 분석 기준일: ${new Date().toISOString().split('T')[0]}
- 오래된 데이터가 포함된 경우 "○○년 기준, 최신 정보 확인 필요" 명시
- 데이터가 부족한 항목은 "추가 확인 필요"로 표시
- 추정치는 "예상" 또는 "추정"임을 명확히 표기

**작성 원칙:**
- 중개사가 실제 고객에게 설명하듯 친근하고 전문적으로
- 모든 수치는 데이터 기반으로, 추측이나 주관적 평가 금지
- **금액 표시**: 억/천만원 단위로 표기 (예: 15억 3천만원, 2억 8천만원)
- 학교명, 시설명은 실제 명칭 사용 (마스킹 금지)
- 거리는 구체적 수치 제공 (도보 X분, Xm, 차량 X분)
- **세대당 주차대수**: 소수점 둘째자리까지 정확 계산 (예: 1.23대)
- **단지 구성**: 주거동 개수, 전용면적 종류 반드시 포함
- 객관적 사실만 제시, "좋다/나쁘다" 등의 평가나 점수 부여 금지
- 사용자가 직접 판단할 수 있도록 정보만 제공`
            });

            const responseText = aiResponse.data.response;
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