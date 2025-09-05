import { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
    updatedAt?: Date;
};

type UserProfileModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    
    // 사용자 입력 데이터
    const [profile, setProfile] = useState<Partial<UserProfile>>({
        purpose: [],
        commutingRadius: 30,
        priorities: []
    });

    // 기존 프로필 로드
    useEffect(() => {
        const loadProfile = async () => {
            if (!user || !isOpen) return;
            
            setIsLoadingProfile(true);
            try {
                const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'basic'));
                if (profileDoc.exists()) {
                    const data = profileDoc.data() as UserProfile;
                    setProfile(data);
                }
            } catch (error) {
                console.error("프로필 로드 오류:", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        loadProfile();
    }, [user, isOpen]);

    if (!isOpen || !user) return null;

    const handleSaveProfile = async () => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            const updatedProfile: UserProfile = {
                ...profile as UserProfile,
                updatedAt: new Date()
            };

            await setDoc(doc(db, 'users', user.uid, 'profile', 'basic'), updatedProfile);
            console.log("✅ 사용자 프로필 업데이트 완료");
            onClose();
        } catch (error) {
            console.error("❌ 프로필 저장 오류:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleArrayValue = (array: string[], value: string): string[] => {
        if (array.includes(value)) {
            return array.filter(item => item !== value);
        } else {
            return [...array, value];
        }
    };

    if (isLoadingProfile) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14e3dc] mx-auto mb-4"></div>
                        <p className="text-gray-600">프로필 정보를 불러오는 중...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">프로필 설정</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="px-6 py-6 max-h-[70vh] overflow-y-auto space-y-8">
                    {/* 거주 목적 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            거주 목적 (다중선택 가능)
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {['매매', '전세', '월세', '투자'].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setProfile(prev => ({
                                        ...prev,
                                        purpose: toggleArrayValue(prev.purpose || [], option)
                                    }))}
                                    className={`p-3 rounded-lg border-2 transition-colors ${
                                        profile.purpose?.includes(option)
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-semibold">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 가족 구성 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            가족 구성
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
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
                                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                                        profile.familyType === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-medium">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 통근 정보 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            통근 정보
                        </h3>
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

                    {/* 예상 자금 범위 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            예상 자금 범위
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
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
                                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                                        profile.budgetRange === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-sm font-medium">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 선호 건물 연식 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            선호 건물 연식
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
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
                                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                                        profile.preferredBuildingAge === option
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-sm font-medium">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 우선순위 */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            중요 고려사항 (다중선택 가능)
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
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
                                    className={`p-2 rounded-lg border-2 transition-colors text-sm ${
                                        profile.priorities?.includes(option)
                                            ? 'border-[#14e3dc] bg-[#14e3dc] bg-opacity-10 text-[#14e3dc]'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-medium">{option}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 버튼 */}
                <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        취소
                    </button>
                    
                    <button
                        onClick={handleSaveProfile}
                        disabled={isLoading}
                        className={`px-6 py-2 rounded-lg transition-colors ${
                            isLoading
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-[#14e3dc] text-white hover:bg-[#12d4cc]'
                        }`}
                    >
                        {isLoading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}