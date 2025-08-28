import { Hono } from 'hono';
import { cors } from 'hono/cors';

const vworld = new Hono();

// CORS 설정
vworld.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ✅ 환경변수 디버깅 엔드포인트
vworld.get('/debug', async (c) => {
    return c.json({
        hasVWorldKey: !!process.env.VWORLD_KEY,
        vworldDomain: process.env.VWORLD_DOMAIN,
        keyLength: process.env.VWORLD_KEY?.length || 0,
        allEnvKeys: Object.keys(process.env).filter(key => key.includes('WORLD'))
    });
});

// VWorld WMS GetCapabilities 프록시
vworld.get('/capabilities', async (c) => {
    try {
        const apiKey = process.env.VWORLD_KEY;
        const domain = process.env.VWORLD_DOMAIN || 'localhost';

        console.log('🔐 Environment check:', {
            hasKey: !!apiKey,
            keyPrefix: apiKey?.substring(0, 8) + '...',
            domain,
            allEnvs: Object.keys(process.env).filter(k => k.includes('WORLD'))
        });

        if (!apiKey) {
            return c.json({
                error: 'VWorld API key not configured',
                envCheck: {
                    hasVWorldKey: !!process.env.VWORLD_KEY,
                    availableEnvs: Object.keys(process.env).filter(k => k.includes('WORLD'))
                }
            }, 500);
        }

        const url = `https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetCapabilities&KEY=${apiKey}&DOMAIN=${domain}`;

        console.log('🔍 VWorld GetCapabilities 요청:', url.replace(apiKey, 'HIDDEN'));

        const response = await fetch(url);

        console.log('📊 VWorld 응답:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ VWorld 오류 응답:', errorText);
            throw new Error(`VWorld API Error: ${response.status} ${response.statusText}\n${errorText}`);
        }

        const xmlText = await response.text();

        // ✅ 간단한 정규식으로 레이어 이름 추출
        const layerMatches = xmlText.match(/<Name>([^<]+)<\/Name>/g) || [];
        const layers: Array<{ name: string }> = [];

        layerMatches.forEach(match => {
            const nameMatch = match.match(/<Name>([^<]+)<\/Name>/);
            if (nameMatch && nameMatch[1]) {
                const name = nameMatch[1].trim();
                // 실제 레이어만 필터링 (서비스명 제외)
                if (name !== 'VWorldServer' && !name.includes('WMS') && name.length > 3) {
                    layers.push({ name });
                }
            }
        });

        console.log(`✅ 추출된 레이어 수: ${layers.length}`);

        return c.json({
            success: true,
            layers,
            total: layers.length,
            rawXmlLength: xmlText.length,
            sampleLayers: layers.slice(0, 10)
        });

    } catch (error) {
        console.error('❌ VWorld GetCapabilities 실패:', error);
        return c.json({
            error: 'Failed to fetch VWorld capabilities',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// ✅ 이미지 응답 분석 및 유효성 검사 강화
vworld.get('/map', async (c) => {
    try {
        const apiKey = process.env.VWORLD_KEY;
        const domain = process.env.VWORLD_DOMAIN || 'localhost';

        if (!apiKey) {
            return c.json({ error: 'VWorld API key not configured' }, 500);
        }

        const layers = c.req.query('layers') || 'lp_pa_cbnd_bonbun,lp_pa_cbnd_bubun';
        const styles = c.req.query('styles') || 'lp_pa_cbnd_bonbun_line,lp_pa_cbnd_bubun_line';
        const bbox = c.req.query('bbox');
        const width = c.req.query('width') || '256';
        const height = c.req.query('height') || '256';
        const crs = c.req.query('crs') || 'EPSG:4326';
        const format = c.req.query('format') || 'image/png';
        const transparent = c.req.query('transparent') || 'true';

        if (!bbox) {
            return c.json({ error: 'bbox parameter is required' }, 400);
        }

        console.log('📋 원본 요청 파라미터:', { layers, styles, bbox, width, height });

        // ✅ BBOX 검증 및 서울 영역 체크
        const coords = bbox.split(',').map(Number);
        if (coords.length !== 4) {
            return c.json({ error: 'Invalid bbox format' }, 400);
        }

        const [xmin, ymin, xmax, ymax] = coords;
        console.log('🗺️ BBOX 좌표 분석:', { xmin, ymin, xmax, ymax });

        // 서울 영역 대략적 범위 체크 (경도: 126.7~127.3, 위도: 37.4~37.7)
        if (xmin < 126 || xmax > 128 || ymin < 37 || ymax > 38) {
            console.warn('⚠️ BBOX가 서울 영역을 벗어남:', { xmin, ymin, xmax, ymax });
        }

        // EPSG:4326의 경우 BBOX 순서를 ymin,xmin,ymax,xmax로 변환
        let finalBbox = bbox;
        if (crs === 'EPSG:4326') {
            finalBbox = `${ymin},${xmin},${ymax},${xmax}`;
            console.log(`🔄 BBOX 좌표 변환: [${bbox}] → [${finalBbox}]`);
        }

        const url = `https://api.vworld.kr/req/wms?` +
            `SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&` +
            `LAYERS=${layers}&STYLES=${styles}&` +
            `CRS=${crs}&BBOX=${finalBbox}&` +
            `WIDTH=${width}&HEIGHT=${height}&` +
            `FORMAT=${format}&TRANSPARENT=${transparent}&` +
            `KEY=${apiKey}&DOMAIN=${domain}`;

        console.log('🌐 VWorld 요청:', {
            url: url.replace(apiKey, 'HIDDEN_KEY')
        });

        const response = await fetch(url);
        const contentType = response.headers.get('Content-Type');
        const contentLength = response.headers.get('Content-Length');

        console.log('📊 VWorld 응답:', {
            status: response.status,
            contentType,
            contentLength: contentLength + ' bytes'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ VWorld 오류:', errorText);
            return c.json({ error: errorText }, {
                status: response.status as any
            });
        }

        const imageBuffer = await response.arrayBuffer();
        const imageSize = imageBuffer.byteLength;

        // ✅ 1x1 투명 이미지 검사 (보통 43~100 바이트 정도)
        if (imageSize < 200) {
            console.warn('⚠️ 의심스러운 이미지 크기:', {
                size: imageSize,
                likely: '1x1 투명 이미지 또는 빈 응답',
                layers,
                bbox: finalBbox
            });

            // 이미지 데이터 분석을 위해 base64로 변환
            const base64 = Buffer.from(imageBuffer).toString('base64');
            console.log('🔍 이미지 데이터 (Base64 일부):', base64.substring(0, 100));
        }

        console.log(`✅ GetMap 완료:`, { layers, size: imageSize + ' bytes', bbox: finalBbox, success: imageSize >= 200 });

        return new Response(imageBuffer, {
            headers: {
                'Content-Type': contentType || 'image/png',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',
                'X-Image-Size': imageSize.toString(),
                'X-Layer-Name': layers,
                'X-Bbox': finalBbox
            }
        });

    } catch (error) {
        console.error('❌ VWorld GetMap 실패:', error);
        return c.json({
            error: 'Failed to fetch VWorld map',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

export default vworld;

// ✅ WMS GetFeatureInfo 프록시 (중심 좌표 등 질의)
vworld.get('/featureinfo', async (c) => {
    try {
        const apiKey = process.env.VWORLD_KEY;
        const domain = process.env.VWORLD_DOMAIN || 'localhost';

        if (!apiKey) {
            return c.json({ error: 'VWorld API key not configured' }, 500);
        }

        const layers = c.req.query('layers');
        const styles = c.req.query('styles') || '';
        const bbox = c.req.query('bbox');
        const width = c.req.query('width') || '256';
        const height = c.req.query('height') || '256';
        const crs = c.req.query('crs') || 'EPSG:4326';
        const i = c.req.query('i') || c.req.query('I') || String(Math.floor(Number(width) / 2));
        const j = c.req.query('j') || c.req.query('J') || String(Math.floor(Number(height) / 2));

        if (!layers || !bbox) {
            return c.json({ error: 'layers and bbox are required' }, 400);
        }

        // EPSG:4326 → ymin,xmin,ymax,xmax
        const coords = bbox.split(',').map(Number);
        if (coords.length !== 4) {
            return c.json({ error: 'Invalid bbox format' }, 400);
        }
        const [xmin, ymin, xmax, ymax] = coords;
        const finalBbox = crs === 'EPSG:4326' ? `${ymin},${xmin},${ymax},${xmax}` : bbox;

        const url = `https://api.vworld.kr/req/wms?` +
            `SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&` +
            `LAYERS=${encodeURIComponent(layers)}&STYLES=${encodeURIComponent(styles)}&` +
            `QUERY_LAYERS=${encodeURIComponent(layers)}&` +
            `CRS=${crs}&BBOX=${finalBbox}&WIDTH=${width}&HEIGHT=${height}&` +
            `I=${i}&J=${j}&INFO_FORMAT=application/json&` +
            `EXCEPTIONS=application/json&` +
            `KEY=${apiKey}&DOMAIN=${domain}`;

        const response = await fetch(url);
        if (!response.ok) {
            const text = await response.text();
            return c.json({ error: text }, { status: response.status as any });
        }

        const json = await response.json();
        return c.json(json);
    } catch (error) {
        console.error('❌ VWorld GetFeatureInfo 실패:', error);
        return c.json({ error: 'Failed to fetch feature info' }, 500);
    }
});
