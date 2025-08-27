# OpenImjang (오픈임장)

실시간 부동산 위험도 분석 및 공간정보 시각화 플랫폼

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb)](https://reactjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-black)](https://bun.sh/)

## 🏗️ 아키텍처 개요

OpenImjang은 모던 웹 기술 스택을 활용한 **Monorepo + BFF(Backend for Frontend)** 아키텍처로 구성된 부동산 분석 플랫폼입니다.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │────│   Hono BFF      │────│   PostGIS DB    │
│  (Kakao Maps)   │    │  (API Proxy)    │    │ (Spatial Data)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌────────────┐         ┌──────────────┐      ┌─────────────────┐
    │ VWorld WMS │         │ 국토부 RTMS  │      │ 법정동/지적 데이터│
    │   레이어    │         │    API       │      │   (WFS/GeoJSON) │
    └────────────┘         └──────────────┘      └─────────────────┘
```

## 📂 프로젝트 구조

```
OpenImjang/
├── apps/
│   ├── web/                          # React SPA Frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── map/             # 지도 관련 컴포넌트
│   │   │   │   │   ├── MapContainer.tsx      # 메인 지도 컨테이너
│   │   │   │   │   ├── WMSLayerControl.tsx   # WMS 레이어 관리
│   │   │   │   │   ├── WMSPanel.tsx          # 레이어 패널 UI
│   │   │   │   │   └── MapControls.tsx       # 지도 컨트롤
│   │   │   │   ├── layout/          # 레이아웃 컴포넌트
│   │   │   │   │   ├── TopBar.tsx            # 상단 검색바
│   │   │   │   │   └── LayerToggle.tsx       # 레이어 토글
│   │   │   │   ├── card/            # 정보 카드
│   │   │   │   │   ├── SummaryCard.tsx       # 요약 정보
│   │   │   │   │   └── RealEstateDealsTable.tsx # 거래 테이블
│   │   │   │   └── MapPrime3DViewer.tsx      # 3D 지도 뷰어
│   │   │   ├── hooks/
│   │   │   │   ├── useWMSOverlay.ts          # WMS 오버레이 훅
│   │   │   │   └── useWMSTileset.ts          # WMS 타일셋 관리
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                    # API 클라이언트
│   │   │   │   └── loadKakao.ts              # 카카오맵 로더
│   │   │   ├── types/
│   │   │   │   ├── kakao.d.ts                # 카카오맵 타입
│   │   │   │   └── wms.ts                    # WMS 타입 정의
│   │   │   └── pages/
│   │   │       └── Home.tsx                  # 메인 페이지
│   │   └── public/
│   │       ├── js/cesium/                    # Cesium 3D 라이브러리
│   │       └── code-example/                 # 예제 코드
│   └── bff/                          # Backend for Frontend
│       ├── src/
│       │   ├── index.ts                      # 메인 서버
│       │   ├── lib/
│       │   │   └── db.ts                     # Kysely DB 연결
│       │   └── routes/
│       │       ├── search.ts                 # 검색 API
│       │       └── vworld.ts                 # VWorld 프록시
│       └── package.json
├── packages/
│   └── shared/                       # 공유 패키지
│       └── src/
│           ├── types.ts                      # 공통 타입
│           └── constants.ts                  # 공통 상수
├── db/
│   ├── migrations/                   # DB 마이그레이션
│   ├── scripts/
│   │   ├── fetch/                   # 데이터 수집 스크립트
│   │   │   ├── fetch_trade_raw.ts           # 거래 데이터 수집
│   │   │   ├── fetch_rent_raw.ts            # 임대 데이터 수집
│   │   │   └── populate_apt_*.ts            # 아파트 정보 가공
│   │   └── setup/
│   │       └── legal_dong_loader.ts         # 법정동 데이터 로더
│   └── seeds/                       # 시드 데이터
├── etl/                             # Extract, Transform, Load
│   ├── configs/
│   │   └── wfs-layers.json                  # WFS 레이어 설정
│   └── scripts/
│       └── import_wfs.sh                    # WFS 데이터 가져오기
└── data/                            # 정적 데이터
```

## 🛠️ 기술 스택

### Frontend Stack
- **React 19.1** - 최신 React with Concurrent Features
- **Vite 7.1** - 차세대 빌드 툴 
- **TypeScript 5.8** - 타입 안전성
- **TailwindCSS 3.4** - 유틸리티 기반 CSS
- **React Router DOM 7.8** - 클라이언트 사이드 라우팅
- **OpenLayers 10.6** - 고급 웹 매핑
- **Kakao Maps API** - 한국 지도 서비스
- **Cesium + MapPrime3D** - 3D 지구본 및 공간 시각화

### Backend Stack
- **Bun** - 고성능 JavaScript 런타임
- **Hono 4.4** - 경량 웹 프레임워크
- **Kysely 0.28** - 타입 안전 SQL 쿼리 빌더
- **PostgreSQL 14+** - 관계형 데이터베이스
- **PostGIS** - 공간 데이터 확장
- **Zod 3.23** - 스키마 검증

### External APIs & Services
- **국토부 RTMS API** - 부동산 거래 데이터
- **VWorld WFS/WMS** - 공간정보 서비스
- **Kakao Maps API** - 지도 및 지오코딩 서비스

## 🚀 설치 및 실행

### 필수 요구사항
- **Node.js 18+** 또는 **Bun 1.0+**
- **PostgreSQL 14+** with **PostGIS** extension
- **Git**

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/OpenImjang.git
cd OpenImjang
```

### 2. 의존성 설치
```bash
# Bun 권장 (더 빠름)
bun install

# 또는 npm
npm install
```

### 3. 환경 변수 설정

#### Frontend (.env.local)
```bash
# apps/web/.env.local
VITE_KAKAO_JS_KEY=your_kakao_javascript_key
VITE_VWORLD_KEY=your_vworld_api_key
VITE_VWORLD_DOMAIN=localhost
```

#### Backend (.env)
```bash
# apps/bff/.env
DATABASE_URL=postgresql://username:password@localhost:5432/openimjang
VWORLD_KEY=your_vworld_api_key
VWORLD_DOMAIN=localhost
KAKAO_REST_KEY=your_kakao_rest_api_key
RTMS_API_KEY=your_molit_rtms_api_key
```

### 4. 데이터베이스 설정

#### PostGIS 설치 및 DB 생성
```bash
# PostgreSQL 설치 (macOS)
brew install postgresql postgis

# 또는 Ubuntu
sudo apt-get install postgresql postgresql-contrib postgis

# 데이터베이스 생성
createdb openimjang
psql -d openimjang -c "CREATE EXTENSION postgis;"
```

#### 스키마 생성
```bash
cd db
# 마이그레이션 실행 (향후 추가 예정)
psql -U postgres -d openimjang -f migrations/init.sql
```

### 5. 개발 서버 실행

#### 개별 실행
```bash
# BFF 서버 (포트 3000)
cd apps/bff && bun run dev

# 프론트엔드 서버 (포트 5173)
cd apps/web && bun run dev
```

#### 동시 실행 (권장)
```bash
# 루트에서 모든 서비스 실행
npm run dev
```

### 6. 초기 데이터 로드

```bash
# 법정동 코드 로드
npm run load-legal-dong

# 아파트 거래 데이터 수집 (선택사항)
cd db/scripts/fetch
bun run fetch_trade_raw.ts
```

## 📚 주요 기능 및 모듈

### 🗺️ 지도 시스템

#### Kakao Maps Integration
- **MapContainer.tsx**: 메인 지도 컨테이너
  - 카카오맵 API 초기화 및 관리
  - 마커 및 오버레이 처리
  - 지도 이벤트 핸들링

```typescript
// 예시: 지도 초기화
const map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 3
});
```

#### WMS Layer System
- **useWMSOverlay.ts**: WMS 레이어 관리 훅
- **useWMSTileset.ts**: 타일셋 관리 및 캐싱
- **WMSLayerControl.tsx**: 레이어 제어 UI

**지원 레이어:**
- `연속지적도` (lp_pa_cbnd_bonbun, lp_pa_cbnd_bubun)
- `도시지역` (lt_c_uq111) - 주거/상업/공업지역
- `읍면동 경계` (lt_c_ademd) - 행정구역

```typescript
// WMS 레이어 토글 예시
const toggleLayer = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
        layer.visible = !layer.visible;
        updateOverlay(layer);
    }
};
```

#### 3D Visualization
- **MapPrime3DViewer.tsx**: Cesium 기반 3D 지도
  - 3D 건물 모델링
  - 지형 데이터 렌더링
  - 카메라 조작 및 애니메이션

### 🔍 검색 시스템

#### BFF Search API
```typescript
// 아파트 검색
GET /api/search/search?q=아파트명

// 좌표 기반 최근접 검색  
GET /api/search/nearest?lat=37.5665&lng=126.9780

// 지역별 거래 현황
GET /api/search/deals?pnu=1234567890
```

#### Kysely ORM 활용
```typescript
// apps/bff/src/routes/search.ts
const results = await db
    .selectFrom("oi.apt_info" as any)
    .selectAll()
    .where((eb) => eb.or([
        eb("apt_nm", "ilike", `%${q}%`),
        eb("jibun_address", "ilike", `%${q}%`)
    ]))
    .orderBy("apt_nm")
    .limit(10)
    .execute();
```

### 🛡️ 공간 데이터 처리

#### PostGIS Spatial Queries
```sql
-- 반경 내 아파트 검색
SELECT *, ST_Distance(
    geography(ST_MakePoint(lon, lat)),
    geography(ST_MakePoint($1, $2))
) as distance 
FROM oi.apt_info 
WHERE ST_DWithin(
    geography(ST_MakePoint(lon, lat)),
    geography(ST_MakePoint($1, $2)), 
    1000
)
ORDER BY distance LIMIT 10;
```

#### 좌표계 및 투영법
- **기본 SRID**: 4326 (WGS84)
- **공간 인덱스**: GIST 인덱스 적용
- **GeoJSON 출력**: `ST_AsGeoJSON()` 활용

### 📊 데이터 ETL 파이프라인

#### 국토부 RTMS API 연동
```typescript
// db/scripts/fetch/fetch_trade_raw.ts
const API_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

// XML/JSON 파싱 및 DB 저장
async function parseRtmsResponse(decoded: string) {
    // 중복 방지 및 에러 처리
    // 배치 처리 및 재시도 로직
}
```

#### VWorld WFS 데이터 처리
```json
// etl/configs/wfs-layers.json
{
    "layers": {
        "zoning": {
            "name": "용도지역",
            "type": "POLYGON", 
            "srid": 4326,
            "fields": ["zoning_type", "zoning_name", "geometry"]
        }
    }
}
```

### 🔄 API 프록시 & 캐싱

#### VWorld API 프록시
```typescript
// apps/bff/src/routes/vworld.ts
vworld.get('/capabilities', async (c) => {
    const url = `https://api.vworld.kr/req/wms?SERVICE=WMS&REQUEST=GetCapabilities&KEY=${apiKey}&DOMAIN=${domain}`;
    
    // 캐싱 및 에러 처리
    const response = await fetch(url);
    return c.json(await response.text());
});
```

## 🏛️ 데이터베이스 스키마

### 주요 테이블

#### `oi.apt_info` - 아파트 기본 정보
```sql
CREATE TABLE oi.apt_info (
    id SERIAL PRIMARY KEY,
    apt_nm VARCHAR(200),           -- 아파트명
    jibun_address TEXT,            -- 지번주소  
    road_address TEXT,             -- 도로명주소
    lat DOUBLE PRECISION,          -- 위도
    lon DOUBLE PRECISION,          -- 경도
    geom GEOMETRY(POINT, 4326),    -- PostGIS 포인트
    created_at TIMESTAMP DEFAULT NOW()
);

