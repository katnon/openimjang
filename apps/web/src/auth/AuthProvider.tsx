import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    signInWithPopup,
    GoogleAuthProvider
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { auth, db } from "../firebase"; // firebase.ts에서 auth 객체를 가져옵니다.

interface AuthContextType {
    user: User | null;
    loading: boolean;
    needsOnboarding: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    markOnboardingComplete: () => void;
}

// Context를 생성합니다.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    // 온보딩 상태 확인
    const checkOnboardingStatus = async (currentUser: User) => {
        try {
            const profileDoc = await getDoc(doc(db, 'users', currentUser.uid, 'profile', 'basic'));
            
            if (profileDoc.exists()) {
                const profileData = profileDoc.data();
                // completedAt 필드가 있으면 온보딩 완료로 판단
                const hasCompletedOnboarding = profileData && profileData.completedAt;
                setNeedsOnboarding(!hasCompletedOnboarding);
                
                console.log(`✅ 온보딩 상태 확인: ${hasCompletedOnboarding ? '완료됨' : '필요함'}`);
            } else {
                console.log("📝 프로필 문서가 존재하지 않음 - 온보딩 필요");
                setNeedsOnboarding(true);
            }
        } catch (error: any) {
            console.error("❌ 온보딩 상태 확인 오류:", error);
            
            // Firebase 권한 오류인 경우 특별 처리
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                console.log("🔒 Firebase 권한 오류 - 온보딩을 기본값으로 설정");
                setNeedsOnboarding(true); // 권한 오류 시 온보딩 모달 표시
            } else {
                console.log("⚠️ 기타 오류 - 온보딩 건너뛰기");
                setNeedsOnboarding(false); // 기타 오류 시 온보딩 건너뛰기
            }
        }
    };

    // ① Firebase 로그인 상태 변화를 감지합니다.
    useEffect(() => {
        console.log('🔥 AuthProvider useEffect 시작 - Firebase 인증 상태 리스너 등록');
        
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log('🔥 Firebase onAuthStateChanged 호출됨:', {
                currentUser: currentUser ? {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName
                } : null
            });
            
            setUser(currentUser);
            
            if (currentUser) {
                console.log('✅ 사용자 로그인 상태 확인됨, 온보딩 체크 시작');
                await checkOnboardingStatus(currentUser);
            } else {
                console.log('❌ 사용자가 로그아웃 상태');
                setNeedsOnboarding(false);
            }
            
            setLoading(false);
            console.log('🔥 AuthProvider 상태 업데이트 완료:', { hasUser: !!currentUser, loading: false });
        });
        
        return () => {
            console.log('🔥 AuthProvider cleanup - 인증 리스너 해제');
            unsubscribe();
        };
    }, []);

    const markOnboardingComplete = () => {
        console.log("🎯 온보딩 완료 처리 - needsOnboarding을 false로 설정");
        setNeedsOnboarding(false);
    };

    // ② Axios 요청에 Firebase ID 토큰을 자동으로 붙입니다.
    useEffect(() => {
        console.log('🔥 Axios 인터셉터 등록');
        
        const interceptor = axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
            const current = auth.currentUser;
            console.log('🔥 Axios 요청 인터셉터 실행:', { 
                url: config.url, 
                hasCurrentUser: !!current,
                currentUser: current ? { uid: current.uid, email: current.email } : null
            });
            
            if (current) {
                try {
                    const token = await current.getIdToken();
                    console.log('✅ Firebase 토큰 획득 성공:', token.substring(0, 50) + '...');
                    // headers.set 메서드를 사용하여 안전하게 설정
                    config.headers.set('Authorization', `Bearer ${token}`);
                } catch (error) {
                    console.error('❌ Firebase 토큰 획득 실패:', error);
                }
            } else {
                console.log('⚠️ auth.currentUser가 null이므로 토큰을 설정하지 않음');
            }
            return config;
        });
        
        return () => {
            console.log('🔥 Axios 인터셉터 해제');
            axios.interceptors.request.eject(interceptor);
        };
    }, []);

    // ③ 인증 함수들
    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string) => {
        await createUserWithEmailAndPassword(auth, email, password);
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        // 추가 스코프 요청 (선택사항)
        provider.addScope('email');
        provider.addScope('profile');

        // Cross-Origin-Opener-Policy 오류를 방지하기 위한 설정
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            // 팝업 블록이나 CORS 오류가 발생할 경우 리다이렉트 방식으로 대체
            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/cancelled-popup-request' ||
                error.message?.includes('Cross-Origin-Opener-Policy')) {
                console.log('팝업 로그인 실패, 리다이렉트 방식 시도');
                // 리다이렉트 방식은 개발 환경에서는 권장하지 않으므로 에러 재throw
                throw new Error('팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.');
            }
            throw error;
        }
    };

    const signOut = async () => {
        console.log('🔄 AuthProvider signOut 호출됨');
        try {
            await firebaseSignOut(auth);
            console.log('✅ Firebase signOut 성공');
        } catch (error) {
            console.error('❌ Firebase signOut 오류:', error);
            throw error;
        }
    };

    // ④ Context에 공급할 값 준비
    const value: AuthContextType = {
        user,
        loading,
        needsOnboarding,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        markOnboardingComplete,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 편하게 사용하기 위한 커스텀 훅
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다");
    }
    return context;
};
