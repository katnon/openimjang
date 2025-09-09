# OpenImjang (오픈임장) 🏠

**AI 기반 부동산 종합 분석 및 공간정보 시각화 플랫폼**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb)](https://reactjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-black)](https://bun.sh/)
[![Firebase](https://img.shields.io/badge/Firebase-10.8-orange)](https://firebase.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-green)](https://openai.com/)

## 🌟 주요 특징

- **🤖 AI 임장 도우미**: OpenAI GPT-4를 활용한 종합 부동산 분석
- **📱 현대적 UI/UX**: React 19 + TailwindCSS로 구성된 반응형 웹앱
- **🗺️ 다차원 지도 시각화**: 2D(Kakao Maps) + 3D(Cesium) 통합 지도
- **🔍 실시간 부동산 데이터**: 국토부 RTMS API 연동 실거래가 정보
- **📊 공간 데이터 분석**: PostGIS 기반 지리공간 쿼리
- **🔐 안전한 사용자 관리**: Firebase Authentication 통합
- **☁️ 클라우드 저장소**: Firebase Firestore + Storage 활용

## 🏗️ 시스템 아키텍처

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[React SPA<br/>Vite + TypeScript] --> B[Kakao Maps 2D]
        A --> C[Cesium 3D Viewer]
        A --> D[Firebase Auth/Storage]
    end
    
    subgraph "Backend Layer" 
        E[Hono BFF<br/>Bun Runtime] --> F[Kysely ORM]
        E --> G[OpenAI API]
        E --> H[Firebase Admin SDK]
    end
    
    subgraph "Data Layer"
        I[PostGIS<br/>Spatial Database] --> J[부동산 실거래 데이터]
        I --> K[건물/토지 정보]
        I --> L[지적편집도 데이터]
    end
    
    subgraph "External APIs"
        M[국토부 RTMS API] --> E
        N[VWorld WMS/WFS] --> E
        O[카카오맵 API] --> A
        P[건축물대장 API] --> E
    end
    
    A <--> E
    E <--> I
    
    style A fill:#61dafb
    style E fill:#000000
    style I fill:#336791
    style G fill:#10a37f
```

## 📂 프로젝트 구조

```
OpenImjang/
├── apps/                            # 애플리케이션
│   ├── bff/                         # Backend for Frontend (Hono + Bun)
│   │   ├── src/
│   │   │   ├── index.ts             # BFF 메인 서버
│   │   │   ├── lib/
│   │   │   │   └── db.ts            # Kysely PostGIS 연결
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts          # Firebase 인증 미들웨어
│   │   │   ├── routes/
│   │   │   │   ├── ai.ts            # 🆕 OpenAI API 라우트 (기존 채팅봇)
│   │   │   │   ├── apiAiTools.ts    # 🆕 모듈형 AI Function API
│   │   │   │   ├── search.ts        # 부동산 검색 API
│   │   │   │   ├── poi.ts           # POI(관심지점) API
│   │   │   │   └── geo/
│   │   │   │       ├── buildings.ts # 건물 정보 API
│   │   │   │       └── upis.ts      # 지적 정보 API
│   │   │   └── ai/                  # 🆕 AI 모듈형 시스템
│   │   │       ├── tools/
│   │   │       │   ├── types.ts     # AI Tool 타입 정의
│   │   │       │   ├── validation.ts # Ajv 검증 파이프라인
│   │   │       │   └── index.ts     # Tool 스키마 집계
│   │   │       ├── schemas/         # JSON Schema 정의
│   │   │       │   ├── realestate/  # 부동산 함수 스키마 (5개)
│   │   │       │   └── geo/         # 지리정보 함수 스키마 (8개)
│   │   │       ├── handlers/        # Function 핸들러 구현체
│   │   │       │   ├── index.ts     # 핸들러 동적 로딩 맵
│   │   │       │   ├── searchRealEstateDeals.ts
│   │   │       │   ├── getLatestTrade.ts
│   │   │       │   ├── getPriceTrends.ts
│   │   │       │   ├── getDealStatsSummary.ts
│   │   │       │   ├── getDealDistribution.ts
│   │   │       │   └── geo/         # 지리정보 핸들러군
│   │   │       │       ├── geocodeAddress.ts
│   │   │       │       ├── reverseGeocode.ts
│   │   │       │       ├── lookupLegalDongCode.ts
│   │   │       │       ├── convertDongCode.ts
│   │   │       │       ├── getNearbyByCoords.ts
│   │   │       │       ├── isochroneSearch.ts
│   │   │       │       ├── transformCoordinates.ts
│   │   │       │       └── normalizeKoreanAddress.ts
│   │   │       └── repo/            # Repository 패턴 데이터 계층
│   │   │           ├── dealsRepo.ts # 부동산 거래 데이터 레포지토리
│   │   │           └── geoRepo.ts   # 지리정보 서비스 레포지토리
│   │   └── package.json
│   └── web/                         # React SPA Frontend
│       ├── src/
│       │   ├── auth/
│       │   │   └── AuthProvider.tsx # 🆕 Firebase 인증 프로바이더
│       │   ├── components/
│       │   │   ├── ai/              # 🆕 AI 관련 컴포넌트
│       │   │   │   ├── AIAnalysisModal.tsx
│       │   │   │   └── AIChatbot.tsx
│       │   │   ├── auth/            # 🆕 인증 컴포넌트
│       │   │   │   └── AuthPage.tsx
│       │   │   ├── onboarding/      # 🆕 온보딩 시스템
│       │   │   │   └── UserOnboardingModal.tsx # 사용자 맞춤 설정
│       │   │   ├── card/
│       │   │   │   ├── AiSummaryPanel.tsx    # 🆕 AI 종합 분석 패널
│       │   │   │   ├── SummaryCard.tsx       # 업데이트: 4개 탭 구조
│       │   │   │   ├── RealEstateDealsTable.tsx # 실거래가 테이블
│       │   │   │   ├── BuildingLandInfo.tsx  # 건물/토지 정보
│       │   │   │   └── NearbyInfoPanel.tsx   # 주변 정보
│       │   │   ├── layout/
│       │   │   │   └── TopBar.tsx            # 업데이트: 통합 브랜드 색상
│       │   │   ├── map/
│       │   │   │   ├── MapContainer.tsx      # 업데이트: 즐겨찾기 마커
│       │   │   │   └── MapControls.tsx       # 업데이트: 즐겨찾기 토글
│       │   │   ├── memo/            # 🆕 임장 메모 시스템
│       │   │   │   ├── MemoCreateModal.tsx   # 메모 작성/수정
│       │   │   │   ├── MyImjangModal.tsx     # 내 임장 목록
│       │   │   │   └── FavoriteConfirmPopup.tsx # 즐겨찾기 확인
│       │   │   └── MapPrime3DViewer.tsx      # 3D 지도 뷰어
│       │   ├── firebase.ts          # 🆕 Firebase 설정
│       │   └── hooks/
│       │       ├── use3DEqbHighlight.ts      # 3D 연계정보 하이라이트
│       │       ├── useEqbOverlay.ts          # EQB 오버레이
│       │       ├── useFirstPersonLook.ts     # 🆕 1인칭 시점
│       │       ├── useShadeAnalysis.ts       # 🆕 그림자 분석
│       │       ├── useWalkingMode.ts         # 🆕 워킹 모드
│       │       └── useWindowView.ts          # 🆕 창문 뷰
│       └── public/
│           └── js/cesium/            # Cesium 3D 라이브러리

├── db/                              # 데이터베이스 & ETL
│   └── scripts/
│       ├── fetch/                   # 🆕 데이터 수집 스크립트
│       │   ├── fetch_building_info.ts        # 건축물대장 API 수집
│       │   ├── fetch_landuse_included.ts     # 토지이용계획 수집
│       │   ├── fetch_rent_raw.ts             # 전월세 데이터 수집
│       │   ├── fetch_trade_raw.ts            # 매매 데이터 수집
│       │   ├── populate_apt_deal_all.ts      # 통합 거래 데이터 가공
│       │   └── fill_apt_info_coordinates.ts  # 좌표 정보 보완
│       ├── setup/
│       │   └── legal_dong_loader.ts          # 법정동 코드 로더
│       └── SQLquery/
│           └── oi.query.sql          # 🆕 OpenImjang 스키마 정의
└── CLAUDE.md                        # Claude Code 개발 가이드
```

## 🛠️ 기술 스택

### Frontend Stack
- **React 19.1** - Concurrent Features를 활용한 최신 React
- **Vite 7.1** - 차세대 빌드 툴 및 개발 서버
- **TypeScript 5.8** - 타입 안전성 확보
- **TailwindCSS 3.4** - 유틸리티 기반 CSS 프레임워크
- **Firebase SDK 10.8** - 인증 및 실시간 데이터베이스
- **Kakao Maps API** - 한국 최적화 지도 서비스
- **Cesium + MapPrime3D** - 3D 지구본 및 공간 시각화
- **Axios** - HTTP 클라이언트 (인터셉터 포함)

### Backend Stack
- **Bun 1.0** - 고성능 JavaScript 런타임 (Node.js 대비 3-4배 빠름)
- **Hono 4.4** - 경량 고성능 웹 프레임워크
- **Kysely 0.28** - 타입 안전 SQL 쿼리 빌더
- **Firebase Admin SDK** - 서버사이드 Firebase 인증
- **OpenAI API** - GPT-4o-mini 모델 활용

### Database & Infrastructure
- **PostgreSQL 14+** - 관계형 데이터베이스
- **PostGIS 3.3+** - 공간 데이터 확장
- **Firebase Firestore** - NoSQL 문서 데이터베이스 (임장 메모)
- **Firebase Storage** - 파일 저장소 (사진 업로드)
- **Firebase Authentication** - 사용자 인증 (구글 OAuth 지원)

### External APIs & Services
- **국토부 RTMS API** - 부동산 실거래가 데이터
- **건축물대장 API** - 건축물 정보 (총괄표제부/표제부)
- **VWorld WFS/WMS** - 국가공간정보 서비스
- **Kakao Maps/Local API** - 지도 서비스 및 POI 검색

## 🚀 설치 및 실행

### 필수 요구사항
- **Node.js 18+** 또는 **Bun 1.0+**
- **PostgreSQL 14+** with **PostGIS 3.3+**
- **Firebase 프로젝트** (Authentication, Firestore, Storage 활성화)

### 1. 저장소 클론 및 의존성 설치
```bash
git clone https://github.com/your-username/OpenImjang.git
cd OpenImjang

# Bun 권장 (더 빠름)
bun install
```

### 2. 환경 변수 설정

#### Frontend (.env.local)
```bash
# apps/web/.env.local
VITE_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

#### Backend (.env)
```bash
# apps/bff/.env
DATABASE_URL=postgresql://username:password@localhost:5432/openimjang
OPENAI_API_KEY=your_openai_api_key
RTMS_API_KEY=your_molit_rtms_api_key
KAKAO_REST_KEY=your_kakao_rest_api_key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 3. 데이터베이스 설정
```bash
# PostgreSQL + PostGIS 설치 (Ubuntu)
sudo apt-get install postgresql postgresql-contrib postgis

# 데이터베이스 생성
createdb openimjang
psql -d openimjang -c "CREATE EXTENSION postgis;"

# 스키마 생성
psql -d openimjang -f db/scripts/SQLquery/oi.query.sql
```

### 4. 개발 서버 실행
```bash
# BFF 서버 실행 (포트 3000)
cd apps/bff && bun run dev

# 프론트엔드 서버 실행 (포트 5173)
cd apps/web && npm run dev
```

## 📊 데이터베이스 스키마

### 부동산 데이터 테이블

#### `oi.apt_info` - 아파트 기본 정보
```sql
CREATE TABLE oi.apt_info (
    id SERIAL PRIMARY KEY,
    apt_nm VARCHAR(200),                 -- 아파트명
    jibun_address TEXT,                  -- 지번주소  
    road_address TEXT,                   -- 도로명주소
    lat DOUBLE PRECISION,                -- 위도 (WGS84)
    lon DOUBLE PRECISION,                -- 경도 (WGS84)
    geom GEOMETRY(POINT, 4326),          -- PostGIS 포인트
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_apt_info_geom ON oi.apt_info USING GIST(geom);
```

#### `oi.apt_deal_trade_raw` - 매매 실거래 원시 데이터
공공데이터포털 RTMS API에서 수집한 아파트 매매 실거래 원시 데이터
```sql
CREATE TABLE oi.apt_deal_trade_raw (
    id SERIAL PRIMARY KEY,
    sggCd VARCHAR(5),                        -- 시군구코드
    umdCd VARCHAR(5),                        -- 읍면동코드  
    landCd VARCHAR(1),                       -- 토지구분코드
    bonbun VARCHAR(4),                       -- 본번
    bubun VARCHAR(4),                        -- 부번
    aptNm VARCHAR(40),                       -- 아파트명
    jibun VARCHAR(10),                       -- 지번
    excluUseAr DOUBLE PRECISION,             -- 전용면적(㎡)
    dealYear INTEGER,                        -- 계약년도
    dealMonth INTEGER,                       -- 계약월
    dealDay INTEGER,                         -- 계약일
    dealAmount INTEGER,                      -- 거래금액(만원)
    floor INTEGER,                           -- 층수
    buildYear INTEGER,                       -- 건축년도
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `oi.apt_deal_rent_raw` - 전월세 실거래 원시 데이터
공공데이터포털 RTMS API에서 수집한 아파트 전월세 실거래 원시 데이터
```sql
CREATE TABLE oi.apt_deal_rent_raw (
    id SERIAL PRIMARY KEY,
    sggCd VARCHAR(5),                        -- 시군구코드
    umdNm VARCHAR(20),                       -- 읍면동명
    aptNm VARCHAR(40),                       -- 아파트명
    jibun VARCHAR(10),                       -- 지번
    excluUseAr DOUBLE PRECISION,             -- 전용면적(㎡)
    dealYear INTEGER,                        -- 계약년도
    dealMonth INTEGER,                       -- 계약월
    dealDay INTEGER,                         -- 계약일
    deposit INTEGER,                         -- 보증금(만원)
    monthlyRent INTEGER,                     -- 월세(만원)
    floor INTEGER,                           -- 층수
    buildYear INTEGER,                       -- 건축년도
    contractTerm VARCHAR(10),                -- 계약기간
    contractType VARCHAR(10),                -- 계약구분
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `oi.apt_deal_all` - 통합 실거래 분석 테이블
매매/전월세 데이터를 통합하여 분석에 최적화된 형태로 정규화한 테이블
```sql
CREATE TABLE oi.apt_deal_all (
    id SERIAL PRIMARY KEY,
    apt_nm VARCHAR(40),                      -- 아파트명
    jibun_address VARCHAR(50),               -- 지번주소 (매핑용)
    deal_year INTEGER,                       -- 계약년도
    deal_month INTEGER,                      -- 계약월  
    deal_day INTEGER,                        -- 계약일
    deal_amount INTEGER,                     -- 매매가(만원) - 매매거래시만
    deposit INTEGER,                         -- 보증금(만원) - 전월세거래시
    monthly_rent INTEGER,                    -- 월세(만원) - 월세거래시
    exclu_use_ar DOUBLE PRECISION,           -- 전용면적(㎡)
    floor INTEGER,                           -- 층수
    build_year INTEGER,                      -- 건축년도
    deal_type VARCHAR(10),                   -- 거래유형(매매/전세/월세)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 성능 최적화 인덱스
CREATE INDEX idx_apt_deal_all_name_addr ON oi.apt_deal_all(apt_nm, jibun_address);
CREATE INDEX idx_apt_deal_all_date ON oi.apt_deal_all(deal_year DESC, deal_month DESC, deal_day DESC);
CREATE INDEX idx_apt_deal_all_type ON oi.apt_deal_all(deal_type);
```

### 데이터 수집 및 처리 플로우

#### 1. 원시 데이터 수집
- `fetch_trade_raw.ts` - 매매 실거래 데이터 수집 → `oi.apt_deal_trade_raw`
- `fetch_rent_raw.ts` - 전월세 실거래 데이터 수집 → `oi.apt_deal_rent_raw`

#### 2. 데이터 통합 및 정규화  
- ETL 스크립트를 통해 raw 테이블들을 `oi.apt_deal_all`로 통합
- 거래 유형 분류 및 데이터 품질 향상
- 성능 최적화를 위한 인덱스 생성

#### 3. AI 분석 활용
- 챗봇 Function Calling에서 `oi.apt_deal_all` 테이블 조회
- 거래 유형별(매매/전세/월세) 필터링
- 면적별, 기간별 실거래가 분석

### 건축물 정보 테이블

#### `oi.apt_building_info` - 건축물 정보
```sql
CREATE TABLE oi.apt_building_info (
    id SERIAL PRIMARY KEY,
    apt_id INTEGER REFERENCES oi.apt_info(id),
    type VARCHAR(10),                    -- 'recap'(총괄표제부) / 'title'(표제부)
    dongnm VARCHAR(100),                 -- 동명
    platarea NUMERIC(12, 2),             -- 대지면적(㎡)
    archarea NUMERIC(12, 2),             -- 건축면적(㎡)
    totarea NUMERIC(12, 2),              -- 연면적(㎡)
    grndflrcnt INTEGER,                  -- 지상층수
    ugrndflrcnt INTEGER,                 -- 지하층수
    mainpurpscdnm VARCHAR(100),          -- 주용도명
    strctcdnm VARCHAR(100),              -- 구조명 
    hhldcnt INTEGER,                     -- 세대수
    totpkngcnt INTEGER,                  -- 총주차대수
    useaprday DATE,                      -- 사용승인일
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 공간 데이터 테이블

#### `public.al_d002_11_20250804` - 연속지적도
```sql
-- 국가공간정보포털 연속지적도 데이터
CREATE TABLE public.al_d002_11_20250804 (
    objectid INTEGER PRIMARY KEY,
    a1 VARCHAR(19),                      -- PNU (부동산고유번호)
    a2 VARCHAR(10),                      -- 법정동코드
    a3 VARCHAR(10),                      -- 지목코드
    geom GEOMETRY(POLYGON, 5186)         -- 지적경계 (EPSG:5186)
);

CREATE INDEX idx_al_d002_geom ON public.al_d002_11_20250804 USING GIST(geom);
CREATE INDEX idx_al_d002_pnu ON public.al_d002_11_20250804 (a1);
```

#### `public.al_d154_11_20250830` - 토지이용계획
```sql
-- 용도지역지구 정보
CREATE TABLE public.al_d154_11_20250830 (
    objectid INTEGER PRIMARY KEY,
    a7 TEXT,                             -- 용도지역코드 (쉼표 구분)
    a9 TEXT,                             -- 포함상태코드 (쉼표 구분)
    geom GEOMETRY(POLYGON, 5186)         -- 용도지역 경계
);

CREATE TABLE public.landuse_code (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100),                   -- 용도지역명
    category VARCHAR(50)                 -- 상위분류
);
```

#### `oi.ai_smart_summary` - AI 요약 결과 저장
```sql
CREATE TABLE oi.ai_smart_summary (
    apt_id INTEGER PRIMARY KEY,          -- 아파트 ID (외래키)
    apt_nm VARCHAR(255) NOT NULL,        -- 아파트명  
    jibun_address TEXT NOT NULL,         -- 지번 주소
    summary TEXT NOT NULL,               -- AI 요약 내용
    user_id VARCHAR(255) NOT NULL,       -- 사용자 ID (Firebase UID)
    created_at TIMESTAMP DEFAULT NOW(),  -- 생성일시
    updated_at TIMESTAMP DEFAULT NOW(),  -- 수정일시
    FOREIGN KEY (apt_id) REFERENCES oi.apt_info(id)
);

CREATE INDEX idx_ai_summary_user_id ON oi.ai_smart_summary(user_id);
CREATE INDEX idx_ai_summary_created_at ON oi.ai_smart_summary(created_at);
```

### 사용자 데이터 (Firebase Firestore)

#### `users/{uid}/profile/basic` - 사용자 프로필 (온보딩 결과)
```javascript
{
  purpose: ["매매", "전세"],       // 부동산 이용 목적 (다중선택)
  familyType: "신혼부부 (자녀 없음)",  // 가족 구성
  workLocation: "강남역",          // 직장/주요 목적지 (선택)
  commutingRadius: 30,             // 희망 통근시간(분)
  budgetRange: 300000000,          // 전월세 보증금/매매 자금 (원 단위)
  monthlyRent: 1500000,            // 월세 금액 (원 단위)
  preferredBuildingAge: "10년 이내", // 선호 건물 연식
  priorities: ["교통 접근성", "생활 편의시설"], // 우선순위 (다중선택)
  completedAt: Timestamp           // 온보딩 완료일시
}
```

#### `users/{uid}/favorites` - 즐겨찾기
```javascript
{
  aptId: 12345,                    // 아파트 ID (참조)
  aptName: "래미안강남힐스",         // 아파트명
  aptAddress: "서울 강남구...",      // 주소
  lat: 37.4979,                    // 위도
  lon: 127.0276,                   // 경도  
  createdAt: Timestamp             // 생성일시
}
```

#### `users/{uid}/memos` - 임장 메모
```javascript
{
  aptId: "12345",                  // 아파트 ID
  title: "강남 래미안 방문 후기",   // 제목
  body: "교통이 편리하고...",       // 내용
  photoUrl: "gs://bucket/...",     // 사진 URL (선택)
  createdAt: Timestamp,            // 생성일시
  updatedAt: Timestamp             // 수정일시
}
```

## 🔍 주요 API 엔드포인트

### 부동산 검색 API
```typescript
// 아파트 검색
GET /api/search?q={아파트명 또는 주소}

// 좌표 기반 최근접 검색
GET /api/search/nearest?lat={위도}&lng={경도}

// 실거래가 조회
GET /api/search/deals/{aptId}?dealType={매매|전세|월세}&area={면적}

// 전용면적 목록
GET /api/search/areas/{aptId}

// 건물 정보 조회  
GET /api/search/building-info/{aptId}

// PNU(부동산고유번호) 조회
GET /api/search/pnu/{aptId}

// 토지이용계획 조회
GET /api/search/landuse/{aptId}

// 주변 정보 조회
GET /api/search/nearby?lat={위도}&lon={경도}&radius={반경}
```

### AI 분석 API
```typescript
// AI 종합 분석 (로그인 필요)
POST /api/ai/analyze
{
  "type": "apartment_summary",
  "data": {
    "aptInfo": { "name": "...", "address": "...", "lat": 37.5, "lon": 127.0 },
    "deals": [...],      // 실거래가 데이터
    "building": {...},   // 건물 정보  
    "nearby": {...}      // 주변 정보
  },
  "prompt": "종합 분석 요청 프롬프트"
}

// AI 채팅봇 (로그인 필요)
POST /api/ai/chat  
{
  "message": "이 아파트 투자 가치는?",
  "aptId": 12345,
  "chatHistory": [...]
}

// 🆕 AI Function Calling API - 모듈형 핸들러 시스템
GET /api/ai/tools                    // 사용 가능한 AI 함수 목록 조회 (20개)
GET /api/ai/tools/{functionName}     // 특정 함수 스키마 조회
POST /api/ai/tools/{functionName}    // AI 함수 실행 (Ajv 파라미터 검증)

// 예시: 부동산 함수 호출
POST /api/ai/tools/searchRealEstateDeals
{
  "apartmentName": "래미안",
  "dealType": "매매",
  "area": 84.5
}

// 예시: 지리정보 함수 호출
POST /api/ai/tools/geocodeAddress
{
  "address": "서울특별시 강남구 테헤란로 123"
}
```

## 🎯 핵심 기능

### 🤖 AI 임장 도우미 - 차세대 모듈형 Function Calling 시스템

OpenImjang의 AI 시스템은 **OpenAI Function Calling**과 **모듈형 아키텍처**를 기반으로 설계된 차세대 부동산 분석 플랫폼입니다.

#### 🏗️ 아키텍처 개요

```mermaid
graph TB
    subgraph "AI Frontend Layer"
        A[AI 채팅봇] --> B[Function Calling Router]
        C[AI 분석 패널] --> B
    end
    
    subgraph "AI Backend - Modular Function System"
        B --> D[AI Tools API Router<br/>/api/ai/tools]
        D --> E[Ajv Parameter Validation<br/>JSON Schema 검증]
        E --> F[Dynamic Handler Import<br/>동적 모듈 로딩]
        
        F --> G[부동산 함수군<br/>12개 함수]
        F --> H[지리정보 함수군<br/>8개 함수]
        
        subgraph "RealEstate Handlers"
            G1[searchRealEstateDeals] --> R1[dealsRepo.ts]
            G2[getLatestTrade] --> R1
            G3[getPriceTrends] --> R1
            G4[getDealStatsSummary] --> R1
            G5[getDealDistribution] --> R1
            G --> G1 & G2 & G3 & G4 & G5
        end
        
        subgraph "Geo Handlers" 
            H1[geocodeAddress] --> R2[geoRepo.ts]
            H2[reverseGeocode] --> R2
            H3[getNearbyByCoords] --> R2
            H4[transformCoordinates] --> R2
            H --> H1 & H2 & H3 & H4
        end
        
        subgraph "Repository Layer"
            R1 --> I[Kysely ORM]
            R2 --> J[외부 API 통합<br/>V-World, 카카오, 공공데이터]
            I --> K[PostGIS Database]
            J --> L[External APIs]
        end
    end
    
    style A fill:#61dafb
    style D fill:#10a37f
    style E fill:#f39c12
    style G fill:#e74c3c
    style H fill:#3498db
    style R1 fill:#9b59b6
    style R2 fill:#2ecc71
```

#### 🔧 핵심 기술 구성요소

##### 1. **모듈형 Function Handler 시스템**
```typescript
// 동적 핸들러 로딩 (apps/bff/src/ai/handlers/index.ts)
export const handlers: ToolHandlers = {
  searchRealEstateDeals: async (args) => {
    const { searchRealEstateDeals } = await import('./searchRealEstateDeals');
    return searchRealEstateDeals(args);
  },
  geocodeAddress: async (args) => {
    const { geocodeAddress } = await import('./geo/geocodeAddress');
    return geocodeAddress(args);
  },
  // 총 20개 함수 - 필요시에만 동적 로딩
};
```

##### 2. **Ajv 기반 파라미터 검증 파이프라인**
```typescript
// JSON Schema 실시간 검증 (apps/bff/src/ai/tools/validation.ts)
export function validateOrThrow(schema: ToolSchema, data: unknown): void {
  const validate = ajv.compile(schema.parameters);
  const isValid = validate(data);
  
  if (!isValid) {
    const errors = validate.errors || [];
    const errorMessages = errors.map(err => 
      `${err.instancePath}: ${err.message}`
    );
    throw new ValidationError(`파라미터 검증 실패: ${errorMessages.join(', ')}`);
  }
}
```

##### 3. **Repository Pattern 기반 데이터 접근**
- **`dealsRepo.ts`**: 부동산 거래 데이터 전문 레포지토리
  - PostGIS 공간 쿼리 최적화
  - 복잡한 집계 함수 (트렌드 분석, 통계 요약, 분포 분석)
  - Kysely ORM으로 타입 안전 SQL 쿼리

- **`geoRepo.ts`**: 지리정보 서비스 통합 레포지토리  
  - V-World API: 정부 지리정보 (지오코딩 1차 우선)
  - 카카오 지도 API: 상용 지리정보 (Fallback)
  - 공공데이터포털: 법정동 코드 조회
  - proj4.js: 좌표계 변환 (WGS84/GRS80/KATEC/TM 지원)

#### 📋 Function Catalog - 총 20개 함수

##### **부동산 분석 함수군 (12개)**
1. **`searchRealEstateDeals`** - 실거래 데이터 검색
   - 아파트명/ID 기반 거래 내역 조회
   - 매매/전세/월세 유형별 필터링
   - 면적별 거래가 분석 (±5㎡ 허용오차)

2. **`getLatestTrade`** - 최신 거래 내역
   - 시간순 정렬된 최근 거래 Top N
   - 거래 유형별 최신 동향 파악

3. **`getPriceTrends`** - 가격 트렌드 분석  
   - 월별/분기별 평균 거래가 추이
   - 상승/하락률 계산 및 안정성 점수
   - 전월 대비 변화율 상세 분석

4. **`getDealStatsSummary`** - 거래 통계 요약
   - 평균/최저/최고 거래가
   - 거래량 및 유형별 분포
   - 한국어 통화 포맷팅 (만원→억/천만원)

5. **`getDealDistribution`** - 거래 분포 분석
   - 가격대별 히스토그램 (5천만원 단위)
   - 면적별 분포 (10㎡ 단위)  
   - 층별 분포 (5층 단위)

6. **`getBuildingInfo`** - 건축물 상세 정보
7. **`searchNearbyPOI`** - 주변 편의시설 검색
8. **`compareMultipleApartments`** - 다중 아파트 비교
9. **`findSimilarApartments`** - 유사 아파트 추천
10. **`searchDealsByFilters`** - 복합 조건 검색 (구현 예정)
11. **`getComparableSales`** - 비교 거래 사례 (구현 예정)  
12. **`estimateRentYield`** - 임대 수익률 계산 (구현 예정)

##### **지리정보 함수군 (8개) - 🆕 새로 구현**
1. **`geocodeAddress`** - 주소→좌표 변환
   ```json
   // V-World API 1차, 카카오 API Fallback
   {
     "coordinates": { "longitude": 127.031, "latitude": 37.499 },
     "confidence": 0.9,
     "source": "VWorld"
   }
   ```

2. **`reverseGeocode`** - 좌표→주소 변환
   ```json
   {
     "addresses": {
       "roadAddress": "서울특별시 강남구 테헤란로 123",  
       "jibunAddress": "서울특별시 강남구 역삼동 123-45"
     }
   }
   ```

3. **`lookupLegalDongCode`** - 법정동 코드 조회
   ```json
   {
     "legalDongInfo": {
       "code": "1168010100",
       "name": "서울특별시 강남구 역삼동"
     }
   }
   ```

4. **`convertDongCode`** - 법정동↔행정동 변환
5. **`getNearbyByCoords`** - 좌표 기반 POI 검색
6. **`isochroneSearch`** - 등시간대 접근성 분석
7. **`transformCoordinates`** - 좌표계 변환 (proj4.js)
8. **`normalizeKoreanAddress`** - 한국 주소 정규화

#### 🛡️ 안전성 및 성능 최적화

##### **파라미터 검증**
- **Ajv JSON Schema**: OpenAI Function Calling 스펙 완전 준수
- **타입 안전성**: TypeScript 인터페이스와 스키마 일치성 검증  
- **에러 처리**: 한국어 에러 메시지 및 상세 제안사항

##### **성능 최적화**
- **동적 Import**: 사용되는 핸들러만 런타임 로딩
- **Repository 캐싱**: 외부 API 응답 5-30분 캐시 
- **Connection Pooling**: Kysely + PostgreSQL 연결 풀 최적화

##### **Fallback 전략**
- **API 다중화**: 1차 실패시 2차 API 자동 전환
- **Mock 응답**: 외부 API 장애시 기본 응답 제공
- **Graceful Degradation**: 부분 실패시에도 가용한 데이터 반환

#### 🔄 확장 가능한 설계

새로운 AI 함수 추가는 다음 4단계로 완성됩니다:

```typescript
// 1. 스키마 정의 (apps/bff/src/ai/schemas/)
export const newFunctionSchema: ToolSchema = {
  name: "newFunction",
  description: "새로운 기능 설명",
  parameters: { /* JSON Schema */ }
}

// 2. 핸들러 구현 (apps/bff/src/ai/handlers/)
export async function newFunction(args: NewFunctionParams) {
  // 비즈니스 로직 구현
}

// 3. 핸들러 등록 (handlers/index.ts)
newFunction: async (args) => {
  const { newFunction } = await import('./newFunction');
  return newFunction(args);
}

// 4. 스키마 등록 (tools/index.ts)
export { newFunctionSchema } from '../schemas/newFunction.schema';
```

이 모듈형 설계로 **무한 확장 가능한 AI 부동산 분석 플랫폼**을 구축했습니다.

### 🗺️ 인터랙티브 지도
- **2D/3D 통합**: 카카오맵 + Cesium 3D 지구본
- **다층 시각화**: 지적편집도, 용도지역, 건물군 오버레이
- **실시간 마커**: 즐겨찾기, 검색 결과, 임시 마커
- **공간 분석**: 반경 검색, 최근접 아파트 찾기

### 📊 부동산 데이터 분석
- **실거래가 조회**: 최근 1년 거래 내역 (무제한)
- **거래 유형별 필터**: 매매/전세/월세 분류
- **면적별 분석**: 전용면적별 가격 동향
- **건물 정보**: 건축물대장 기반 상세 정보
- **주변 환경**: 교통, 교육, 편의시설 정보

### 👤 개인화 서비스
- **Firebase 인증**: 구글 OAuth 간편 로그인
- **스마트 온보딩**: 6단계 맞춤 설정 프로세스
  - 부동산 이용 목적 (매매/전세/월세/투자)
  - 가족 구성 및 라이프스타일 설정
  - 통근 시간 및 교통 접근성 고려사항
  - **자금 범위 설정**: 단계별 슬라이더 UI
    - 전월세 보증금/매매 자금: 0원~50억원 (가변 단위)
    - 월세 금액: 0원~1000만원 (세밀한 단위 조절)
  - 건물 연식 및 시설 선호도
  - 우선순위 (교통/학군/편의시설/투자가치 등)
- **임장 메모**: 현장 방문 후기 작성 (사진 포함)
- **즐겨찾기**: 관심 아파트 북마크 및 지도 표시
- **클라우드 동기화**: 모든 데이터 자동 백업

### 🎨 모던 UI/UX
- **반응형 디자인**: 모바일/태블릿/데스크톱 최적화
- **다크 모드 지원**: 사용자 선호도 반영 (향후 추가)
- **직관적 네비게이션**: 탭 기반 정보 구조
- **실시간 피드백**: 로딩 상태, 에러 처리
- **통합 브랜드 컬러**: #14e3dc 민트 그린 테마



## 🔒 보안 고려사항

### 인증 및 권한
- **Firebase Authentication**: 구글 OAuth 2.0 인증
- **JWT 토큰**: 자동 갱신 및 만료 처리
- **API 미들웨어**: 모든 민감한 API에 인증 필수
- **CORS 설정**: 허용된 도메인만 접근 가능

### 데이터 보호
- **환경 변수 관리**: 민감한 키는 서버사이드만 저장
- **SQL Injection 방지**: Kysely ORM 파라미터 바인딩
- **XSS 방지**: React 기본 이스케이프 + 추가 검증
- **HTTPS 강제**: Production 환경에서 SSL/TLS 필수

## 🧪 테스트 전략

### API 테스트
```bash
# BFF API 통합 테스트
bun test apps/bff/src/**/*.test.ts

# 데이터베이스 연결 테스트  
bun test apps/bff/src/lib/db.test.ts
```

### E2E 테스트 (계획)
```bash
# Playwright 기반 브라우저 테스트
npm run test:e2e

# 지도 인터랙션 테스트
npm run test:map
```

## 🔄 AI 시스템 검증 및 배포

### Part 3: OpenAI Assistant 동기화 검증
```bash
# 로컬 스키마와 OpenAI Assistant 일치성 검사
bun run validate:assistant-tools

# 환경변수 설정 필요
OPENAI_API_KEY=your_key_here
OPENAI_ASSISTANT_ID=asst_your_assistant_id
```

**검증 항목:**
- ✅ 로컬 20개 함수 vs Assistant 함수 이름 매칭
- ✅ JSON Schema 구조 deep-equal 비교  
- ✅ 파라미터 타입/enum 일치성 검사
- ✅ description 텍스트 동일성 확인

### Part 4: 모듈형 채팅 시스템
```bash
# 새로운 표준 패턴 Chat API 테스트
curl -X POST http://localhost:8787/api/ai-new/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "서울 강남의 아파트 가격 동향을 알려주세요"}'
```

**핵심 개선사항:**
- **인라인 도구 제거**: 모든 function 정의를 `tools/` 모듈로 이동
- **표준 Tool Call 루프**: Ajv 검증 → Handler 실행 → Tool 피드백 → 재호출
- **무한루프 방지**: 최대 6회 제한, guard 카운터
- **책임 분리**: 대화 orchestration vs 비즈니스 로직 분리
- **에러 표준화**: `{success: false, error}` 구조로 모델 이해도 향상

### 배포 전 체크리스트
```bash
# 1. 스키마 동기화 확인
bun run validate:assistant-tools

# 2. 타입 검사
bun run typecheck  

# 3. 개발 서버 재시작
bun run dev

# 4. API 응답 테스트
curl -X POST localhost:8787/api/ai/tools/getPriceTrends \
  -H "Content-Type: application/json" \
  -d '{"aptId": 123, "period": "1년"}'
```

## 📈 로드맵

### ✅ 완료된 기능
- **기본 지도 시스템**: 카카오맵 + 3D Cesium 통합
- **부동산 검색**: 실시간 아파트 검색 및 필터링
- **실거래가 조회**: 국토부 데이터 연동
- **Firebase 인증**: 구글 로그인 시스템
- **스마트 온보딩**: 6단계 사용자 맞춤 설정
  - 단계별 자금 범위 슬라이더 (가변 단위 지원)
  - 매매/전세/월세 목적별 세분화
- **임장 메모 시스템**: 사진 포함 메모 작성
- **AI 분석 도우미**: OpenAI 기반 종합 분석
- **즐겨찾기 시스템**: 클라우드 동기화 북마크

### 🚧 개발 중
- **모바일 최적화**: PWA 지원 및 모바일 UX 개선
- **고급 필터링**: 가격대, 면적, 건축연도 다중 필터
- **가격 알림**: 실시간 시세 변동 알림 서비스

### 📋 계획된 기능
- **소셜 기능**: 임장 후기 공유 및 커뮤니티
- **포트폴리오**: 투자 아파트 관리 도구  
- **머신러닝 예측**: 가격 동향 예측 모델
- **오픈 API**: 외부 개발자용 API 제공





**OpenImjang**은 AI 기술을 활용하여 부동산 투자 의사결정을 돕는 오픈소스 플랫폼입니다. 
투명하고 접근 가능한 부동산 정보 제공을 통해 더 나은 투자 환경을 만들어갑니다. 🏠✨