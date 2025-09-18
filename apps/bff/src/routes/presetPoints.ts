import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db } from '../lib/db';
import { sql } from 'kysely';

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
        const { lat, lon, height, dong, ho, exclu_use_ar, apt_nm, jibun_address, apt_id, floorplan_image_url } = body;

        console.log('프리셋 포인트 생성 요청:', { 
            lat, lon, height, dong, ho, exclu_use_ar, apt_nm, apt_id, 
            hasFloorplan: !!floorplan_image_url 
        });

        // 필수 필드 검증
        if (!lat || !lon) {
            return c.json({
                success: false,
                error: '위도와 경도는 필수입니다'
            }, 400);
        }

        // apt_id 검증 강화 (개발 환경에서는 경고만, 운영에서는 필수)
        if (!apt_id) {
            console.warn('⚠️ 아파트 ID 없이 프리셋 포인트 생성 시도');

            // 운영 환경에서는 apt_id 필수
            if (process.env.NODE_ENV === 'production') {
                return c.json({
                    success: false,
                    error: '아파트 연결 정보가 필요합니다. 올바른 아파트 영역에서 포인트를 생성해주세요.'
                }, 400);
            }
        }

        // 🔥 중복 프리셋 포인트 방지 검증
        if (apt_id && dong && ho) {
            const existingPoint = await db
                .selectFrom('oi.preset_points')
                .select(['id', 'apt_nm', 'dong', 'ho'])
                .where('apt_id', '=', Number(apt_id))
                .where('dong', '=', dong)
                .where('ho', '=', ho)
                .executeTakeFirst();

            if (existingPoint) {
                console.warn('⚠️ 중복 프리셋 포인트 생성 시도:', {
                    apt_id,
                    dong,
                    ho,
                    existing: existingPoint
                });

                return c.json({
                    success: false,
                    error: `${existingPoint.apt_nm} ${dong} ${ho}에 이미 프리셋 포인트가 존재합니다. (ID: ${existingPoint.id})`
                }, 409); // 409 Conflict
            }
        }

        const result = await db
            .insertInto('oi.preset_points')
            .values({
                lat: Number(lat),
                lon: Number(lon),
                height: height ? Number(height) : 0.0,
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
                'height', 
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

// 모든 프리셋 포인트 조회 (실거래가 정보 포함)
app.get('/list', async (c) => {
    try {
        console.log('프리셋 포인트 목록 조회 요청 (실거래가 포함)');

        // 실거래가 정보까지 포함해서 조회
        const points = await sql`
            SELECT
                pp.*,
                recent_deal.deal_amount as recent_deal_amount
            FROM oi.preset_points pp
            LEFT JOIN (
                SELECT DISTINCT ON (jibun_address, exclu_use_ar)
                    jibun_address,
                    exclu_use_ar,
                    deal_amount,
                    deal_year,
                    deal_month
                FROM oi.apt_deal_all
                WHERE deal_amount IS NOT NULL
                ORDER BY jibun_address, exclu_use_ar, deal_year DESC, deal_month DESC
            ) recent_deal ON pp.jibun_address = recent_deal.jibun_address
                         AND ABS(pp.exclu_use_ar - recent_deal.exclu_use_ar) < 1
            ORDER BY pp.created_at DESC
        `.execute(db);

        console.log(`프리셋 포인트 ${points.rows.length}개 조회 완료 (실거래가 포함)`);

        return c.json({
            success: true,
            data: points.rows
        });

    } catch (error) {
        console.error('프리셋 포인트 조회 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 🆕 특정 프리셋 포인트 ID로 조회 (실시간 데이터용)
app.get('/by-id/:id', async (c) => {
    try {
        const id = c.req.param('id');

        console.log('프리셋 포인트 ID 조회 요청:', id);

        if (!id || isNaN(Number(id))) {
            return c.json({
                success: false,
                error: '유효하지 않은 프리셋 포인트 ID입니다'
            }, 400);
        }

        const point = await db
            .selectFrom('oi.preset_points')
            .selectAll()
            .where('id', '=', Number(id))
            .executeTakeFirst();

        if (!point) {
            return c.json({
                success: false,
                error: '프리셋 포인트를 찾을 수 없습니다'
            }, 404);
        }

        console.log(`프리셋 포인트 ID ${id} 조회 완료:`, point);

        return c.json({
            success: true,
            data: point
        });

    } catch (error) {
        console.error('프리셋 포인트 ID 조회 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 특정 아파트의 프리셋 포인트 조회 (실거래가 정보 포함)
app.get('/by-apartment/:aptId', async (c) => {
    try {
        const aptId = c.req.param('aptId');

        console.log('아파트별 프리셋 포인트 조회 요청 (실거래가 포함):', aptId);

        if (!aptId || isNaN(Number(aptId))) {
            return c.json({
                success: false,
                error: '유효하지 않은 아파트 ID입니다'
            }, 400);
        }

        // 실거래가 정보까지 포함해서 조회
        const points = await sql`
            SELECT
                pp.*,
                recent_deal.deal_amount as recent_deal_amount
            FROM oi.preset_points pp
            LEFT JOIN (
                SELECT DISTINCT ON (jibun_address, exclu_use_ar)
                    jibun_address,
                    exclu_use_ar,
                    deal_amount,
                    deal_year,
                    deal_month
                FROM oi.apt_deal_all
                WHERE deal_amount IS NOT NULL
                ORDER BY jibun_address, exclu_use_ar, deal_year DESC, deal_month DESC
            ) recent_deal ON pp.jibun_address = recent_deal.jibun_address
                         AND ABS(pp.exclu_use_ar - recent_deal.exclu_use_ar) < 1
            WHERE pp.apt_id = ${Number(aptId)}
            ORDER BY pp.created_at DESC
        `.execute(db);

        console.log(`아파트 ID ${aptId}의 프리셋 포인트 ${points.rows.length}개 조회 완료 (실거래가 포함)`);

        return c.json({
            success: true,
            data: points.rows
        });

    } catch (error) {
        console.error('아파트별 프리셋 포인트 조회 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 기존 프리셋 포인트 height 마이그레이션 (개발용)
app.post('/migrate-height', async (c) => {
    try {
        console.log('프리셋 포인트 height 마이그레이션 시작');

        const result = await db
            .updateTable('oi.preset_points')
            .set({ height: 50.0 })
            .where('height', 'is', null)
            .orWhere('height', '=', 0)
            .returning(['id', 'apt_nm', 'dong', 'ho'])
            .execute();

        console.log(`height 마이그레이션 완료: ${result.length}개 포인트 업데이트`);

        return c.json({ 
            success: true, 
            message: `${result.length}개 포인트의 height를 50m로 설정했습니다`,
            data: result 
        });

    } catch (error) {
        console.error('height 마이그레이션 실패:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : '알 수 없는 오류' 
        }, 500);
    }
});

// 기존 프리셋 포인트들의 아파트 연결 수정 (마이그레이션)
app.post('/fix-apartment-links', async (c) => {
    try {
        console.log('프리셋 포인트 아파트 연결 수정 시작');

        // 1. apt_id가 null인 프리셋 포인트들 조회
        const orphanPoints = await db
            .selectFrom('oi.preset_points')
            .selectAll()
            .where('apt_id', 'is', null)
            .execute();

        console.log(`아파트 연결이 누락된 프리셋 포인트 ${orphanPoints.length}개 발견`);

        if (orphanPoints.length === 0) {
            return c.json({
                success: true,
                message: '모든 프리셋 포인트가 이미 아파트와 연결되어 있습니다',
                updated: 0
            });
        }

        const updatedPoints = [];

        // 2. 각 포인트에 대해 가장 가까운 아파트 찾기
        for (const point of orphanPoints) {
            console.log(`포인트 ${point.id} (${point.lat}, ${point.lon})의 가장 가까운 아파트 검색`);

            // 원시 SQL을 사용하여 가장 가까운 아파트 찾기 (500m 반경 내)
            const nearestAptResult = await db.executeQuery(
                db.selectFrom('oi.apt_info')
                    .select([
                        'id',
                        'apt_nm',
                        'jibun_address',
                        'lat',
                        'lon'
                    ])
                    .select(sql`ST_Distance(
                        geography(ST_MakePoint(${point.lon}, ${point.lat})),
                        geography(ST_MakePoint(lon, lat))
                    )`.as('distance'))
                    .where('lat', 'is not', null)
                    .where('lon', 'is not', null)
                    .where(sql`ST_DWithin(
                        geography(ST_MakePoint(${point.lon}, ${point.lat})),
                        geography(ST_MakePoint(lon, lat)),
                        500
                    )`)
                    .orderBy('distance', 'asc')
                    .limit(1)
                    .compile()
            );

            const nearestApt = nearestAptResult.rows[0] as any;

            if (nearestApt) {
                console.log(`포인트 ${point.id}에 가장 가까운 아파트: ${nearestApt.apt_nm} (거리: ${nearestApt.distance})`);

                // 3. 프리셋 포인트 업데이트
                const updated = await db
                    .updateTable('oi.preset_points')
                    .set({
                        apt_id: nearestApt.id,
                        apt_nm: nearestApt.apt_nm,
                        jibun_address: nearestApt.jibun_address,
                        updated_at: new Date()
                    })
                    .where('id', '=', point.id)
                    .returning(['id', 'apt_nm', 'dong', 'ho'])
                    .executeTakeFirst();

                if (updated) {
                    updatedPoints.push({
                        pointId: updated.id,
                        aptName: updated.apt_nm,
                        dong: updated.dong,
                        ho: updated.ho,
                        distance: nearestApt.distance
                    });
                }
            } else {
                console.warn(`포인트 ${point.id} 주변 500m 내에 아파트를 찾을 수 없음`);
            }
        }

        console.log(`프리셋 포인트 아파트 연결 수정 완료: ${updatedPoints.length}개 업데이트`);

        return c.json({
            success: true,
            message: `${updatedPoints.length}개 프리셋 포인트의 아파트 연결을 수정했습니다`,
            updated: updatedPoints.length,
            details: updatedPoints
        });

    } catch (error) {
        console.error('프리셋 포인트 아파트 연결 수정 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 프리셋 포인트 아파트 재연결 (수동 수정용)
app.post('/reassign/:pointId/:newAptId', async (c) => {
    try {
        const pointId = Number(c.req.param('pointId'));
        const newAptId = Number(c.req.param('newAptId'));

        console.log(`프리셋 포인트 ${pointId}를 아파트 ${newAptId}로 재연결 요청`);

        // 1. 새 아파트 정보 조회
        const newApt = await db
            .selectFrom('oi.apt_info')
            .select(['id', 'apt_nm', 'jibun_address'])
            .where('id', '=', newAptId)
            .executeTakeFirst();

        if (!newApt) {
            return c.json({
                success: false,
                error: `아파트 ID ${newAptId}를 찾을 수 없습니다`
            }, 404);
        }

        // 2. 프리셋 포인트 업데이트
        const updated = await db
            .updateTable('oi.preset_points')
            .set({
                apt_id: newApt.id,
                apt_nm: newApt.apt_nm,
                jibun_address: newApt.jibun_address,
                updated_at: new Date()
            })
            .where('id', '=', pointId)
            .returning(['id', 'apt_nm', 'dong', 'ho'])
            .executeTakeFirst();

        if (!updated) {
            return c.json({
                success: false,
                error: `프리셋 포인트 ID ${pointId}를 찾을 수 없습니다`
            }, 404);
        }

        console.log(`프리셋 포인트 재연결 완료: ${updated.apt_nm} ${updated.dong} ${updated.ho}`);

        return c.json({
            success: true,
            message: `프리셋 포인트가 ${newApt.apt_nm}로 재연결되었습니다`,
            data: updated
        });

    } catch (error) {
        console.error('프리셋 포인트 재연결 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 🔧 개발자 모드용 프리셋 포인트 좌표 업데이트
app.put('/update-coordinates/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { lat, lon, height } = body;

        console.log('프리셋 포인트 좌표 업데이트 요청:', { id, lat, lon, height });

        if (!id || isNaN(Number(id))) {
            return c.json({
                success: false,
                error: '유효하지 않은 프리셋 포인트 ID입니다'
            }, 400);
        }

        // 좌표 유효성 검증
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            return c.json({
                success: false,
                error: '유효하지 않은 좌표입니다'
            }, 400);
        }

        // 서울 범위 대략 확인 (위도: 37.4-37.7, 경도: 126.8-127.2)
        if (lat < 37.4 || lat > 37.7 || lon < 126.8 || lon > 127.2) {
            console.warn('⚠️ 서울 범위를 벗어난 좌표:', { lat, lon });
        }

        const result = await db
            .updateTable('oi.preset_points')
            .set({
                lat: Number(lat),
                lon: Number(lon),
                height: height ? Number(height) : 0.0,
                updated_at: new Date()
            })
            .where('id', '=', Number(id))
            .returning([
                'id',
                'lat',
                'lon',
                'height',
                'apt_nm',
                'dong',
                'ho',
                'updated_at'
            ])
            .executeTakeFirst();

        if (!result) {
            return c.json({
                success: false,
                error: '프리셋 포인트를 찾을 수 없습니다'
            }, 404);
        }

        console.log('✅ 프리셋 포인트 좌표 업데이트 성공:', result);

        return c.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ 프리셋 포인트 좌표 업데이트 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 🆕 프리셋 포인트의 최근 거래 정보 조회 (매매/전세/월세 구분)
app.get('/recent-deals/:id', async (c) => {
    try {
        const id = c.req.param('id');

        console.log('프리셋 포인트 최근 거래 정보 조회 요청:', id);

        if (!id || isNaN(Number(id))) {
            return c.json({
                success: false,
                error: '유효하지 않은 프리셋 포인트 ID입니다'
            }, 400);
        }

        // 1. 프리셋 포인트 정보 조회
        const point = await db
            .selectFrom('oi.preset_points')
            .select(['jibun_address', 'exclu_use_ar', 'apt_nm', 'dong', 'ho'])
            .where('id', '=', Number(id))
            .executeTakeFirst();

        if (!point) {
            return c.json({
                success: false,
                error: '프리셋 포인트를 찾을 수 없습니다'
            }, 404);
        }

        // 2. 면적 허용 오차 ±1㎡ 범위로 최근 거래 조회
        const areaMin = point.exclu_use_ar ? point.exclu_use_ar - 1 : 0;
        const areaMax = point.exclu_use_ar ? point.exclu_use_ar + 1 : 999;

        // 최근 매매 (deal_amount IS NOT NULL)
        const recentSale = await db
            .selectFrom('oi.apt_deal_all')
            .select(['deal_amount', 'deal_year', 'deal_month', 'deal_day', 'exclu_use_ar'])
            .where('jibun_address', '=', point.jibun_address)
            .where('deal_amount', 'is not', null)
            .where('exclu_use_ar', '>=', areaMin)
            .where('exclu_use_ar', '<=', areaMax)
            .orderBy('deal_year', 'desc')
            .orderBy('deal_month', 'desc')
            .orderBy('deal_day', 'desc')
            .limit(1)
            .executeTakeFirst();

        // 최근 전세 (deposit IS NOT NULL AND monthly_rent IS NULL)
        const recentJeonse = await db
            .selectFrom('oi.apt_deal_all')
            .select(['deposit', 'deal_year', 'deal_month', 'deal_day', 'exclu_use_ar'])
            .where('jibun_address', '=', point.jibun_address)
            .where('deposit', 'is not', null)
            .where('monthly_rent', 'is', null)
            .where('deal_amount', 'is', null)
            .where('exclu_use_ar', '>=', areaMin)
            .where('exclu_use_ar', '<=', areaMax)
            .orderBy('deal_year', 'desc')
            .orderBy('deal_month', 'desc')
            .orderBy('deal_day', 'desc')
            .limit(1)
            .executeTakeFirst();

        // 최근 월세 (deposit IS NOT NULL AND monthly_rent IS NOT NULL)
        const recentMonthly = await db
            .selectFrom('oi.apt_deal_all')
            .select(['deposit', 'monthly_rent', 'deal_year', 'deal_month', 'deal_day', 'exclu_use_ar'])
            .where('jibun_address', '=', point.jibun_address)
            .where('deposit', 'is not', null)
            .where('monthly_rent', 'is not', null)
            .where('deal_amount', 'is', null)
            .where('exclu_use_ar', '>=', areaMin)
            .where('exclu_use_ar', '<=', areaMax)
            .orderBy('deal_year', 'desc')
            .orderBy('deal_month', 'desc')
            .orderBy('deal_day', 'desc')
            .limit(1)
            .executeTakeFirst();

        // 결과 포맷팅
        const result = {
            pointInfo: {
                apt_nm: point.apt_nm,
                dong: point.dong,
                ho: point.ho,
                exclu_use_ar: point.exclu_use_ar
            },
            recentDeals: {
                sale: recentSale ? {
                    amount: recentSale.deal_amount,
                    date: `${recentSale.deal_year}-${String(recentSale.deal_month).padStart(2, '0')}-${String(recentSale.deal_day).padStart(2, '0')}`,
                    exclu_use_ar: recentSale.exclu_use_ar
                } : null,
                jeonse: recentJeonse ? {
                    amount: recentJeonse.deposit,
                    date: `${recentJeonse.deal_year}-${String(recentJeonse.deal_month).padStart(2, '0')}-${String(recentJeonse.deal_day).padStart(2, '0')}`,
                    exclu_use_ar: recentJeonse.exclu_use_ar
                } : null,
                monthly: recentMonthly ? {
                    deposit: recentMonthly.deposit,
                    rent: recentMonthly.monthly_rent,
                    date: `${recentMonthly.deal_year}-${String(recentMonthly.deal_month).padStart(2, '0')}-${String(recentMonthly.deal_day).padStart(2, '0')}`,
                    exclu_use_ar: recentMonthly.exclu_use_ar
                } : null
            }
        };

        console.log(`프리셋 포인트 ${id} 최근 거래 조회 완료:`, {
            sale: !!result.recentDeals.sale,
            jeonse: !!result.recentDeals.jeonse,
            monthly: !!result.recentDeals.monthly
        });

        return c.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('프리셋 포인트 최근 거래 조회 실패:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        }, 500);
    }
});

// 🧹 중복 프리셋 포인트 정리 (개발용)
app.post('/cleanup-duplicates', async (c) => {
    try {
        console.log('중복 프리셋 포인트 정리 시작');

        // 중복 그룹 조회 (apt_id, dong, ho 기준)
        const duplicatesQuery = await sql`
            SELECT
                apt_id,
                dong,
                ho,
                array_agg(id ORDER BY created_at DESC) as ids,
                array_agg(apt_nm) as apt_names,
                COUNT(*) as count
            FROM oi.preset_points
            WHERE apt_id IS NOT NULL
              AND dong IS NOT NULL
              AND ho IS NOT NULL
            GROUP BY apt_id, dong, ho
            HAVING COUNT(*) > 1
        `.execute(db);

        const duplicateGroups = duplicatesQuery.rows as any[];
        console.log(`중복 그룹 ${duplicateGroups.length}개 발견`);

        if (duplicateGroups.length === 0) {
            return c.json({
                success: true,
                message: '중복된 프리셋 포인트가 없습니다',
                removed: 0
            });
        }

        let totalRemoved = 0;
        const details = [];

        for (const group of duplicateGroups) {
            const ids = group.ids;
            const aptName = group.apt_names[0];
            const keepId = ids[0]; // 가장 최근 생성된 것 유지
            const removeIds = ids.slice(1); // 나머지 삭제

            console.log(`${aptName} ${group.dong} ${group.ho}: ${removeIds.length}개 중복 제거 (유지: ${keepId})`);

            // 중복 포인트들 삭제
            const deleted = await db
                .deleteFrom('oi.preset_points')
                .where('id', 'in', removeIds)
                .returning(['id', 'apt_nm', 'dong', 'ho'])
                .execute();

            totalRemoved += deleted.length;
            details.push({
                aptName,
                dong: group.dong,
                ho: group.ho,
                kept: keepId,
                removed: removeIds,
                removedCount: deleted.length
            });
        }

        console.log(`중복 프리셋 포인트 정리 완료: ${totalRemoved}개 삭제`);

        return c.json({
            success: true,
            message: `${totalRemoved}개의 중복 프리셋 포인트를 정리했습니다`,
            removed: totalRemoved,
            details
        });

    } catch (error) {
        console.error('중복 프리셋 포인트 정리 실패:', error);
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