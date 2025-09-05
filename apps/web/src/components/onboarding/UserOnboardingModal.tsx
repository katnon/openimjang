import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { RangeSlider } from "@/components/shared/RangeSlider";

type UserProfile = {
    purpose: string[]; // 매매/전세/월세/투자 (다중선택 가능)
    workLocation?: string; // 직장 또는 원하는 지하철역
    commutingRadius: number; // 통근 반경 (분)
    budgetRange: [number, number]; // 전월세 보증금 및 매매 자금 범위 [최소, 최대] (원 단위)
    monthlyRent: [number, number]; // 월세 금액 [최소, 최대] (원 단위)
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
        budgetRange: [0, 1000000000], // [최소: 0원, 최대: 10억원]
        monthlyRent: [0, 5000000], // [최소: 0원, 최대: 500만원]
        priorities: []
    });

    if (!isOpen || !user) return null;

    // 선형 슬라이더를 위한 값 변환 함수들
    const getBudgetValueFromLinear = (linearValue: number): number => {
        let rawValue;
        // linearValue는 0-100 범위의 값
        if (linearValue <= 20) {
            // 0-20%: 0원 ~ 1천만원 (100만원 단위)
            rawValue = (linearValue / 20) * 10000000;
            return Math.round(rawValue / 1000000) * 1000000; // 100만원 단위로 반올림
        } else if (linearValue <= 35) {
            // 20-35%: 1천만원 ~ 5천만원 (500만원 단위)
            const ratio = (linearValue - 20) / 15;
            rawValue = 10000000 + ratio * 40000000;
            return Math.round(rawValue / 5000000) * 5000000; // 500만원 단위로 반올림
        } else if (linearValue <= 60) {
            // 35-60%: 5천만원 ~ 5억원 (1천만원 단위)
            const ratio = (linearValue - 35) / 25;
            rawValue = 50000000 + ratio * 450000000;
            return Math.round(rawValue / 10000000) * 10000000; // 1천만원 단위로 반올림
        } else if (linearValue <= 75) {
            // 60-75%: 5억원 ~ 10억원 (5천만원 단위)
            const ratio = (linearValue - 60) / 15;
            rawValue = 500000000 + ratio * 500000000;
            return Math.round(rawValue / 50000000) * 50000000; // 5천만원 단위로 반올림
        } else if (linearValue <= 90) {
            // 75-90%: 10억원 ~ 20억원 (1억 단위)
            const ratio = (linearValue - 75) / 15;
            rawValue = 1000000000 + ratio * 1000000000;
            return Math.round(rawValue / 100000000) * 100000000; // 1억 단위로 반올림
        } else if (linearValue <= 99) {
            // 90-99%: 20억원 ~ 50억원 (5억 단위)
            const ratio = (linearValue - 90) / 9;
            rawValue = 2000000000 + ratio * 3000000000;
            return Math.round(rawValue / 500000000) * 500000000; // 5억 단위로 반올림
        } else {
            // 100%: 50억원 이상
            return 5000000001;
        }
    };

    const getLinearFromBudgetValue = (value: number): number => {
        if (value <= 10000000) {
            // 0원 ~ 1천만원
            return (value / 10000000) * 20;
        } else if (value <= 50000000) {
            // 1천만원 ~ 5천만원
            return 20 + ((value - 10000000) / 40000000) * 15;
        } else if (value <= 500000000) {
            // 5천만원 ~ 5억원
            return 35 + ((value - 50000000) / 450000000) * 25;
        } else if (value <= 1000000000) {
            // 5억원 ~ 10억원
            return 60 + ((value - 500000000) / 500000000) * 15;
        } else if (value <= 2000000000) {
            // 10억원 ~ 20억원
            return 75 + ((value - 1000000000) / 1000000000) * 15;
        } else if (value <= 5000000000) {
            // 20억원 ~ 50억원
            return 90 + ((value - 2000000000) / 3000000000) * 9;
        } else {
            // 50억원 이상
            return 100;
        }
    };

    const getMonthlyRentValueFromLinear = (linearValue: number): number => {
        let rawValue;
        // linearValue는 0-100 범위의 값
        if (linearValue <= 40) {
            // 0-40%: 0원 ~ 100만원 (5만원 단위)
            rawValue = (linearValue / 40) * 1000000;
            return Math.round(rawValue / 50000) * 50000; // 5만원 단위로 반올림
        } else if (linearValue <= 70) {
            // 40-70%: 100만원 ~ 300만원 (10만원 단위)
            const ratio = (linearValue - 40) / 30;
            rawValue = 1000000 + ratio * 2000000;
            return Math.round(rawValue / 100000) * 100000; // 10만원 단위로 반올림
        } else if (linearValue <= 85) {
            // 70-85%: 300만원 ~ 500만원 (10만원 단위)
            const ratio = (linearValue - 70) / 15;
            rawValue = 3000000 + ratio * 2000000;
            return Math.round(rawValue / 100000) * 100000; // 10만원 단위로 반올림
        } else {
            // 85-100%: 500만원 ~ 1000만원 (20만원 단위)
            const ratio = (linearValue - 85) / 15;
            rawValue = 5000000 + ratio * 5000000;
            return Math.round(rawValue / 200000) * 200000; // 20만원 단위로 반올림
        }
    };

    const getLinearFromMonthlyRentValue = (value: number): number => {
        if (value <= 1000000) {
            // 0원 ~ 100만원
            return (value / 1000000) * 40;
        } else if (value <= 3000000) {
            // 100만원 ~ 300만원
            return 40 + ((value - 1000000) / 2000000) * 30;
        } else if (value <= 5000000) {
            // 300만원 ~ 500만원
            return 70 + ((value - 3000000) / 2000000) * 15;
        } else {
            // 500만원 ~ 1000만원
            return 85 + ((value - 5000000) / 5000000) * 15;
        }
    };


    const formatBudgetAmount = (amount: number): string => {
        if (amount === 0) return '0원';
        if (amount >= 5000000001) return '50억원 이상';
        
        // 1억(100000000) 이상인 경우 억+만원 단위로 표시
        if (amount >= 100000000) {
            const eok = Math.floor(amount / 100000000); // 억 단위
            const remainder = amount % 100000000; // 억 단위를 뺀 나머지
            const man = Math.floor(remainder / 10000); // 만원 단위
            
            if (man === 0) {
                return `${eok}억원`;
            } else {
                return `${eok}억 ${man}만원`;
            }
        }
        
        // 1억 미만은 만원 단위로만 표시
        if (amount >= 10000) {
            const man = Math.floor(amount / 10000);
            return `${man}만원`;
        }
        
        return `${amount.toLocaleString()}원`;
    };

    const formatMonthlyRent = (amount: number): string => {
        if (amount === 0) return '0원';
        if (amount >= 10000000) return '1천만원 이상';
        if (amount >= 1000000) {
            return `${(amount / 10000).toFixed(0)}만원`;
        }
        if (amount >= 10000) {
            return `${(amount / 10000).toFixed(0)}만원`;
        }
        return `${amount.toLocaleString()}원`;
    };

    // Range 슬라이더 헬퍼 함수들
    const formatBudgetRange = (range: [number, number]): string => {
        const [min, max] = range;
        return `${formatBudgetAmount(min)} ~ ${formatBudgetAmount(max)}`;
    };

    const formatMonthlyRentRange = (range: [number, number]): string => {
        const [min, max] = range;
        return `${formatMonthlyRent(min)} ~ ${formatMonthlyRent(max)}`;
    };


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
                                            ? 'border-primary-500 bg-primary-100 text-primary-700'
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
                                            ? 'border-secondary-500 bg-secondary-100 text-secondary-700'
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                                자금 범위를 설정해주세요
                            </h3>
                            <p className="text-sm text-gray-600">
                                매매, 전세, 월세 목적에 맞는 정보를 제공해드립니다
                            </p>
                        </div>
                        
                        <div className="space-y-8">
                            {/* 전월세 보증금 또는 매매 자금 범위 슬라이더 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    전월세 보증금 또는 매매 자금
                                </label>
                                <RangeSlider
                                    min={0}
                                    max={5000000001}
                                    step={1000000}
                                    value={profile.budgetRange || [0, 1000000000]}
                                    onChange={(newValue) => setProfile(prev => ({ ...prev, budgetRange: newValue }))}
                                    valueToLinear={getLinearFromBudgetValue}
                                    linearToValue={getBudgetValueFromLinear}
                                    formatValue={formatBudgetAmount} // 억 단위 포맷팅 함수 추가
                                    showInputControls={true}
                                    inputUnit="만원"
                                    inputStep={100} // 100만원 단위로 조정
                                    valueToInputUnit={(value) => Math.round(value / 10000)} // 원 -> 만원
                                    inputUnitToValue={(inputValue) => inputValue * 10000} // 만원 -> 원
                                />
                            </div>

                            {/* 월세 슬라이더 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    월세
                                </label>
                                <RangeSlider
                                    min={0}
                                    max={10000000}
                                    step={10000}
                                    value={profile.monthlyRent || [0, 5000000]}
                                    onChange={(newValue) => setProfile(prev => ({ ...prev, monthlyRent: newValue }))}
                                    valueToLinear={getLinearFromMonthlyRentValue}
                                    linearToValue={getMonthlyRentValueFromLinear}
                                    showInputControls={true}
                                    inputUnit="만원"
                                    inputStep={10} // 10만원 단위로 조정
                                    valueToInputUnit={(value) => Math.round(value / 10000)} // 원 -> 만원
                                    inputUnitToValue={(inputValue) => inputValue * 10000} // 만원 -> 원
                                />
                            </div>
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
                                            ? 'border-primary-500 bg-primary-100 text-primary-700'
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
                                            ? 'border-secondary-500 bg-secondary-100 text-secondary-700'
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
            case 4: return true; // 자금 범위는 기본값 0으로 시작하므로 항상 완료
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
                            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
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
                                    ? 'bg-primary-500 text-white hover:bg-primary-600'
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
                                    ? 'bg-primary-500 text-white hover:bg-primary-600'
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