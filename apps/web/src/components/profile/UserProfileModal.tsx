import { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

type UserProfile = {
    purpose: string[]; // 매매/전세/월세/투자 (다중선택 가능)
    workLocation?: string; // 직장 또는 원하는 지하철역
    commutingRadius: number; // 통근 반경 (분)
    budgetRange: [number, number]; // 예상 자금 범위
    monthlyRent: [number, number]; // 월세 범위
    preferredBuildingAge: string; // 선호 건물 연식
    familyType: string; // 가족 구성
    priorities: string[]; // 우선순위 (다중선택)
    completedAt: Date;
    updatedAt?: Date;
};

type UserProfileModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpenOnboarding: () => void; // 온보딩 모달 열기 함수
};

export default function UserProfileModal({ isOpen, onClose, onOpenOnboarding }: UserProfileModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    
    console.log('🔄 UserProfileModal 렌더링:', { isOpen, hasUser: !!user });
    
    // 사용자 프로필 데이터 (읽기 전용)
    const [profile, setProfile] = useState<UserProfile | null>(null);

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
                } else {
                    setProfile(null);
                }
            } catch (error) {
                console.error("프로필 로드 오류:", error);
                setProfile(null);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        loadProfile();
    }, [user, isOpen]);

    if (!isOpen || !user) {
        console.log('🚫 UserProfileModal 조건 미충족:', { isOpen, hasUser: !!user });
        return null;
    }

    // 금액 포맷팅 함수들
    const formatBudgetAmount = (amount: number): string => {
        if (amount === 0) return '0원';
        if (amount >= 5000000001) return '50억원 이상';
        
        if (amount >= 100000000) {
            const eok = Math.floor(amount / 100000000);
            const remainder = amount % 100000000;
            const man = Math.floor(remainder / 10000);
            
            if (man === 0) {
                return `${eok}억원`;
            } else {
                return `${eok}억 ${man}만원`;
            }
        }
        
        if (amount >= 10000) {
            const man = Math.floor(amount / 10000);
            return `${man}만원`;
        }
        
        return `${amount.toLocaleString()}원`;
    };

    const formatBudgetRange = (range: [number, number]): string => {
        const [min, max] = range;
        return `${formatBudgetAmount(min)} ~ ${formatBudgetAmount(max)}`;
    };

    const formatMonthlyRent = (range: [number, number]): string => {
        const [min, max] = range;
        const formatSingle = (amount: number): string => {
            if (amount === 0) return '0원';
            if (amount >= 10000000) return '1천만원 이상';
            if (amount >= 10000) {
                return `${(amount / 10000).toFixed(0)}만원`;
            }
            return `${amount.toLocaleString()}원`;
        };
        return `${formatSingle(min)} ~ ${formatSingle(max)}`;
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
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">내 프로필</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="px-6 py-6 max-h-[70vh] overflow-y-auto space-y-6">
                    {profile ? (
                        <>
                            {/* 거주 목적 */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-600 mb-2">거주 목적</h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.purpose?.map(purpose => (
                                        <span key={purpose} className="px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full">
                                            {purpose}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 가족 구성 */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-600 mb-2">가족 구성</h3>
                                <p className="text-gray-800">{profile.familyType}</p>
                            </div>

                            {/* 통근 정보 */}
                            {(profile.workLocation || profile.commutingRadius) && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">통근 정보</h3>
                                    <div className="space-y-1">
                                        {profile.workLocation && (
                                            <p className="text-gray-800">📍 {profile.workLocation}</p>
                                        )}
                                        <p className="text-gray-800">🕐 {profile.commutingRadius}분 이내</p>
                                    </div>
                                </div>
                            )}

                            {/* 자금 범위 */}
                            {profile.budgetRange && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">매매/전세 자금 범위</h3>
                                    <p className="text-gray-800">💰 {formatBudgetRange(profile.budgetRange)}</p>
                                </div>
                            )}

                            {/* 월세 범위 */}
                            {profile.monthlyRent && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">월세 범위</h3>
                                    <p className="text-gray-800">🏠 {formatMonthlyRent(profile.monthlyRent)}</p>
                                </div>
                            )}

                            {/* 선호 건물 연식 */}
                            {profile.preferredBuildingAge && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">선호 건물 연식</h3>
                                    <p className="text-gray-800">🏗️ {profile.preferredBuildingAge}</p>
                                </div>
                            )}

                            {/* 우선순위 */}
                            {profile.priorities && profile.priorities.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-2">중요 고려사항</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.priorities.map(priority => (
                                            <span key={priority} className="px-3 py-1 bg-secondary-100 text-secondary-700 text-sm rounded-full">
                                                {priority}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 설정 완료일 */}
                            {profile.completedAt && (
                                <div className="pt-4 border-t border-gray-100">
                                    <p className="text-xs text-gray-500">
                                        설정 완료: {new Date(profile.completedAt).toLocaleDateString('ko-KR')}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-gray-500 mb-4">
                                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <p className="text-lg">프로필이 설정되지 않았습니다</p>
                                <p className="text-sm mt-1">아래 버튼을 클릭하여 맞춤 정보를 설정해보세요</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 버튼 */}
                <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        닫기
                    </button>
                    
                    <button
                        onClick={() => {
                            onClose();
                            onOpenOnboarding();
                        }}
                        className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        {profile ? '다시 설정하기' : '프로필 설정하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}