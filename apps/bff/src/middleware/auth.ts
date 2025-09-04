// apps/bff/src/middleware/auth.ts
import { Context, Next } from 'hono';
import admin from 'firebase-admin';

// Firebase Admin 초기화 (한 번만 실행)
if (!admin.apps || admin.apps.length === 0) {
    try {
        // 환경변수로부터 Firebase 설정 읽기
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const projectId = process.env.FIREBASE_PROJECT_ID;

        if (serviceAccountPath) {
            // 서비스 계정 키 파일 사용
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: projectId,
            });
        } else {
            // 환경변수로 직접 설정 (개발용)
            admin.initializeApp({
                projectId: projectId,
            });
        }
        
        console.log('✅ Firebase Admin 초기화 완료');
    } catch (error) {
        console.error('❌ Firebase Admin 초기화 오류:', error);
    }
}

// 사용자 정보를 Context에 추가하기 위한 타입 확장
declare module 'hono' {
    interface Context {
        user?: {
            uid: string;
            email?: string;
            displayName?: string;
        };
    }
}

// Firebase 토큰 검증 미들웨어
export const authMiddleware = async (c: Context, next: Next) => {
    try {
        const authorization = c.req.header('Authorization');
        
        if (!authorization) {
            return c.json({ error: '인증 토큰이 필요합니다.' }, 401);
        }

        const token = authorization.replace('Bearer ', '');
        
        if (!token) {
            return c.json({ error: '유효하지 않은 토큰 형식입니다.' }, 401);
        }

        // Firebase 토큰 검증
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Context에 사용자 정보 저장
        c.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: decodedToken.name,
        };

        console.log('✅ 토큰 검증 성공:', decodedToken.uid);
        
        await next();
    } catch (error: any) {
        console.error('❌ 토큰 검증 실패:', error.message);
        
        if (error.code === 'auth/id-token-expired') {
            return c.json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' }, 401);
        } else if (error.code === 'auth/id-token-revoked') {
            return c.json({ error: '토큰이 취소되었습니다. 다시 로그인해주세요.' }, 401);
        } else {
            return c.json({ error: '토큰 검증에 실패했습니다.' }, 401);
        }
    }
};