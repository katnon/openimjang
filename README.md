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
│   │   │   └── routes/
│   │   │       ├── ai.ts            # 🆕 OpenAI API 라우트
│   │   │       ├── search.ts        # 부동산 검색 API
│   │   │       ├── poi.ts           # POI(관심지점) API
│   │   │       └── geo/
│   │   │           ├── buildings.ts # 건물 정보 API
│   │   │           └── upis.ts      # 지적 정보 API
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
CREATE INDEX idx_apt_info_name ON oi.apt_info (apt_nm);
```

#### `oi.apt_deal_all` - 통합 거래 데이터
```sql
CREATE TABLE oi.apt_deal_all (
    id SERIAL PRIMARY KEY,
    apt_nm VARCHAR(100),                 -- 아파트명
    jibun_address TEXT,                  -- 지번주소
    exclu_use_ar NUMERIC(10, 4),         -- 전용면적(㎡)
    deal_year INTEGER,                   -- 거래년도
    deal_month INTEGER,                  -- 거래월
    deal_day INTEGER,                    -- 거래일
    deal_amount BIGINT,                  -- 매매가격(만원)
    deposit BIGINT,                      -- 보증금(만원) 
    monthly_rent INTEGER,                -- 월세(만원)
    floor INTEGER,                       -- 층
    build_year INTEGER,                  -- 건축년도
    deal_type VARCHAR(10),               -- 거래유형 (매매/전세/월세)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_apt_deal_all_apt_nm ON oi.apt_deal_all (apt_nm);
CREATE INDEX idx_apt_deal_all_date ON oi.apt_deal_all (deal_year, deal_month);
```

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
```

## 🎯 핵심 기능

### 🤖 AI 임장 도우미
- **종합 분석**: 실거래가, 건물정보, 주변환경을 AI가 통합 분석
- **채팅봇**: 부동산 관련 질의응답 (컨텍스트 유지)
- **개인화**: 사용자의 임장 메모와 선호도 반영

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

## 📈 로드맵

### ✅ 완료된 기능
- **기본 지도 시스템**: 카카오맵 + 3D Cesium 통합
- **부동산 검색**: 실시간 아파트 검색 및 필터링
- **실거래가 조회**: 국토부 데이터 연동
- **Firebase 인증**: 구글 로그인 시스템
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