import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const app = new Hono();

// CORS 설정
app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:8787'],
    credentials: true,
}));

// 평면도 업로드 엔드포인트
app.post('/floorplan', async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['floorplan'] as File;

        if (!file) {
            return c.json({
                success: false,
                error: '업로드할 파일이 없습니다.'
            }, 400);
        }

        // 파일 크기 검증 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            return c.json({
                success: false,
                error: '파일 크기는 5MB 이하로 업로드해주세요.'
            }, 400);
        }

        // 파일 타입 검증
        if (!file.type.startsWith('image/')) {
            return c.json({
                success: false,
                error: '이미지 파일만 업로드 가능합니다.'
            }, 400);
        }

        // 업로드 디렉토리 확인/생성
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'floorplans');
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // 파일명 생성 (타임스탬프 + 원본 확장자)
        const timestamp = Date.now();
        const originalExtension = path.extname(file.name);
        const fileName = `floorplan_${timestamp}${originalExtension}`;
        const filePath = path.join(uploadDir, fileName);

        // 파일 저장
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(filePath, buffer);

        // 접근 가능한 URL 생성
        const fileUrl = `/uploads/floorplans/${fileName}`;

        console.log('평면도 파일 업로드 성공:', {
            originalName: file.name,
            fileName,
            size: file.size,
            url: fileUrl
        });

        return c.json({
            success: true,
            url: fileUrl,
            fileName,
            originalName: file.name,
            size: file.size
        });

    } catch (error) {
        console.error('평면도 업로드 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

export default app;