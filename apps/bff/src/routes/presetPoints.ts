import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from '../lib/db';

const app = new Hono();

// CORS 설정
app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:8787'],
    credentials: true,
}));

// 프리셋 포인트 생성
app.post('/create', async (c) => {
    try {
        const body = await c.req.json();
        const { lat, lon, dong, ho, exclu_use_ar, apt_nm, jibun_address, apt_id, floorplan_image_url } = body;

        console.log('프리셋 포인트 생성 요청:', { 
            lat, lon, dong, ho, exclu_use_ar, apt_nm, apt_id, 
            hasFloorplan: !!floorplan_image_url 
        });

        // 필수 필드 검증
        if (!lat || !lon) {
            return c.json({ 
                success: false, 
                error: '위도와 경도는 필수입니다' 
            }, 400);
        }

        const result = await db
            .insertInto('oi.preset_points')
            .values({
                lat: Number(lat),
                lon: Number(lon),
                dong: dong || null,
                ho: ho || null,
                exclu_use_ar: exclu_use_ar ? Number(exclu_use_ar) : null,
                apt_nm: apt_nm || null,
                jibun_address: jibun_address || null,
                apt_id: apt_id ? Number(apt_id) : null,
                floorplan_image_url: floorplan_image_url || null,
                created_by: 'developer',
                created_at: new Date(),
                updated_at: new Date()
            })
            .returning([
                'id', 
                'lat', 
                'lon', 
                'apt_nm', 
                'dong', 
                'ho', 
                'exclu_use_ar',
                'jibun_address',
                'apt_id',
                'floorplan_image_url',
                'created_at'
            ])
            .executeTakeFirst();

        console.log('프리셋 포인트 생성 성공:', result);

        return c.json({ 
            success: true, 
            data: result 
        });

    } catch (error) {
        console.error('프리셋 포인트 생성 실패:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
        }, 500);
    }
});

// 모든 프리셋 포인트 조회
app.get('/list', async (c) => {
    try {
        console.log('프리셋 포인트 목록 조회 요청');

        const points = await db
            .selectFrom('oi.preset_points')
            .selectAll()
            .orderBy('created_at', 'desc')
            .execute();

        console.log(`프리셋 포인트 ${points.length}개 조회 완료`);

        return c.json({ 
            success: true, 
            data: points 
        });

    } catch (error) {
        console.error('프리셋 포인트 조회 실패:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
        }, 500);
    }
});

// 특정 아파트의 프리셋 포인트 조회
app.get('/by-apartment/:aptId', async (c) => {
    try {
        const aptId = c.req.param('aptId');
        
        console.log('아파트별 프리셋 포인트 조회 요청:', aptId);

        if (!aptId || isNaN(Number(aptId))) {
            return c.json({ 
                success: false, 
                error: '유효하지 않은 아파트 ID입니다' 
            }, 400);
        }

        const points = await db
            .selectFrom('oi.preset_points')
            .selectAll()
            .where('apt_id', '=', Number(aptId))
            .orderBy('created_at', 'desc')
            .execute();

        console.log(`아파트 ID ${aptId}의 프리셋 포인트 ${points.length}개 조회 완료`);

        return c.json({ 
            success: true, 
            data: points 
        });

    } catch (error) {
        console.error('아파트별 프리셋 포인트 조회 실패:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
        }, 500);
    }
});

// 특정 프리셋 포인트 삭제 (개발용)
app.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        
        console.log('프리셋 포인트 삭제 요청:', id);

        const result = await db
            .deleteFrom('oi.preset_points')
            .where('id', '=', Number(id))
            .returning(['id', 'apt_nm'])
            .executeTakeFirst();

        if (!result) {
            return c.json({ 
                success: false, 
                error: '포인트를 찾을 수 없습니다' 
            }, 404);
        }

        console.log('프리셋 포인트 삭제 완료:', result);

        return c.json({ 
            success: true, 
            data: result 
        });

    } catch (error) {
        console.error('프리셋 포인트 삭제 실패:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
        }, 500);
    }
});

export default app;