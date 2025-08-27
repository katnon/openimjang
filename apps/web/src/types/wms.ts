export interface WMSLayer {
    id: string;
    name: string;
    layer: string;
    category: string;
    description: string;
    visible: boolean;
    opacity: number;
}

export interface WMSLayerCategory {
    id: string;
    name: string;
    layers: WMSLayer[];
}

// 아파트 임장에 유용한 레이어 정의
export const APARTMENT_WMS_LAYERS: WMSLayerCategory[] = [
    {
        id: 'zoning',
        name: '용도지역지구',
        layers: [
            {
                id: 'urban_area',
                name: '도시지역',
                layer: 'lt_c_uq111',
                category: 'zoning',
                description: '주거/상업/공업지역 구분',
                visible: false,
                opacity: 0.7
            },
            {
                id: 'land_use_plan',
                name: '토지이용계획도',
                layer: 'lt_c_lhblpn',
                category: 'zoning',
                description: '전체적인 토지이용계획',
                visible: false,
                opacity: 0.7
            },
            {
                id: 'green_belt',
                name: '개발제한구역',
                layer: 'lt_c_ud801',
                category: 'zoning',
                description: '그린벨트 지역',
                visible: false,
                opacity: 0.6
            }
        ]
    },
    {
        id: 'education',
        name: '교육',
        layers: [
            {
                id: 'elementary_school',
                name: '초등학교학교군',
                layer: 'lt_c_desch',
                category: 'education',
                description: '초등학교 배정 구역',
                visible: false,
                opacity: 0.5
            },
            {
                id: 'middle_school',
                name: '중학교학교군',
                layer: 'lt_c_dmsch',
                category: 'education',
                description: '중학교 배정 구역',
                visible: false,
                opacity: 0.5
            },
            {
                id: 'high_school',
                name: '고등학교학교군',
                layer: 'lt_c_dhsch',
                category: 'education',
                description: '고등학교 배정 구역',
                visible: false,
                opacity: 0.5
            },
            {
                id: 'education_protection',
                name: '교육환경보호구역',
                layer: 'lt_c_uo101',
                category: 'education',
                description: '학교 주변 보호구역',
                visible: false,
                opacity: 0.6
            }
        ]
    },
    {
        id: 'urban_planning',
        name: '도시계획시설',
        layers: [
            {
                id: 'roads',
                name: '도시계획(도로)',
                layer: 'lt_c_upisuq151',
                category: 'urban_planning',
                description: '계획도로 현황',
                visible: false,
                opacity: 0.8
            },
            {
                id: 'transportation',
                name: '도시계획(교통시설)',
                layer: 'lt_c_upisuq152',
                category: 'urban_planning',
                description: '교통시설 계획',
                visible: false,
                opacity: 0.7
            },
            {
                id: 'parks',
                name: '도시계획(공원시설)',
                layer: 'lt_c_upisuq153',
                category: 'urban_planning',
                description: '공원 및 녹지 계획',
                visible: false,
                opacity: 0.6
            },
            {
                id: 'public_facilities',
                name: '도시계획(공공문화체육시설)',
                layer: 'lt_c_upisuq155',
                category: 'urban_planning',
                description: '공공문화체육시설 계획',
                visible: false,
                opacity: 0.7
            }
        ]
    },
    {
        id: 'boundaries',
        name: '행정경계',
        layers: [
            {
                id: 'emd',
                name: '읍면동',
                layer: 'lt_c_ademd',
                category: 'boundaries',
                description: '읍면동 행정구역',
                visible: false,
                opacity: 0.4
            }
        ]
    },
    {
        id: 'environment',
        name: '환경/문화재',
        layers: [
            {
                id: 'water_protection',
                name: '상수원보호',
                layer: 'lt_c_um710',
                category: 'environment',
                description: '상수원보호구역',
                visible: false,
                opacity: 0.6
            },
            {
                id: 'cultural_heritage',
                name: '문화유산보호도',
                layer: 'lt_c_uo301',
                category: 'environment',
                description: '문화재보호구역',
                visible: false,
                opacity: 0.6
            },
            {
                id: 'national_park',
                name: '국립자연공원',
                layer: 'lt_c_wgisnpgug',
                category: 'environment',
                description: '국립자연공원 구역',
                visible: false,
                opacity: 0.5
            }
        ]
    }
];
