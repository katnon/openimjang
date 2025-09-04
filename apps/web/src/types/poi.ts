export interface POIItem {
    id: string;
    place_name: string;
    category_name: string;
    category_group_code: string;
    phone: string;
    address_name: string;
    road_address_name: string;
    x: string; // longitude
    y: string; // latitude
    place_url: string;
    distance: string;
}

export interface POISearchResponse {
    documents: POIItem[];
    meta: {
        total_count: number;
        pageable_count: number;
        is_end: boolean;
    };
}

export type POICategoryGroup = 
    | 'SW8' // 지하철역
    | 'BK9' // 은행
    | 'MT1' // 대형마트
    | 'CS2' // 편의점
    | 'PS3' // 어린이집, 유치원
    | 'SC4' // 학교
    | 'AC5' // 학원
    | 'PK6' // 주차장
    | 'OL7' // 주유소, 충전소
    | 'CE7' // 카페
    | 'HP8' // 병원
    | 'PM9' // 약국
    | 'FD6' // 음식점
    | 'AD5' // 숙박
    | 'AT4' // 관광명소
    | 'CT1' // 문화시설
    | 'PO3'; // 공공기관

export interface POICategory {
    id?: POICategoryGroup | string; // 카테고리 코드 (선택사항)
    name: string;
    icon: string;
    color: string;
    keywords?: string[]; // 키워드 검색용 (카테고리 코드 대신 사용)
}

export interface POIGroup {
    id: string;
    name: string;
    icon: string;
    categories: POICategory[];
}

export const POI_CATEGORIES: POIGroup[] = [
    {
        id: 'transport',
        name: '대중교통',
        icon: '🚇',
        categories: [
            { id: 'SW8', name: '지하철역', icon: '🚇', color: '#10b981' }
        ]
    },
    {
        id: 'education',
        name: '교육시설',
        icon: '🎓',
        categories: [
            { id: 'PS3', name: '어린이집/유치원', icon: '🧸', color: '#f59e0b' },
            { id: 'SC4', name: '초중고등학교', icon: '🏫', color: '#8b5cf6' },
            { keywords: ['대학교'], name: '대학교', icon: '🏛️', color: '#6366f1' },
            { id: 'AC5', name: '학원', icon: '📚', color: '#8b5cf6' }
        ]
    },
    {
        id: 'public_medical',
        name: '공공/의료',
        icon: '🏥',
        categories: [
            { id: 'PO3', name: '공공기관', icon: '🏛️', color: '#64748b' },
            { id: 'HP8', name: '병원', icon: '🏥', color: '#ef4444' },
            { id: 'PM9', name: '약국', icon: '💊', color: '#10b981' },
            { id: 'BK9', name: '은행', icon: '🏦', color: '#0ea5e9' }
        ]
    },
    {
        id: 'convenience',
        name: '생활편의',
        icon: '🛍️',
        categories: [
            { id: 'MT1', name: '대형마트', icon: '🛒', color: '#84cc16' },
            { id: 'CS2', name: '편의점', icon: '🏪', color: '#f97316' },
            { id: 'CE7', name: '카페', icon: '☕', color: '#a855f7' },
            { id: 'FD6', name: '음식점', icon: '🍽️', color: '#ef4444' }
        ]
    },
    {
        id: 'facilities',
        name: '기타시설',
        icon: '⛽',
        categories: [
            { id: 'OL7', name: '주유소/충전소', icon: '⛽', color: '#059669' }
        ]
    },
    {
        id: 'culture_tourism',
        name: '문화/관광',
        icon: '🎭',
        categories: [
            { id: 'CT1', name: '문화시설', icon: '🎭', color: '#d946ef' },
            { id: 'AT4', name: '관광명소', icon: '🗺️', color: '#06b6d4' },
            { id: 'AD5', name: '숙박시설', icon: '🏨', color: '#8b5cf6' }
        ]
    }
];

export interface POISearchParams {
    query?: string;
    category_group_code?: POICategoryGroup;
    x: number; // longitude (경도)
    y: number; // latitude (위도)
    radius?: number; // 반경(m), 기본 1000m
    page?: number;
    size?: number; // 한 페이지 결과 수
}