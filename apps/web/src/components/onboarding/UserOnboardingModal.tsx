import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

type UserProfile = {
    purpose: string[]; // 매매/전세/월세/투자 (다중선택 가능)
    workLocation?: string; // 직장 또는 원하는 지하철역
    commutingRadius: number; // 통근 반경 (분)
    budgetRange: string; // 예상 자금 범위
    preferredBuildingAge: string; // 선호 건물 연식
    familyType: string; // 가족 구성
    priorities: string[]; // 우선순위 (다중선택)
    completedAt: Date;
};

type OnboardingModalProps = {
    isOpen: boolean;
    onComplete: () => void;
    onSkip?: () => void;
};

export default function UserOnboardingModal({ isOpen, onComplete, onSkip }: OnboardingModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    
    // 사용자 입력 데이터
    const [profile, setProfile] = useState<Partial<UserProfile>>({
        purpose: [],
        commutingRadius: 30,
        priorities: []
    });

    if (!isOpen || !user) return null;

    const handleSaveProfile = async () => {
        if (!user) {
            console.error("❌ 사용자 정보가 없음");
            return;
        }
        
        setIsLoading(true);
        console.log("🔄 프로필 저장 시작");
        
        try {
            const completeProfile: UserProfile = {
                ...profile as UserProfile,
                completedAt: new Date()
            };

            console.log("📝 저장할 프로필:", completeProfile);
            console.log("👤 사용자 UID:", user.uid);

            await setDoc(doc(db, 'users', user.uid, 'profile', 'basic'), completeProfile, { merge: true });
            console.log("✅ 사용자 프로필 저장 완료");
            
            // 온보딩 완료 콜백 호출
            onComplete();
            
        } catch (error: any) {
            console.error("❌ 프로필 저장 오류:", error);
            console.error("🔍 오류 코드:", error?.code);
            console.error("📄 오류 메시지:", error?.message);
            
            // Firebase 권한 오류인 경우 특별한 안내
            if (error?.code === 'permission-denied') {
                console.log("🔒 Firebase 권한 오류 - 온보딩은 완료 처리");
                alert("프로필 저장 권한이 없지만 온보딩을 완료합니다. Firebase 보안 규칙을 확인해주세요.");
            } else {
                console.log("⚠️ 기타 Firebase 오류 - 온보딩 완료 처리");
                alert("프로필 저장 중 오류가 발생했지만 계속 진행합니다. 나중에 프로필 메뉴에서 다시 설정해주세요.");
            }
            
            // 모든 경우에 온보딩 완료 처리 (사용자 경험 개선)
            onComplete();
        } finally {
            setIsLoading(false);
            console.log("🏁 프로필 저장 처리 완료");
        }
    };

    const toggleArrayValue = (array: string[], value: string): string[] => {
        if (array.includes(value)) {
            return array.filter(item => item !== value);
        } else {
            return [...array, value];
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                부동산 이용 목적을 선택해주세요
                            </h3>
                            <p className="text-sm text-gray-600">
                                맞춤형 정보 제공을 위해 필요합니다 (다중선택 가능)
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {['매매', '전세', '월세', '투자'].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({
                                        ...prev,
                                        purpose: toggleArrayValue(prev.purpose || [], option)
                                    }))}
                                    className={`p-4 rounded-lg border-2 transition-colors ${
                                        profile.purpose?.includes(option)
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-lg font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                가족 구성은 어떻게 되시나요?
                            </h3>
                            <p className="text-sm text-gray-600">
                                라이프스타일에 맞는 정보를 제공해드립니다
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                '1인 가구',
                                '신혼부부 (자녀 없음)',
                                '자녀 있는 가족 (영유아)',
                                '자녀 있는 가족 (초중고)',
                                '부모님과 함께',
                                '기타'
                            ].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({ ...prev, familyType: option }))}
                                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                                        profile.familyType === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                통근 시간은 얼마나 고려하시나요?
                            </h3>
                            <p className="text-sm text-gray-600">
                                교통 접근성 분석에 활용됩니다
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    직장 또는 주요 목적지 (선택사항)
                                </label>
                                <input
                                    type="text"
                                    placeholder="예: 강남역, 여의도, 판교 등"
                                    value={profile.workLocation || ''}
                                    onChange={(e) => setProfile(prev => ({ ...prev, workLocation: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#14e3dc] focus:border-transparent"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    희망 통근 시간: {profile.commutingRadius}분 이내
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="90"
                                    step="10"
                                    value={profile.commutingRadius}
                                    onChange={(e) => setProfile(prev => ({ ...prev, commutingRadius: parseInt(e.target.value) }))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>10분</span>
                                    <span>30분</span>
                                    <span>60분</span>
                                    <span>90분</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                예상 자금 범위를 선택해주세요
                            </h3>
                            <p className="text-sm text-gray-600">
                                적절한 매물 추천을 위해 필요합니다
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                '5억원 미만',
                                '5억원 ~ 10억원',
                                '10억원 ~ 15억원',
                                '15억원 ~ 20억원',
                                '20억원 ~ 30억원',
                                '30억원 이상'
                            ].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({ ...prev, budgetRange: option }))}
                                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                                        profile.budgetRange === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                선호하는 건물 연식을 선택해주세요
                            </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                '신축 (5년 이내)',
                                '10년 이내',
                                '15년 이내',
                                '20년 이내',
                                '연식 무관'
                            ].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({ ...prev, preferredBuildingAge: option }))}
                                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                                        profile.preferredBuildingAge === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                중요하게 생각하는 요소를 선택해주세요
                            </h3>
                            <p className="text-sm text-gray-600">
                                우선순위에 따라 맞춤 정보를 제공합니다 (다중선택 가능)
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                '교통 접근성',
                                '학군',
                                '주차 공간',
                                '생활 편의시설',
                                '의료시설',
                                '공원/녹지',
                                '치안/안전',
                                '투자가치'
                            ].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({
                                        ...prev,
                                        priorities: toggleArrayValue(prev.priorities || [], option)
                                    }))}
                                    className={`p-3 rounded-lg border-2 transition-colors text-sm ${
                                        profile.priorities?.includes(option)
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const isStepComplete = () => {
        switch (step) {
            case 1: return profile.purpose && profile.purpose.length > 0;
            case 2: return profile.familyType;
            case 3: return true; // 통근시간과 위치는 선택사항
            case 4: return profile.budgetRange;
            case 5: return profile.preferredBuildingAge;
            case 6: return profile.priorities && profile.priorities.length > 0;
            default: return false;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                맞춤 정보 설정
                            </h2>
                            <p className="text-xs text-gray-500">
                                {step}/6단계 • 더 나은 서비스를 위해 도움이 됩니다
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {onSkip && (
                                <button
                                    onClick={onSkip}
                                    className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                                >
                                    다음에 하기
                                </button>
                            )}
                            <div className="text-xs text-gray-500">
                                {Math.round((step / 6) * 100)}%
                            </div>
                        </div>
                    </div>
                    
                    {/* 진행률 바 */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-[#14e3dc] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(step / 6) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* 콘텐츠 */}
                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                    {renderStep()}
                </div>

                {/* 버튼 */}
                <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(prev => prev - 1)}
                            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            이전
                        </button>
                    )}
                    
                    {step < 6 ? (
                        <button
                            onClick={() => setStep(prev => prev + 1)}
                            disabled={!isStepComplete()}
                            className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                                isStepComplete()
                                    ? 'bg-[#14e3dc] text-white hover:bg-[#12d4cc]'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            다음
                        </button>
                    ) : (
                        <button
                            onClick={handleSaveProfile}
                            disabled={!isStepComplete() || isLoading}
                            className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                                isStepComplete() && !isLoading
                                    ? 'bg-[#14e3dc] text-white hover:bg-[#12d4cc]'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isLoading ? '저장 중...' : '완료'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}