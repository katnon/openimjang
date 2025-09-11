// apps/bff/src/routes/memo.ts
import { Hono } from 'hono';

const memoRoute = new Hono();

/**
 * 사용자 메모 데이터 조회 API
 * GET /api/memo/user/:userId
 * 
 * Firebase Firestore에서 사용자의 모든 메모를 가져옵니다.
 * AI가 임장 분석 시 참고할 수 있는 사용자의 기존 메모들을 제공합니다.
 */
memoRoute.get('/user/:userId', async (c) => {
    try {
        const userId = c.req.param('userId');
        
        if (!userId) {
            return c.json({ 
                success: false, 
                error: 'User ID is required' 
            }, 400);
        }

        // TODO: Firebase Admin SDK를 사용하여 Firestore에서 메모 조회
        // 현재는 임시 응답을 반환
        
        const mockMemos = [
            {
                id: "memo1",
                aptId: "123",
                aptName: "래미안 강변파크",
                title: "1차 임장 후기",
                body: "주변 교통 편리, 한강뷰 좋음. 다만 소음이 조금 있음.",
                createdAt: "2024-01-15T10:30:00Z",
                location: { lat: 37.5665, lon: 126.978 }
            },
            {
                id: "memo2", 
                aptId: "456",
                aptName: "헬리오시티",
                title: "재방문 검토",
                body: "투자가치 높음. 학군도 좋고 향후 개발 예정지와 가까움.",
                createdAt: "2024-01-20T14:15:00Z",
                location: { lat: 37.5405, lon: 127.0707 }
            }
        ];

        return c.json({
            success: true,
            userId,
            memos: mockMemos,
            count: mockMemos.length
        });

    } catch (error) {
        console.error('❌ 메모 조회 오류:', error);
        return c.json({ 
            success: false, 
            error: 'Failed to fetch user memos' 
        }, 500);
    }
});

/**
 * 특정 아파트 관련 메모 조회 API  
 * GET /api/memo/apartment/:aptId?userId=
 * 
 * 특정 아파트와 관련된 사용자 메모를 조회합니다.
 */
memoRoute.get('/apartment/:aptId', async (c) => {
    try {
        const aptId = c.req.param('aptId');
        const userId = c.req.query('userId');
        
        if (!aptId || !userId) {
            return c.json({ 
                success: false, 
                error: 'Apartment ID and User ID are required' 
            }, 400);
        }

        // TODO: Firebase Admin SDK를 사용하여 특정 아파트 메모 조회
        
        const mockMemo = {
            id: "memo1",
            aptId,
            aptName: "래미안 강변파크",
            title: "1차 임장 후기", 
            body: "주변 교통 편리, 한강뷰 좋음. 다만 소음이 조금 있음.",
            createdAt: "2024-01-15T10:30:00Z",
            location: { lat: 37.5665, lon: 126.978 }
        };

        return c.json({
            success: true,
            aptId,
            userId,
            memo: mockMemo
        });

    } catch (error) {
        console.error('❌ 아파트 메모 조회 오류:', error);
        return c.json({ 
            success: false, 
            error: 'Failed to fetch apartment memo' 
        }, 500);
    }
});

export { memoRoute };