-- 공간 인덱스
CREATE INDEX idx_apt_info_geom ON oi.apt_info USING GIST(geom);
```

#### `oi.trade_raw` - 거래 원시 데이터
```sql
CREATE TABLE oi.trade_raw (
    id SERIAL PRIMARY KEY,
    deal_amount BIGINT,            -- 거래금액 (만원)
    deal_year INTEGER,             -- 거래년도
    deal_month INTEGER,            -- 거래월
    deal_day INTEGER,              -- 거래일
    apt_nm VARCHAR(200),           -- 아파트명
    exclusive_area DOUBLE PRECISION, -- 전용면적
    jibun VARCHAR(50),             -- 지번
    legal_dong_code VARCHAR(10),   -- 법정동코드
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 개발 가이드

### 코딩 컨벤션 [[memory:5413884]]

#### TypeScript 설정
```json
// tsconfig.json
{
    "compilerOptions": {
        "strict": true,
        "moduleResolution": "bundler",
        "target": "ES2022",
        "lib": ["ES2023", "DOM", "DOM.Iterable"]
    }
}
```

#### ESLint + Prettier 설정
```javascript
// eslint.config.js
export default [
    ...tseslint.configs.recommended,
    ...reactHooks.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': 'warn',
            'react-refresh/only-export-components': 'warn'
        }
    }
];
```

### 환경별 설정 [[memory:7352142]]

#### Development
- **Frontend**: `apps/web/.env.local`
- **Backend**: `apps/bff/.env`
- Hot reload 및 디버깅 모드

#### Production
- **빌드**: `bun run build`
- **환경변수**: `.env.production`
- **최적화**: Vite 번들 최적화

### API 설계 원칙

#### RESTful Routes
```
GET    /api/search/search           # 검색
GET    /api/search/nearest          # 최근접 검색
GET    /api/vworld/capabilities     # WMS 역량 조회
GET    /api/vworld/map              # WMS 맵 타일
```

#### Error Handling
```typescript
// 표준 에러 응답
{
    "error": "검색 중 오류가 발생했습니다.",
    "code": "SEARCH_ERROR", 
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔒 보안 고려사항

### API 키 관리
- **Client-side**: `VITE_*` 접두사로 공개 키만 노출
- **Server-side**: `.env` 파일로 민감한 키 보호
- **Production**: 환경변수로 키 주입

### CORS 설정
```typescript
// BFF CORS 설정
app.use('*', cors({
    origin: ['http://localhost:5173', 'https://your-domain.com'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
```

### SQL Injection 방지
- **Kysely ORM** 사용으로 타입 안전 쿼리
- **파라미터 바인딩** 강제 적용

## 📈 성능 최적화

### Frontend 최적화
- **React 19 Concurrent Features** 활용
- **Code Splitting**: 라우트별 분할
- **WMS 타일 캐싱**: 브라우저 캐시 활용
- **Virtual Scrolling**: 대용량 리스트 처리

### Backend 최적화  
- **Bun 런타임**: Node.js 대비 3-4배 빠른 성능
- **Kysely 컴파일된 쿼리**: 런타임 쿼리 최적화
- **Connection Pooling**: PostgreSQL 연결 관리
- **API 응답 캐싱**: 5-30분 캐시 정책

### Database 최적화
- **공간 인덱스**: GIST 인덱스로 지리 쿼리 가속
- **부분 인덱스**: 자주 조회되는 데이터만 인덱싱
- **쿼리 최적화**: EXPLAIN ANALYZE 활용

## 🧪 테스트 전략

### Unit Tests
```bash
# 컴포넌트 테스트
bun test src/components/**/*.test.tsx

# API 테스트  
bun test src/lib/**/*.test.ts
```

### Integration Tests
```bash
# BFF API 테스트
bun test apps/bff/src/**/*.test.ts

# DB 연결 테스트
bun test apps/bff/src/lib/db.test.ts
```

## 🚀 배포 가이드

### Docker 구성
```dockerfile
# Frontend
FROM node:18-alpine AS web
WORKDIR /app
COPY apps/web/ .
RUN npm install && npm run build

# BFF
FROM oven/bun:1 AS bff  
WORKDIR /app
COPY apps/bff/ .
RUN bun install
CMD ["bun", "start"]
```

### 환경별 배포
- **개발**: `localhost` 환경
- **스테이징**: Docker Compose
- **프로덕션**: Kubernetes 또는 클라우드 서비스

## 🤝 기여하기

### 개발 환경 설정
1. 저장소 Fork
2. Feature 브랜치 생성: `git checkout -b feature/new-feature`
3. 변경사항 커밋: `git commit -m 'Add new feature'`
4. 브랜치 푸시: `git push origin feature/new-feature`  
5. Pull Request 생성

### 코드 리뷰 가이드라인
- **타입 안전성** 확인
- **성능 영향도** 검토
- **보안 취약점** 점검
- **테스트 커버리지** 유지

## 📋 로드맵

### Phase 1 (현재)
- ✅ 기본 지도 시스템
- ✅ WMS 레이어 지원
- ✅ 아파트 검색 기능
- ✅ 3D 지도 뷰어

### Phase 2 (계획)
- [ ] 부동산 위험도 스코어링
- [ ] 실시간 시세 알림
- [ ] 투자 포트폴리오 관리
- [ ] 머신러닝 가격 예측

### Phase 3 (장기)
- [ ] 모바일 앱 (React Native)
- [ ] 소셜 기능 (커뮤니티)
- [ ] 전문가 분석 리포트
- [ ] 오픈 API 제공

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 문의사항

- **이슈 등록**: [GitHub Issues](https://github.com/your-username/OpenImjang/issues)
- **토론**: [GitHub Discussions](https://github.com/your-username/OpenImjang/discussions)

---

**OpenImjang**은 오픈소스 부동산 분석 플랫폼으로, 투명하고 접근 가능한 부동산 정보를 제공하는 것을 목표로 합니다.
