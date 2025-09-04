import React, { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import axios from "axios";

type AIAnalysisModalProps = {
    isOpen: boolean;
    onClose: () => void;
    selectedApt: {
        id: number;
        apt_nm: string;
        jibun_address: string;
        lat: number;
        lon: number;
    } | null;
};

const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ isOpen, onClose, selectedApt }) => {
    const { user } = useAuth();
    const [analysis, setAnalysis] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen && selectedApt && user) {
            generateAnalysis();
        }
    }, [isOpen, selectedApt, user]);

    const generateAnalysis = async () => {
        if (!user || !selectedApt) return;

        setLoading(true);
        setError("");
        setAnalysis("");

        try {
            // 1. Firebase에서 사용자 메모 가져오기
            const memosRef = collection(db, 'users', user.uid, 'memos');
            const snapshot = await getDocs(memosRef);
            
            const memos = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.aptId === selectedApt.id.toString();
                })
                .map(doc => ({
                    id: doc.id,
                    title: doc.data().title,
                    body: doc.data().body,
                    updatedAt: doc.data().updatedAt?.toDate().toLocaleString('ko-KR') || '',
                }));

            console.log('📝 해당 아파트 메모:', memos);

            // 2. AI 분석 요청
            const response = await axios.post('/api/ai/analyze', {
                aptId: selectedApt.id,
                memos: memos,
                aptData: {
                    aptName: selectedApt.apt_nm,
                    address: selectedApt.jibun_address,
                    lat: selectedApt.lat,
                    lon: selectedApt.lon,
                }
            });

            if (response.data.success) {
                setAnalysis(response.data.analysis);
            } else {
                setError(response.data.error || '분석을 생성할 수 없습니다.');
            }

        } catch (err: any) {
            console.error('❌ AI 분석 오류:', err);
            setError(err.response?.data?.error || '분석 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderMarkdown = (text: string) => {
        // 간단한 마크다운 렌더링
        return text
            .split('\n')
            .map((line, index) => {
                // 헤더 처리
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-gray-800">{line.slice(3)}</h2>;
                }
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-700">{line.slice(4)}</h3>;
                }
                // 볼드 처리
                if (line.includes('**')) {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                        <p key={index} className="mb-2 text-gray-600">
                            {parts.map((part, i) => 
                                i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-800">{part}</strong> : part
                            )}
                        </p>
                    );
                }
                // 리스트 처리
                if (line.match(/^\d+\./)) {
                    return <li key={index} className="ml-6 mb-1 list-decimal text-gray-600">{line.replace(/^\d+\.\s*/, '')}</li>;
                }
                if (line.startsWith('- ')) {
                    return <li key={index} className="ml-6 mb-1 list-disc text-gray-600">{line.slice(2)}</li>;
                }
                // 일반 텍스트
                if (line.trim()) {
                    return <p key={index} className="mb-2 text-gray-600">{line}</p>;
                }
                return <br key={index} />;
            });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            🤖 AI 임장 분석 리포트
                        </h2>
                        {selectedApt && (
                            <p className="text-sm text-gray-600 mt-1">
                                {selectedApt.apt_nm} | {selectedApt.jibun_address}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <svg className="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-gray-600">AI가 임장 데이터를 분석하고 있습니다...</p>
                            <p className="text-sm text-gray-500 mt-2">최대 30초 정도 소요될 수 있습니다.</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex">
                                <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-red-600">{error}</span>
                            </div>
                        </div>
                    ) : analysis ? (
                        <div className="prose max-w-none">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-blue-800">
                                    💡 이 분석은 AI가 실거래 데이터와 사용자의 임장 메모를 종합하여 생성한 것입니다.
                                    투자 결정은 반드시 추가 검토와 전문가 상담을 거쳐 진행하시기 바랍니다.
                                </p>
                            </div>
                            <div className="text-gray-700">
                                {renderMarkdown(analysis)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-gray-600">분석할 데이터를 준비하고 있습니다...</p>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="border-t p-6 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                            {analysis && `생성 시간: ${new Date().toLocaleString('ko-KR')}`}
                        </span>
                        <div className="flex gap-3">
                            {analysis && (
                                <button
                                    onClick={generateAnalysis}
                                    className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                    disabled={loading}
                                >
                                    다시 분석
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAnalysisModal;