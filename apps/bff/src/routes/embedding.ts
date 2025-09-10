// apps/bff/src/routes/embedding.ts - 임베딩 관리 API
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { embeddingService } from '../services/embeddingService';

const embeddingRoute = new Hono();

// POST /index-memo - 사용자 메모 인덱싱
embeddingRoute.post('/index-memo', authMiddleware, async (c) => {
    try {
        const memoData = await c.req.json();
        
        console.log('📝 메모 인덱싱 요청:', { 
            memoId: memoData.id,
            userId: memoData.userId,
            title: memoData.title?.slice(0, 30) + '...'
        });

        // 필수 필드 검증
        if (!memoData.id || !memoData.userId || !memoData.title || !memoData.content) {
            return c.json({
                success: false,
                error: '필수 필드가 누락되었습니다: id, userId, title, content'
            }, 400);
        }

        // 날짜 필드 변환
        const processedMemoData = {
            ...memoData,
            createdAt: memoData.createdAt ? new Date(memoData.createdAt) : new Date(),
            updatedAt: memoData.updatedAt ? new Date(memoData.updatedAt) : new Date(),
        };

        await embeddingService.indexUserMemo(processedMemoData);

        return c.json({
            success: true,
            message: '메모가 성공적으로 인덱싱되었습니다.',
            memoId: memoData.id
        });

    } catch (error: any) {
        console.error('❌ 메모 인덱싱 오류:', error);
        return c.json({
            success: false,
            error: error.message || '메모 인덱싱 중 오류가 발생했습니다.'
        }, 500);
    }
});

// PUT /reindex-memo - 사용자 메모 재인덱싱
embeddingRoute.put('/reindex-memo', authMiddleware, async (c) => {
    try {
        const memoData = await c.req.json();
        
        console.log('🔄 메모 재인덱싱 요청:', { 
            memoId: memoData.id,
            userId: memoData.userId 
        });

        if (!memoData.id || !memoData.userId || !memoData.title || !memoData.content) {
            return c.json({
                success: false,
                error: '필수 필드가 누락되었습니다: id, userId, title, content'
            }, 400);
        }

        const processedMemoData = {
            ...memoData,
            createdAt: memoData.createdAt ? new Date(memoData.createdAt) : new Date(),
            updatedAt: memoData.updatedAt ? new Date(memoData.updatedAt) : new Date(),
        };

        await embeddingService.reindexUserMemo(processedMemoData);

        return c.json({
            success: true,
            message: '메모가 성공적으로 재인덱싱되었습니다.',
            memoId: memoData.id
        });

    } catch (error: any) {
        console.error('❌ 메모 재인덱싱 오류:', error);
        return c.json({
            success: false,
            error: error.message || '메모 재인덱싱 중 오류가 발생했습니다.'
        }, 500);
    }
});

// DELETE /delete-memo/:memoId - 메모 인덱스 삭제
embeddingRoute.delete('/delete-memo/:memoId', authMiddleware, async (c) => {
    try {
        const memoId = c.req.param('memoId');
        const userId = c.get('userId'); // authMiddleware에서 설정된 userId
        
        console.log('🗑️ 메모 인덱스 삭제 요청:', { memoId, userId });

        if (!memoId || !userId) {
            return c.json({
                success: false,
                error: '메모 ID와 사용자 ID가 필요합니다.'
            }, 400);
        }

        await embeddingService.deleteUserMemo(userId, memoId);

        return c.json({
            success: true,
            message: '메모 인덱스가 성공적으로 삭제되었습니다.',
            memoId
        });

    } catch (error: any) {
        console.error('❌ 메모 인덱스 삭제 오류:', error);
        return c.json({
            success: false,
            error: error.message || '메모 인덱스 삭제 중 오류가 발생했습니다.'
        }, 500);
    }
});

// DELETE /delete-all-user-memos - 사용자 모든 메모 인덱스 삭제
embeddingRoute.delete('/delete-all-user-memos', authMiddleware, async (c) => {
    try {
        const userId = c.get('userId');
        
        console.log('🗑️ 사용자 전체 메모 인덱스 삭제 요청:', { userId });

        if (!userId) {
            return c.json({
                success: false,
                error: '사용자 ID가 필요합니다.'
            }, 400);
        }

        await embeddingService.deleteAllUserMemos(userId);

        return c.json({
            success: true,
            message: '사용자의 모든 메모 인덱스가 삭제되었습니다.',
            userId
        });

    } catch (error: any) {
        console.error('❌ 사용자 메모 전체 삭제 오류:', error);
        return c.json({
            success: false,
            error: error.message || '메모 전체 삭제 중 오류가 발생했습니다.'
        }, 500);
    }
});

// POST /batch-index-memos - 대량 메모 인덱싱 (초기 마이그레이션용)
embeddingRoute.post('/batch-index-memos', authMiddleware, async (c) => {
    try {
        const { memos } = await c.req.json();
        
        console.log('📦 대량 메모 인덱싱 요청:', { count: memos?.length });

        if (!Array.isArray(memos)) {
            return c.json({
                success: false,
                error: 'memos 배열이 필요합니다.'
            }, 400);
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const memoData of memos) {
            try {
                const processedMemoData = {
                    ...memoData,
                    createdAt: memoData.createdAt ? new Date(memoData.createdAt) : new Date(),
                    updatedAt: memoData.updatedAt ? new Date(memoData.updatedAt) : new Date(),
                };

                await embeddingService.indexUserMemo(processedMemoData);
                results.success++;
                
            } catch (error: any) {
                results.failed++;
                results.errors.push(`${memoData.id}: ${error.message}`);
                console.error(`❌ 메모 ${memoData.id} 인덱싱 실패:`, error);
            }
        }

        return c.json({
            success: true,
            message: `대량 인덱싱 완료: ${results.success}개 성공, ${results.failed}개 실패`,
            results
        });

    } catch (error: any) {
        console.error('❌ 대량 메모 인덱싱 오류:', error);
        return c.json({
            success: false,
            error: error.message || '대량 메모 인덱싱 중 오류가 발생했습니다.'
        }, 500);
    }
});

// POST /index-domain-knowledge - 도메인 지식 인덱싱 (관리자 전용)
embeddingRoute.post('/index-domain-knowledge', async (c) => {
    try {
        // TODO: 관리자 권한 확인 미들웨어 추가 필요
        const knowledgeData = await c.req.json();
        
        console.log('📚 도메인 지식 인덱싱 요청:', knowledgeData.title);

        if (!knowledgeData.id || !knowledgeData.title || !knowledgeData.content) {
            return c.json({
                success: false,
                error: '필수 필드가 누락되었습니다: id, title, content'
            }, 400);
        }

        const processedKnowledgeData = {
            ...knowledgeData,
            createdAt: knowledgeData.createdAt ? new Date(knowledgeData.createdAt) : new Date(),
        };

        await embeddingService.indexDomainKnowledge(processedKnowledgeData);

        return c.json({
            success: true,
            message: '도메인 지식이 성공적으로 인덱싱되었습니다.',
            knowledgeId: knowledgeData.id
        });

    } catch (error: any) {
        console.error('❌ 도메인 지식 인덱싱 오류:', error);
        return c.json({
            success: false,
            error: error.message || '도메인 지식 인덱싱 중 오류가 발생했습니다.'
        }, 500);
    }
});

export default embeddingRoute;