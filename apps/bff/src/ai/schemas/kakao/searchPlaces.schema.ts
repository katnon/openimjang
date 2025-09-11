// apps/bff/src/ai/schemas/kakao/searchPlaces.schema.ts
import { z } from 'zod';

export const searchPlacesInput = z.object({
    query: z.string().describe('검색할 장소 이름 또는 키워드'),
    x: z.number().optional().describe('중심 좌표 X (경도)'),
    y: z.number().optional().describe('중심 좌표 Y (위도)'),
    radius: z.number().optional().describe('반경 (미터, 기본값 20000)'),
    category: z.string().optional().describe('카테고리 그룹 코드 (MT1, CS2, PS3, SC4, AC5, PK6, OL7, SW8, BK9, CT1, AG2, PO3, AT4, AD5, FD6, CE7, HP8, PM9)')
});

export type SearchPlacesInput = z.infer<typeof searchPlacesInput>;

// OpenAI Function Calling 스키마
export const searchPlacesSchema = {
    name: 'searchPlaces',
    description: `카카오 로컬 API를 사용하여 장소를 검색합니다.
    
특정 지역 주변의 편의시설, 상가, 학교, 병원 등을 찾을 때 사용합니다.
임장 분석 시 아파트 주변 생활 인프라를 파악하는데 도움이 됩니다.

카테고리 코드:
- MT1: 대형마트
- CS2: 편의점  
- PS3: 어린이집, 유치원
- SC4: 학교
- AC5: 학원
- PK6: 주차장
- OL7: 주유소, 충전소
- SW8: 지하철역
- BK9: 은행
- CT1: 문화시설
- AG2: 중개업소
- PO3: 공공기관
- AT4: 관광명소
- AD5: 숙박
- FD6: 음식점
- CE7: 카페
- HP8: 병원
- PM9: 약국

사용 시기:
- 아파트 주변 생활 편의시설 조회
- 투자 가치 분석을 위한 인프라 조사
- 교통, 교육, 의료 시설 접근성 평가`,
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '검색할 장소 이름 또는 키워드 (예: "스타벅스", "롯데마트", "지하철역")'
            },
            x: {
                type: 'number',
                description: '중심 좌표 X (경도) - 검색 중심점으로 사용'
            },
            y: {
                type: 'number', 
                description: '중심 좌표 Y (위도) - 검색 중심점으로 사용'
            },
            radius: {
                type: 'number',
                description: '검색 반경 (미터, 기본값 20000, 최대 20000)'
            },
            category: {
                type: 'string',
                description: '카테고리 그룹 코드 (MT1, CS2, PS3, SC4, AC5, PK6, OL7, SW8, BK9, CT1, AG2, PO3, AT4, AD5, FD6, CE7, HP8, PM9)'
            }
        },
        required: ['query']
    }
};