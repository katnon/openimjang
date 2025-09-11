// apps/bff/src/ai/handlers/memo/getUserMemos.ts
import { GetUserMemosInput } from '../../schemas/memo/getUserMemos.schema';

/**
 * 사용자의 임장 메모 데이터를 조회합니다.
 * 
 * Firebase Firestore에서 사용자가 작성한 모든 메모 또는 특정 아파트 관련 메모를 가져와서
 * AI가 임장 분석 시 참고할 수 있도록 합니다.
 */
export async function getUserMemos(params: GetUserMemosInput) {
    try {
        const { userId, aptId } = params;
        
        // TODO: 실제 Firebase Admin SDK 연동
        // 현재는 목업 데이터로 테스트
        
        const mockMemos = [
            {
                id: "memo_20240115_001",
                aptId: "123",
                aptName: "래미안 강변파크",
                title: "1차 임장 후기",
                body: `
                📍 위치: 강변역 도보 5분 거리
                
                ✅ 장점:
                - 한강뷰가 정말 좋음 (20층 이상 추천)
                - 지하철역 접근성 우수
                - 주변 카페, 마트 등 편의시설 충분
                - 단지 내 조경이 잘 되어 있음
                
                ❌ 단점:
                - 아침 시간대 차량 소음 있음
                - 주차공간 부족 (방문객 주차 어려움)
                - 관리비가 다소 높은 편
                
                💰 시세: 30평 기준 약 12-13억 정도
                📊 투자가치: 중상 (재개발 가능성 낮음)
                `,
                visitDate: "2024-01-15",
                createdAt: "2024-01-15T10:30:00Z",
                location: { lat: 37.5665, lon: 126.978 },
                photos: ["photo1.jpg", "photo2.jpg"],
                rating: 4.2
            },
            {
                id: "memo_20240120_002", 
                aptId: "456",
                aptName: "헬리오시티",
                title: "재방문 검토",
                body: `
                📍 위치: 송파구 잠실동, 올림픽공원 인근
                
                ✅ 장점:
                - 학군이 우수함 (잠실초, 중, 고 도보권)
                - 향후 개발 예정지와 가까움 (GTX 노선)
                - 대형마트, 백화점 접근성 좋음
                - 신축 아파트로 시설이 깨끗함
                
                ❌ 단점:
                - 가격이 다소 높은 편
                - 주변 교통 혼잡 (출퇴근 시간)
                
                💰 시세: 30평 기준 약 15-16억
                📊 투자가치: 상 (지역 개발로 상승 여력 있음)
                `,
                visitDate: "2024-01-20",
                createdAt: "2024-01-20T14:15:00Z",
                location: { lat: 37.5405, lon: 127.0707 },
                photos: ["photo3.jpg"],
                rating: 4.7
            }
        ];

        // aptId가 지정된 경우 해당 아파트 메모만 필터링
        const filteredMemos = aptId 
            ? mockMemos.filter(memo => memo.aptId === aptId)
            : mockMemos;

        return {
            success: true,
            data: {
                userId,
                requestedAptId: aptId,
                memos: filteredMemos,
                totalCount: filteredMemos.length,
                summary: {
                    avgRating: filteredMemos.length > 0 
                        ? filteredMemos.reduce((acc, memo) => acc + memo.rating, 0) / filteredMemos.length 
                        : 0,
                    visitedApartments: [...new Set(filteredMemos.map(memo => memo.aptName))],
                    latestVisit: filteredMemos.length > 0 
                        ? filteredMemos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].visitDate
                        : null
                }
            },
            metadata: {
                source: "firebase_firestore",
                timestamp: new Date().toISOString(),
                dataSchema: {
                    memo: {
                        id: "메모 고유 식별자",
                        aptId: "아파트 ID",
                        aptName: "아파트명",
                        title: "메모 제목",
                        body: "메모 내용 (마크다운 형식)",
                        visitDate: "임장 방문 날짜",
                        createdAt: "메모 작성 시간",
                        location: "좌표 정보 {lat, lon}",
                        photos: "첨부 사진 목록",
                        rating: "평점 (1-5)"
                    }
                }
            }
        };

    } catch (error) {
        console.error('❌ 사용자 메모 조회 실패:', error);
        return {
            success: false,
            error: 'Failed to fetch user memos',
            data: null
        };
    }
}