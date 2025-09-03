import { Hono } from 'hono';
import { cors } from 'hono/cors';

const poi = new Hono();

// CORS 설정
poi.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// POI 검색 엔드포인트
poi.get('/search', async (c) => {
    try {
        const apiKey = process.env.KAKAO_REST_KEY;
        if (!apiKey) {
            return c.json({ error: 'Kakao REST key not configured' }, 500);
        }

        // 쿼리 파라미터 추출
        const query = c.req.query('query') || '';
        const categoryGroupCode = c.req.query('category_group_code') || '';
        const x = parseFloat(c.req.query('x') || '0'); // longitude
        const y = parseFloat(c.req.query('y') || '0'); // latitude  
        const radius = parseInt(c.req.query('radius') || '1000'); // 기본 1km
        const page = parseInt(c.req.query('page') || '1');
        const size = parseInt(c.req.query('size') || '15');

        if (!x || !y) {
            return c.json({ error: 'x(longitude) and y(latitude) parameters are required' }, 400);
        }

        console.log('📍 POI 검색 요청:', {
            query,
            categoryGroupCode,
            x, y,
            radius,
            page, size
        });

        // 카카오 Places API URL 구성
        let url = `https://dapi.kakao.com/v2/local/search/category.json?`;
        
        const params = new URLSearchParams({
            x: x.toString(),
            y: y.toString(),
            radius: radius.toString(),
            page: page.toString(),
            size: size.toString(),
            sort: 'distance' // 거리순 정렬
        });

        // 카테고리 그룹 코드 또는 키워드 검색
        if (categoryGroupCode) {
            params.append('category_group_code', categoryGroupCode);
        } 
        
        if (query) {
            // 키워드 검색의 경우 다른 엔드포인트 사용
            url = `https://dapi.kakao.com/v2/local/search/keyword.json?`;
            params.append('query', query);
        }

        url += params.toString();

        console.log('🔍 카카오 API 요청:', url.replace(apiKey, 'HIDDEN'));

        const response = await fetch(url, {
            headers: {
                'Authorization': `KakaoAK ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 카카오 API 오류:', errorText);
            throw new Error(`Kakao API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ POI 검색 완료: ${data.documents?.length || 0}개 결과`);

        return c.json(data);

    } catch (error) {
        console.error('❌ POI 검색 실패:', error);
        return c.json({
            error: 'Failed to search POI',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// 여러 카테고리 동시 검색 (배치)
poi.post('/search/batch', async (c) => {
    try {
        const apiKey = process.env.KAKAO_REST_KEY;
        if (!apiKey) {
            return c.json({ error: 'Kakao REST key not configured' }, 500);
        }

        const body = await c.req.json();
        const { categories, x, y, radius = 1000, size = 15 } = body;

        if (!categories || !Array.isArray(categories) || !x || !y) {
            return c.json({ 
                error: 'categories (array), x (longitude), and y (latitude) are required' 
            }, 400);
        }

        console.log('📍 POI 배치 검색 요청:', { categories, x, y, radius, size });

        // 모든 카테고리에 대해 병렬 요청
        const searchPromises = categories.map(async (category: { code?: string; query?: string }) => {
            let url = `https://dapi.kakao.com/v2/local/search/`;
            const params = new URLSearchParams({
                x: x.toString(),
                y: y.toString(), 
                radius: radius.toString(),
                page: '1',
                size: size.toString(),
                sort: 'distance'
            });

            if (category.code) {
                // 카테고리 코드 검색
                url += `category.json?`;
                params.append('category_group_code', category.code);
            } else if (category.query) {
                // 키워드 검색
                url += `keyword.json?`;
                params.append('query', category.query);
            } else {
                return { category, error: 'No code or query provided' };
            }

            url += params.toString();

            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `KakaoAK ${apiKey}`,
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.json();
                return {
                    category,
                    data
                };
            } catch (error) {
                return {
                    category,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });

        const results = await Promise.all(searchPromises);
        
        const totalResults = results.reduce((sum, result) => 
            sum + (result.data?.documents?.length || 0), 0
        );

        console.log(`✅ POI 배치 검색 완료: ${totalResults}개 결과`);

        return c.json({
            success: true,
            results,
            totalCount: totalResults
        });

    } catch (error) {
        console.error('❌ POI 배치 검색 실패:', error);
        return c.json({
            error: 'Failed to search POI batch',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

export default poi;