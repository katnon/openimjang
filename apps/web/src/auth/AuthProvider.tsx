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
import axios, { type InternalAxiosRequestConfig } from "axios";
import { auth } from "../firebase"; // firebase.ts에서 auth 객체를 가져옵니다.

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

// Context를 생성합니다.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // ① Firebase 로그인 상태 변화를 감지합니다.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ② Axios 요청에 Firebase ID 토큰을 자동으로 붙입니다.
    useEffect(() => {
        const interceptor = axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
            const current = auth.currentUser;
            if (current) {
                const token = await current.getIdToken();
                // headers.set 메서드를 사용하여 안전하게 설정
                config.headers.set('Authorization', `Bearer ${token}`);
            }
            return config;
        });
        return () => {
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
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
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
