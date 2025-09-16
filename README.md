# 오픈임장 (OpenImjang) 🏠

**온라인 임장 플랫폼** - AI 기반 실시간 부동산 분석 및 공간정보 시각화 서비스

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb)](https://reactjs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.4-orange)](https://hono.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.2-black)](https://bun.sh/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-green)](https://openai.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-15-blue)](https://postgis.net/)
[![Firebase](https://img.shields.io/badge/Firebase-12.2-yellow)](https://firebase.google.com/)

## 🎯 프로젝트 개요

오픈임장은 부동산 투자자와 실수요자를 위한 AI 기반 온라인 임장 플랫폼입니다. 실시간 부동산 데이터 분석, 2D/3D 공간 시각화, 그리고 지능형 챗봇을 통해 효율적인 부동산 의사결정을 지원합니다.

### ✨ 핵심 기능

- 🗺️ **2D/3D 지도 시각화** - Kakao Maps 2D + MapPrime3D/Cesium 3D 뷰어
- 🤖 **AI 챗봇 상담** - GPT-4o-mini 기반 멀티모달 부동산 상담
- 📊 **실시간 데이터 분석** - 170만+ 실거래가 데이터 기반 시장 분석
- 📝 **임장 메모 시스템** - 현장 방문 기록 및 사진 관리
- 🎯 **개인화 추천** - 사용자 프로필 기반 맞춤형 아파트 추천
- 🔍 **공간 검색** - PostGIS 기반 지리적 범위 검색 및 필터링

## 🏗️ 아키텍처

### 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 Frontend Layer                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │   React 19 SPA  │ │  Kakao Maps 2D  │ │ MapPrime3D/     │ │
│  │   + Vite        │ │  시각화         │ │ Cesium 3D       │ │
│  │   + TypeScript  │ │                 │ │ 뷰어            │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   🔒 Middleware Layer                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  Rate Limiter   │ │   CORS Policy   │ │    Logging      │ │
│  │   요청 제한     │ │   보안 정책     │ │   구조화 로깅   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              🚀 Backend Layer (Hono BFF)                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  AI Chat        │ │  Search API     │ │  Auth/Profile   │ │
│  │  Router         │ │  Router         │ │  Router         │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ Simple LLM      │ │ Apartment       │ │ Memo            │ │
│  │ Processor       │ │ Resolver        │ │ Service         │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    🗄️ Data Layer                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ PostgreSQL +    │ │  Firebase       │ │   OpenAI        │ │
│  │ PostGIS         │ │  Firestore      │ │   API           │ │
│  │ 공간 데이터베이스│ │  인증/메모      │ │   GPT-4o-mini   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 기술 스택

**Frontend**
- **Framework**: React 19 with Concurrent Features
- **Build Tool**: Vite 7.1
- **Language**: TypeScript 5.8
- **Styling**: TailwindCSS 3.4
- **Maps**: Kakao Maps JS SDK, MapPrime3D/Cesium
- **Routing**: React Router 7.8

**Backend**
- **Runtime**: Bun 1.2 (3-4x faster than Node.js)
- **Framework**: Hono 4.4 (ultrafast web framework)
- **Language**: TypeScript 5.8
- **ORM**: Kysely (type-safe SQL query builder)
- **Documentation**: Swagger/OpenAPI

**Database & Storage**
- **Primary DB**: PostgreSQL 15 + PostGIS (SRID 4326)
- **NoSQL**: Firebase Firestore (사용자 데이터, 메모)
- **Auth**: Firebase Authentication
- **Vector Store**: pgvector extension (AI embeddings)

**AI & External APIs**
- **LLM**: OpenAI GPT-4o-mini
- **Spatial Data**: VWorld WMS API
- **Search**: Google Custom Search

## 📂 프로젝트 구조

```
OpenImjang/
├── 📁 apps/                           # 애플리케이션 모노레포
│   ├── 📁 bff/                        # Backend for Frontend
│   │   ├── 📁 src/
│   │   │   ├── 📁 routes/             # API 라우터
│   │   │   │   ├── aiChat.ts          # AI 챗봇 라우터
│   │   │   │   ├── chatBot.ts         # 멀티모달 챗봇
│   │   │   │   ├── simpleAI.ts        # Simple LLM 시스템
│   │   │   │   ├── aiSummary.ts       # 확장카드 아파트 종합 분석
│   │   │   │   ├── search.ts          # 아파트 검색 API
│   │   │   │   ├── memo.ts            # 임장 메모 API
│   │   │   │   ├── presetPoints.ts    # 프리셋 포인트 관리
│   │   │   │   └── upload.ts          # 파일 업로드
│   │   │   ├── 📁 services/           # 비즈니스 로직
│   │   │   │   ├── llmMaster.ts       # LLM 라이프사이클 관리
│   │   │   │   ├── simpleLLMProcessor.ts # Simple LLM 프로세서
│   │   │   │   ├── apartmentSummaryService.ts # 확장카드 종합 분석
│   │   │   │   ├── smartApartmentResolver.ts # 아파트명 해석
│   │   │   │   ├── conversationSession.ts # 대화 세션 관리
│   │   │   │   ├── embeddingService.ts # 벡터 임베딩
│   │   │   │   └── apartmentContextManager.ts # 아파트 컨텍스트
│   │   │   ├── 📁 ai/                 # AI 핸들러
│   │   │   │   ├── 📁 handlers/       # Function Calling 핸들러
│   │   │   │   └── 📁 planner/        # AI 작업 계획
│   │   │   ├── 📁 utils/              # 유틸리티
│   │   │   │   ├── webSearchService.ts # 웹 검색 서비스
│   │   │   │   └── safeBinaryJsonParser.ts # 한글 인코딩 처리
│   │   │   └── index.ts               # 서버 엔트리포인트
│   │   └── package.json               # BFF 의존성
│   └── 📁 web/                        # React 프론트엔드
│       ├── 📁 src/
│       │   ├── 📁 components/         # React 컴포넌트
│       │   │   ├── 📁 map/            # 지도 관련
│       │   │   │   ├── MapContainer.tsx # 메인 지도 컨테이너
│       │   │   │   ├── PointInputModal.tsx # 포인트 입력
│       │   │   │   └── MapControls.tsx # 지도 컨트롤
│       │   │   ├── MapPrime3DViewer.tsx # 3D 지도 뷰어
│       │   │   ├── 📁 chatbot/        # AI 챗봇 UI
│       │   │   ├── 📁 card/           # 아파트 카드
│       │   │   │   └── RealEstateDealsTable.tsx # 실거래가 테이블
│       │   │   ├── 📁 memo/           # 임장 메모
│       │   │   ├── 📁 auth/           # 인증 관련
│       │   │   ├── 📁 onboarding/     # 사용자 온보딩
│       │   │   └── 📁 layout/         # 레이아웃
│       │   ├── 📁 pages/              # 페이지 컴포넌트
│       │   │   └── Home.tsx           # 메인 홈페이지
│       │   ├── 📁 hooks/              # React 커스텀 훅
│       │   │   ├── useCameraFrustum.ts # 카메라 프러스텀
│       │   │   ├── useMiniMapPopup.tsx # 미니맵 팝업
│       │   │   ├── useNaverMapsLoader.ts # 네이버 지도 로더
│       │   │   └── useNaverStreetView.ts # 스트리트 뷰
│       │   ├── 📁 services/           # API 클라이언트
│       │   ├── 📁 types/              # TypeScript 타입 정의
│       │   ├── 📁 utils/              # 유틸리티 함수
│       │   └── 📁 contexts/           # React 컨텍스트
│       └── package.json               # Web 의존성
├── 📁 db/                             # 데이터베이스 관련
│   ├── 📁 scripts/                    # DB 스크립트
│   └── db_schema_public_oi.sql        # 스키마 정의
├── 📁 docs/                           # 문서
├── 📁 etl/                            # 데이터 ETL 파이프라인
├── 📁 scripts/                        # 프로젝트 스크립트
├── 📁 tools/                          # 개발 도구
├── CLAUDE.md                          # Claude Code 가이드
├── FIREBASE_SETUP_GUIDE.md            # Firebase 설정 가이드
└── package.json                       # 루트 의존성
```

## 🎨 기능 구조 트리

```
🏠 오픈임장 플랫폼
├── 🗺️ 지도 시각화
│   ├── 2D 지도 (Kakao Maps)
│   │   ├── 실시간 아파트 위치 표시
│   │   ├── 클러스터링 마커
│   │   ├── 거리 측정 도구
│   │   └── 레이어 제어 (WMS 오버레이)
│   └── 3D 지도 (MapPrime3D/Cesium)
│       ├── 3차원 건물 모델링
│       ├── 카메라 프러스텀 시각화
│       ├── 프리셋 포인트 시스템
│       │   ├── 특정 동/호수 위치 저장
│       │   ├── 원클릭 카메라 이동
│       │   ├── 프리셋에서 창가뷰 실행
│       │   └── 프리셋에서 음영분석 실행
│       ├── 미니맵 연동
│       └── 네이버 스트리트뷰 통합
│
├── 🤖 AI 챗봇 시스템
│   ├── Simple LLM 시스템
│   │   ├── GPT-4o-mini 기반 자연어 처리
│   │   ├── Few-shot 부동산 도메인 학습
│   │   ├── 한글 인코딩 문제 해결 (6가지 전략)
│   │   └── 웹 검색 연동 (내부 데이터 부족 시)
│   ├── 확장카드 종합 분석 시스템 (NEW)
│   │   ├── ApartmentSummaryService 기반 전문 브리핑
│   │   ├── 실거래가 월별 추이 분석 (매매/전세/월세)
│   │   ├── 건물정보 + 토지이용 + 주변환경 통합 분석
│   │   ├── 1200-1800자 친근한 어조 전문 상담 브리핑
│   │   ├── 데이터 품질 검증 및 근거 기반 분석
│   │   └── DB 저장/조회 (ai_smart_summary 테이블)
│   ├── 멀티모달 처리
│   │   ├── 이미지 + 텍스트 통합 분석
│   │   ├── 임장 메모 사진 첨부
│   │   ├── Base64 이미지 변환
│   │   └── Firebase 이미지 다운로드
│   ├── 컨텍스트 관리
│   │   ├── 세션 기반 대화 연속성 (30분 TTL)
│   │   ├── 슬롯 기반 정보 저장
│   │   ├── @mention 아파트 정보 첨부
│   │   └── 사용자 프로필 연동
│   └── LLM 라이프사이클 관리
│       ├── ConversationSession (대화 상태 관리)
│       ├── LLMMaster (오케스트레이션)
│       ├── SmartApartmentResolver (아파트명 해석)
│       └── AI 3.0 대화 인텔리전스 (6개 매니저)
│
├── 📊 부동산 데이터 분석
│   ├── 실거래가 분석 (170만+ 건)
│   │   ├── 매매/전월세 통합 테이블
│   │   ├── 면적별 시세 분석
│   │   ├── 월별/연도별 트렌드
│   │   └── 지역별 평균가 비교
│   ├── 아파트 정보 관리
│   │   ├── 기본 정보 (apt_info 테이블)
│   │   ├── 건축물 상세 정보 (표제부등본)
│   │   ├── 지번주소 매칭
│   │   └── 좌표 정보 (SRID 4326)
│   └── 공간 검색
│       ├── PostGIS 기반 지리적 범위 검색
│       ├── 반경 내 아파트 검색
│       ├── 행정구역 필터링
│       └── 거리 계산 (Haversine)
│
├── 📝 임장 메모 시스템
│   ├── 메모 작성/편집
│   │   ├── 아파트 연관 메모
│   │   ├── 사진 첨부 (다중 업로드)
│   │   ├── 위치 기반 자동 태깃
│   │   └── 마크다운 렌더링
│   ├── Firebase 연동
│   │   ├── 실시간 메모 동기화
│   │   ├── 이미지 Storage 업로드
│   │   ├── 사용자별 메모 관리
│   │   └── 즐겨찾기 기능
│   └── 메모 첨부 (챗봇 연동)
│       ├── 메모 선택 모달
│       ├── 메타데이터 표시
│       ├── 이미지 자동 다운로드/변환
│       └── 보라색 테마 UI
│
├── 👤 사용자 관리
│   ├── Firebase 인증
│   │   ├── 이메일/비밀번호 로그인
│   │   ├── 소셜 로그인 (구글)
│   │   ├── 익명 로그인 지원
│   │   └── 보안 규칙 설정
│   ├── 사용자 프로필
│   │   ├── 온보딩 설문 (7단계)
│   │   ├── 관심 지역 설정
│   │   ├── 투자 성향 분석
│   │   └── 맞춤형 추천 기준
│   └── 개인화 서비스
│       ├── 관심 아파트 즐겨찾기
│       ├── 검색 히스토리
│       ├── AI 챗봇 학습 데이터
│       └── 알림 설정
│
├── 🔍 검색 & 필터링
│   ├── 아파트 검색
│   │   ├── 텍스트 기반 검색
│   │   ├── 자동완성 기능
│   │   ├── 유사 아파트명 매칭
│   │   └── 지역명 검색 지원
│   ├── 고급 필터
│   │   ├── 가격대 범위 설정
│   │   ├── 전용면적 필터
│   │   ├── 거래 시기 필터
│   │   └── 층수 조건
│   └── 공간 기반 검색
│       ├── 지도 영역 드래그 검색
│       ├── 반경 기반 검색
│       ├── 행정구역 경계 검색
│       └── POI 근처 검색
│
└── ⚙️ 시스템 관리
    ├── API 관리
    │   ├── Rate Limiting (요청 제한)
    │   ├── CORS 정책 설정
    │   ├── 에러 핸들링
    │   └── Swagger 문서화
    ├── 모니터링
    │   ├── 구조화 로깅 (Pino)
    │   ├── 성능 메트릭 수집
    │   ├── AI 응답 품질 추적
    │   └── 사용자 행동 분석
    └── 배포 & 운영
        ├── Bun 런타임 최적화
        ├── PostgreSQL 커넥션 풀링
        ├── Firebase 보안 규칙
        └── 환경별 설정 관리
```

## 🎯 시스템 아키텍처 (Mermaid)

```mermaid
graph TB
    %% 중앙 데이터 허브
    PG[(PostgreSQL<br/>📊 실거래가 170만건<br/>📍 PostGIS 공간데이터<br/>🏗️ 건물정보)]
    FB[(Firebase<br/>🔐 사용자 인증<br/>📝 임장 메모<br/>⭐ 즐겨찾기)]

    %% 4개 주요 시스템
    subgraph "🤖 AI 챗봇 시스템"
        AI[AI 챗봇<br/>ChatbotSidebar]
        AI_LLM[Simple LLM<br/>GPT-4o-mini]
        AI_SUMMARY[확장카드 분석<br/>ApartmentSummaryService]
        AI_RAG[RAG 시스템<br/>pgvector 임베딩]
        AI_ATTACH[첨부 시스템<br/>이미지+메모+멘션]

        AI --> AI_LLM
        AI --> AI_SUMMARY
        AI --> AI_RAG
        AI --> AI_ATTACH
    end

    subgraph "🏠 아파트 카드 시스템"
        CARD[아파트 카드<br/>SummaryCard]
        CARD_DEAL[실거래가<br/>RealEstateDealsTable]
        CARD_BUILD[건물정보<br/>BuildingLandInfo]
        CARD_POI[주변정보<br/>NearbyInfoPanel]
        CARD_AI[AI요약<br/>AiSummaryPanel]
        CARD_PRESET[프리셋포인트<br/>ApartmentPreviewPanel]

        CARD --> CARD_DEAL
        CARD --> CARD_BUILD
        CARD --> CARD_POI
        CARD --> CARD_AI
        CARD --> CARD_PRESET
    end

    subgraph "🗺️ 2D 지도 시각화"
        MAP2D[2D 지도<br/>MapContainer]
        MAP2D_KAKAO[Kakao Maps<br/>기본 지도 엔진]
        MAP2D_CLUSTER[마커 클러스터링<br/>아파트 밀집도]
        MAP2D_POI[POI 오버레이<br/>주변시설 표시]
        MAP2D_FAV[즐겨찾기 핀<br/>사용자 관심지역]

        MAP2D --> MAP2D_KAKAO
        MAP2D --> MAP2D_CLUSTER
        MAP2D --> MAP2D_POI
        MAP2D --> MAP2D_FAV
    end

    subgraph "🌍 3D 지도 시각화"
        MAP3D[3D 지도<br/>MapPrime3DViewer]
        MAP3D_CESIUM[Cesium 엔진<br/>3차원 렌더링]
        MAP3D_PRESET[프리셋 포인트<br/>동호수별 저장위치]
        MAP3D_VIEW[창문뷰/음영분석<br/>실거주 시뮬레이션]
        MAP3D_WALK[워킹모드<br/>보행자 시점]

        MAP3D --> MAP3D_CESIUM
        MAP3D --> MAP3D_PRESET
        MAP3D --> MAP3D_VIEW
        MAP3D --> MAP3D_WALK
    end

    %% 시스템 간 상호작용 (실선: 주요 데이터 흐름, 점선: 이벤트 트리거)

    %% AI 챗봇 ↔ 아파트 카드
    AI -.->|멘션 아파트 첨부| CARD
    AI_SUMMARY -->|종합 분석 결과| CARD_AI

    %% 아파트 카드 ↔ 3D 지도
    CARD_PRESET -.->|프리셋 선택| MAP3D_PRESET
    CARD_PRESET -.->|창문뷰 실행| MAP3D_VIEW
    CARD_PRESET -.->|음영분석 실행| MAP3D_VIEW

    %% 아파트 카드 ↔ 2D 지도
    CARD -.->|아파트 위치 이동| MAP2D
    CARD_POI -->|POI 데이터| MAP2D_POI

    %% 2D 지도 ↔ 아파트 카드
    MAP2D -.->|아파트 클릭| CARD
    MAP2D_FAV <-->|즐겨찾기 동기화| CARD

    %% 3D 지도 ↔ 2D 지도
    MAP3D -.->|카메라 시야 범위| MAP2D
    MAP2D <-->|위치 동기화| MAP3D

    %% 데이터베이스 연결
    PG -->|실거래가 데이터| CARD_DEAL
    PG -->|건물정보 데이터| CARD_BUILD
    PG -->|공간검색 데이터| MAP2D_CLUSTER
    PG -->|프리셋 포인트 데이터| MAP3D_PRESET
    PG -->|AI 분석용 데이터| AI_SUMMARY
    PG -->|RAG 스키마 정보| AI_RAG

    %% Firebase 연결
    FB -->|사용자 메모| AI_ATTACH
    FB -->|즐겨찾기 데이터| MAP2D_FAV
    FB -->|임장 메모 첨부| AI
    FB -->|사용자 인증| AI

    %% 스타일링 (검정색 텍스트로 가독성 향상)
    classDef aiSystem fill:#e8f5e8,stroke:#2e7d32,stroke-width:3px,color:#000000
    classDef cardSystem fill:#fff3e0,stroke:#f57c00,stroke-width:3px,color:#000000
    classDef map2dSystem fill:#e1f5fe,stroke:#0277bd,stroke-width:3px,color:#000000
    classDef map3dSystem fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000000
    classDef dataSystem fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000000

    class AI,AI_LLM,AI_SUMMARY,AI_RAG,AI_ATTACH aiSystem
    class CARD,CARD_DEAL,CARD_BUILD,CARD_POI,CARD_AI,CARD_PRESET cardSystem
    class MAP2D,MAP2D_KAKAO,MAP2D_CLUSTER,MAP2D_POI,MAP2D_FAV map2dSystem
    class MAP3D,MAP3D_CESIUM,MAP3D_PRESET,MAP3D_VIEW,MAP3D_WALK map3dSystem
    class PG,FB dataSystem
```

### 📊 시스템별 상세 설명

#### 🤖 AI 챗봇 시스템
- **멀티모달 분석**: GPT-4o-mini로 텍스트 + 이미지 동시 처리, 임장 메모 사진 분석 지원
- **확장카드 종합 분석**: ApartmentSummaryService로 실거래가/건물/토지/주변환경 통합 분석, 1200-1800자 전문 브리핑 생성
- **RAG 시스템**: pgvector 임베딩으로 정확한 DB 스키마 정보 검색, 컨텍스트 기반 정확한 답변
- **첨부 시스템**: 직접 이미지 업로드 + Firebase 메모 첨부 + @아파트명 멘션으로 풍부한 상담 지원
- **세션 관리**: 30분 TTL 대화 컨텍스트 유지, 연속적인 자연스러운 대화

#### 🏠 아파트 카드 시스템 (통합 정보 허브)
- **실거래가 정보**: 170만+ 건 매매/전월세 데이터, 월별 추이 분석, 면적별 시세 비교
- **건물정보**: 표제부등본 기반 상세 건축 정보, 세대수/주차면수/층수 등 핵심 스펙
- **토지정보**: PNU 연동 토지이용계획, 용도지역 정보, 개발제한구역 확인
- **AI 요약**: 종합 데이터 기반 전문 브리핑, 투자/거주 관점 분석
- **프리셋 포인트**: 특정 동/호수 위치 저장, 3D 지도 연동으로 원클릭 카메라 이동 및 분석 실행
- **POI 정보**: 반경 500m 주변시설 (지하철/학교/병원/상권) 거리별 정보

#### 🗺️ 2D 지도 시각화
- **Kakao Maps 기반**: 정확한 한국 지도 데이터, 위성/일반 지도 전환
- **아파트 마커**: 클러스터링으로 밀집도 시각화, 줌 레벨별 적응형 표시
- **즐겨찾기 핀**: 사용자 관심 아파트 구분 표시, Firebase 실시간 동기화
- **POI 오버레이**: 주변시설 카테고리별 아이콘 표시, 호버 시 상세정보
- **검색 UI**: 반경 드래그 설정, 지역명 자동완성, 실시간 검색 결과

#### 🌍 3D 지도 시각화
- **MapPrime3D/Cesium**: 실제 건물 높이와 형태의 3차원 정확한 렌더링
- **프리셋 포인트**: 동/호수별 정확한 위치 저장, 아파트 카드에서 원클릭 이동
- **창문뷰/음영분석**: 실거주 시뮬레이션, 특정 시간대 일조권 분석, 조망권 확인
- **워킹모드**: 보행자 시점 거리 탐색, 실제 접근성과 주변 환경 체험
- **카메라 시야**: 3D 시점을 2D 미니맵에 실시간 표시, 위치 동기화

### 🔄 시스템 간 상호작용 플로우

#### **AI 챗봇 → 아파트 카드**
1. 사용자가 @아파트명으로 멘션 → 해당 아파트 카드 데이터 로딩
2. AI 확장카드 분석 완료 → 아파트 카드 AI요약 탭에 결과 표시

#### **아파트 카드 → 3D 지도**
1. 프리셋 포인트 선택 → 3D 지도 해당 위치로 카메라 이동
2. 창문뷰 버튼 클릭 → 3D 지도에서 자동으로 창문뷰 모드 실행
3. 음영분석 버튼 클릭 → 3D 지도에서 해당 위치 그림자 분석 시작

#### **2D 지도 ↔ 아파트 카드**
1. 2D 지도 아파트 마커 클릭 → 해당 아파트 카드 정보 표시
2. 아파트 카드에서 위치 보기 → 2D 지도 해당 위치로 이동
3. 즐겨찾기 토글 → 2D 지도 핀 색상 실시간 변경

#### **3D 지도 ↔ 2D 지도**
1. 3D 카메라 이동 → 2D 미니맵에 시야 범위 실시간 표시
2. 2D 지도 위치 변경 → 3D 지도 동기화 이동

## 🚀 시작하기

### 📋 사전 요구사항

- **Node.js**: v22.17.1+
- **Bun**: v1.2.20+
- **PostgreSQL**: v15+ (PostGIS 확장 포함)
- **Git**: v2.50+

### 💾 데이터베이스 설정

```bash
# PostgreSQL 데이터베이스 생성
createdb openimjang

# PostGIS 확장 설치
psql -d openimjang -c "CREATE EXTENSION postgis;"
psql -d openimjang -c "CREATE EXTENSION pgvector;"

# 스키마 및 데이터 로드
psql -d openimjang -f db_schema_public_oi.sql
```

### 🔧 설치 및 실행

1. **저장소 클론**
```bash
git clone https://github.com/your-username/OpenImjang.git
cd OpenImjang
```

2. **의존성 설치**
```bash
# 루트 의존성 설치
bun install

# 프론트엔드 의존성
cd apps/web
bun install

# 백엔드 의존성
cd ../bff
bun install
```

3. **환경변수 설정**
```bash
# apps/bff/.env 파일 생성
cp apps/bff/.env.example apps/bff/.env

# 필수 환경변수 설정
DATABASE_URL=postgres://postgres:1212@localhost:5432/openimjang
OPENAI_API_KEY=your_openai_api_key
FIREBASE_PROJECT_ID=your_firebase_project
VWORLD_API_KEY=your_vworld_key
KAKAO_MAPS_API_KEY=your_kakao_maps_key
```

4. **개발 서버 실행**

**터미널 1 - 백엔드 (포트 8787)**
```bash
cd apps/bff
bun run dev
```

**터미널 2 - 프론트엔드 (포트 5173)**
```bash
cd apps/web
bun run dev
```

5. **접속**
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8787
- API 문서: http://localhost:8787/swagger

## 🎨 실제 구현된 기능 구조 트리

```
🏠 오픈임장 플랫폼
├── 🗺️ 지도 시각화 시스템
│   ├── 2D 지도 (Kakao Maps) - MapContainer.tsx
│   │   ├── 실시간 아파트 위치 마커 표시
│   │   ├── 즐겨찾기 핀 표시/관리 (Firebase 연동)
│   │   ├── 임시 마커 (POI 호버용)
│   │   ├── 건물군(아파트 단지) 경계 오버레이 (useEqbOverlay)
│   │   ├── 3D 카메라 시야 범위 시각화 (부채꼴 표시)
│   │   ├── 미니맵 모드 지원
│   │   ├── 네이버 로드뷰 동기화 (useNaverStreetView)
│   │   └── 카드 확장 시 자동 리사이즈
│   └── 3D 지도 (MapPrime3D/Cesium) - MapPrime3DViewer.tsx
│       ├── 🏢 3D 건물 모델링 및 단지 하이라이트 (use3DEqbHighlight)
│       ├── 🪟 창가 뷰 모드 (useWindowView)
│       │   └── 건물 클릭 시 창가에서 바라본 시점 자동 설정
│       ├── 🚶 1인칭 걷기 모드 (useWalkingMode, useFirstPersonLook)
│       │   ├── WASD 키로 이동
│       │   ├── 마우스 시점 조작
│       │   └── 마우스 휠 클릭으로 둘러보기
│       ├── ☀️ 음영분석 시스템 (useShadeAnalysis)
│       │   ├── 실시간 일조량 분석
│       │   ├── 계절별 프리셋 (춘분/하지/추분/동지)
│       │   ├── 분석 지점 클릭 선택
│       │   └── 시간대별 음영 변화 시뮬레이션
│       ├── 🌆 스카이라인 분석 (useSkyline)
│       │   ├── 고층 건물 스카이라인 추출
│       │   ├── 시야 차단도 분석
│       │   └── 건물 높이 프로파일 생성
│       ├── 📍 프리셋 포인트 시스템 (개발자 모드)
│       │   ├── 3D 건물 표면 클릭으로 포인트 생성
│       │   ├── 동/호수/면적 정보 입력
│       │   ├── 아파트별 포인트 필터링
│       │   ├── 3D 지도에 포인트 시각화
│       │   └── 포인트 클릭 시 상세정보 팝업
│       ├── 🗺️ 네이버 로드뷰 통합 (useNaverStreetView)
│       │   ├── 3D 지도와 실시간 동기화
│       │   ├── 걷기/1인칭 모드와 연동
│       │   └── 우측 하단 팝업 표시
│       ├── 🎯 카메라 프러스텀 계산 (useCameraFrustum)
│       │   ├── 3D 시야 범위 실시간 계산
│       │   ├── 미니맵 오버레이 연동
│       │   └── 디바운스 최적화 (300ms)
│       ├── 📏 리사이즈 기능 (useResizable)
│       │   ├── 좌측 하단 핸들로 크기 조절
│       │   ├── 최소/최대 크기 제한
│       │   └── 드래그 상태 시각화
│       └── 🔄 팝업/메인 모드 전환
│           ├── 우측 상단 팝업 기본 위치
│           ├── 3D 메인 모드 시 전체화면
│           └── 2D ↔ 3D 전환 버튼
│
├── 🤖 AI 챗봇 시스템
│   ├── 🧠 Simple LLM 시스템 (SimpleLLMProcessor)
│   │   ├── GPT-4o-mini 기반 자연어 처리
│   │   ├── Few-shot 부동산 도메인 학습
│   │   ├── 한글 인코딩 문제 해결 (SafeBinaryJsonParser - 6가지 전략)
│   │   ├── 웹 검색 연동 (WebSearchService - 내부 데이터 부족 시)
│   │   └── 세션 기반 대화 연속성 (30분 TTL)
│   ├── 🎯 멀티모달 챗봇 (ChatbotSidebar)
│   │   ├── 이미지 + 텍스트 통합 분석
│   │   ├── 임장 메모 첨부 (MemoSelectorModal)
│   │   │   ├── Firebase 메모 실시간 조회
│   │   │   ├── 메모 사진 Base64 변환 (urlToBase64)
│   │   │   ├── 보라색 테마 UI 구분
│   │   │   └── 메타데이터 표시 (아파트 연관성, 작성일)
│   │   ├── 직접 이미지 첨부 (드롭다운)
│   │   ├── @mention 아파트 정보 첨부
│   │   └── 상황별 컨텍스트 세션 (general/apartment/memo)
│   ├── 🔄 LLM 라이프사이클 관리 (LLMMaster)
│   │   ├── ConversationSession (대화 상태 관리)
│   │   ├── SmartApartmentResolver (아파트명 해석)
│   │   │   ├── 직접 DB 검색
│   │   │   ├── 벡터 유사도 검색
│   │   │   └── 웹 검색 폴백
│   │   ├── AI 3.0 대화 인텔리전스 시스템 (6개 매니저)
│   │   │   ├── ConversationContextTracker
│   │   │   ├── DialogueStrategyEngine
│   │   │   ├── NaturalFlowManager
│   │   │   ├── UserJourneyOptimizer
│   │   │   ├── MultiTurnConversationManager
│   │   │   └── EmotionalContextAnalyzer
│   │   └── 벡터 임베딩 시스템 (EmbeddingService)
│   └── ⚠️ 레거시 시스템 (사용 중단 예정)
│       ├── Function Calling 기반 AI 핸들러들
│       └── 고정 규칙 기반 응답 시스템
│
├── 🏢 실거래가 검색 시스템
│   ├── 🔍 통합 아파트 검색 (SearchRoute)
│   │   ├── 좌표 기반 검색 (PostGIS ST_Distance)
│   │   ├── 지번주소 검색 (ILIKE 패턴)
│   │   ├── 아파트명 유사도 검색 (PostgreSQL similarity)
│   │   └── ILIKE 폴백 검색
│   ├── 🏠 실거래가 조회 (RealEstateDealsTable)
│   │   ├── 매매/전월세 통합 조회
│   │   ├── 면적별 거래 현황
│   │   ├── 층수별 거래 분포
│   │   └── 최신순/가격순 정렬
│   ├── 🗃️ 공공데이터 ETL 파이프라인
│   │   ├── 매매 실거래가 수집 (fetch_trade_raw.ts)
│   │   ├── 전월세 실거래가 수집 (fetch_rent_raw.ts)
│   │   ├── 건축물 정보 수집 (fetch_building_info.ts)
│   │   ├── 데이터 통합 처리 (populate_apt_deal_all.ts)
│   │   └── 중복 방지 및 안전 파싱
│   └── 🌐 공간 검색 (PostGIS)
│       ├── 반경 내 아파트 검색
│       ├── 거리 계산 (ST_Distance)
│       ├── 지리적 범위 검색
│       └── GIST 공간 인덱스 최적화
│
├── 📝 임장 메모 시스템 (Firebase 연동)
│   ├── 📋 메모 작성/편집 (MemoForm)
│   │   ├── 아파트 연관 메모
│   │   ├── 다중 사진 첨부 및 업로드
│   │   ├── 위치 기반 자동 아파트 감지
│   │   ├── 마크다운 텍스트 렌더링
│   │   └── 실시간 저장/동기화
│   ├── 🔥 Firebase 통합
│   │   ├── Firestore 실시간 메모 동기화
│   │   ├── Storage 이미지 업로드/다운로드
│   │   ├── 사용자별 메모 컬렉션 관리
│   │   └── 보안 규칙 적용
│   ├── ❤️ 즐겨찾기 시스템
│   │   ├── 관심 아파트 즐겨찾기
│   │   ├── 2D 지도 핀 표시
│   │   └── 실시간 업데이트
│   └── 🔗 챗봇 연동
│       ├── 메모 선택 모달 (MemoSelectorModal)
│       ├── 사진 자동 다운로드/변환
│       └── AI 분석용 컨텍스트 제공
│
├── 👤 사용자 관리 시스템
│   ├── 🔐 Firebase 인증 (AuthProvider)
│   │   ├── 이메일/비밀번호 로그인
│   │   ├── 구글 소셜 로그인
│   │   ├── 익명 로그인 지원
│   │   └── 인증 상태 실시간 관리
│   ├── 📋 사용자 온보딩 (OnboardingWizard - 7단계)
│   │   ├── 기본 정보 수집
│   │   ├── 관심 지역 설정
│   │   ├── 투자 성향 분석
│   │   ├── 예산 범위 설정
│   │   ├── 우선순위 설정
│   │   ├── 알림 설정
│   │   └── 프로필 완성
│   └── 👥 프로필 관리 (ProfilePage)
│       ├── 개인정보 수정
│       ├── 투자 성향 재설정
│       └── 계정 설정
│
├── 🔧 개발자 도구 시스템
│   ├── 🛠️ 개발자 모드 (DeveloperModeProvider)
│   │   ├── 전역 개발자 모드 토글
│   │   ├── 프리셋 포인트 생성 기능 활성화
│   │   ├── 3D 시야 범위 디버그 정보
│   │   └── 카메라 프러스텀 실시간 표시
│   ├── 📍 프리셋 포인트 관리
│   │   ├── PointInputModal - 포인트 정보 입력
│   │   ├── 3D 건물 표면 클릭 생성
│   │   ├── 아파트별 필터링
│   │   └── CRUD 작업 (생성/조회/삭제)
│   └── 🔍 디버깅 도구
│       ├── 콘솔 로깅 시스템
│       ├── 에러 추적 및 표시
│       └── 성능 메트릭 모니터링
│
├── 🌐 API 시스템 (Hono BFF)
│   ├── 🔍 검색 API (/api/search)
│   │   ├── 통합 아파트 검색
│   │   ├── 좌표/주소/아파트명 검색
│   │   └── 가장 가까운 위치 검색
│   ├── 🤖 AI API (/api/ai)
│   │   ├── /simple-chat - Simple LLM 시스템
│   │   ├── /chatbot - 멀티모달 챗봇
│   │   ├── /chat-lifecycle - LLM 라이프사이클 (비활성화)
│   │   └── 세션 관리 API
│   ├── 📝 메모 API (/api/memo)
│   │   ├── Firebase 메모 CRUD
│   │   ├── 사용자별 메모 조회
│   │   └── 즐겨찾기 관리
│   ├── 📍 프리셋 포인트 API (/api/preset-points)
│   │   ├── 포인트 생성/조회/삭제
│   │   ├── 아파트별 포인트 필터링
│   │   └── 공간 인덱스 기반 검색
│   ├── 📤 업로드 API (/api/upload)
│   │   ├── 멀티파트 파일 업로드
│   │   └── 이미지 처리 및 저장
│   ├── 🗺️ 지리정보 API (/api/geo)
│   │   ├── 건물 정보 조회
│   │   └── UPIS 연동
│   ├── 📊 임베딩 API (/api/embedding)
│   │   ├── 벡터 임베딩 생성/조회
│   │   ├── 유사도 검색
│   │   └── RAG 시스템 지원
│   └── 📚 문서화 (/api/docs)
│       ├── Swagger UI 제공
│       ├── OpenAPI 스펙
│       └── API 사용 예시
│
└── ⚙️ 시스템 관리 및 모니터링
    ├── 🔒 보안 및 미들웨어
    │   ├── CORS 정책 설정 (3개 포트 허용)
    │   ├── Rate Limiting (hono-rate-limiter)
    │   ├── Body Size 제한 (50MB)
    │   ├── UTF-8 인코딩 강제 설정
    │   └── 에러 핸들링 미들웨어
    ├── 📊 모니터링 시스템
    │   ├── 구조화 로깅 (Hono logger)
    │   ├── 데이터베이스 헬스체크 (/api/db/now)
    │   ├── AI 응답 품질 추적
    │   └── 처리 시간 메트릭
    ├── 🗄️ 데이터베이스 관리
    │   ├── Kysely ORM (타입 안전)
    │   ├── PostgreSQL + PostGIS 연동
    │   ├── 커넥션 풀링 (max: 5)
    │   └── 공간 인덱스 최적화
    └── 🚀 배포 및 운영
        ├── Bun 런타임 (3-4배 성능 향상)
        ├── 정적 파일 서빙 (/uploads)
        ├── 환경변수 분리 (.env 파일)
        └── 프로덕션 빌드 최적화
```

## 📊 데이터베이스 스키마 (PostgreSQL + PostGIS)

### 📋 ERD 테이블 구조

#### 🏠 부동산 데이터 (`oi` 스키마)

**`oi.apt_info` - 아파트 기본정보 (마스터 테이블)**
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | integer | PK, auto_increment | 아파트 ID |
| apt_nm | text | NOT NULL | 아파트명 |
| jibun_address | text | | 지번주소 |
| lon | double precision | | 경도 (SRID 4326) |
| lat | double precision | | 위도 (SRID 4326) |
| created_at | timestamp | default: now() | 생성일시 |
| updated_at | timestamp | default: now() | 수정일시 |

**`oi.apt_deal_all` - 통합 실거래 정보 (매매/전월세)**
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | integer | PK, auto_increment | 거래 ID |
| apt_nm | text | NOT NULL | 아파트명 |
| apt_dong | text | | 아파트 동 |
| jibun_address | text | NOT NULL | 지번주소 |
| exclu_use_ar | numeric(10,2) | | 전용면적 (㎡) |
| floor | integer | | 층수 |
| deal_year | integer | NOT NULL | 거래년도 |
| deal_month | integer | NOT NULL | 거래월 |
| deal_day | integer | NOT NULL | 거래일 |
| deal_amount | integer | | 매매가 (만원, NULL=전월세) |
| deposit | integer | | 보증금 (만원) |
| monthly_rent | integer | | 월세 (만원) |
| created_at | timestamp | default: now() | 생성일시 |
| updated_at | timestamp | default: now() | 수정일시 |

**`oi.apt_building_info` - 건축물 상세정보 (표제부등본)**
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | integer | PK, auto_increment | 건물정보 ID |
| apt_id | integer | FK → apt_info.id | 아파트 ID |
| type | varchar(10) | NOT NULL | 건물 유형 |
| dongnm | varchar(100) | | 동명 |
| bldnm | varchar(200) | | 건물명 |
| platplc | text | | 대지위치 |
| platarea | numeric | | 대지면적 |
| archarea | numeric | | 건축면적 |
| totarea | numeric | | 연면적 |
| grndflrcnt | integer | | 지상층수 |
| ugrndflrcnt | integer | | 지하층수 |
| mainpurpscdnm | varchar(200) | | 주용도코드명 |
| strctcdnm | varchar(200) | | 구조코드명 |
| roofcdnm | varchar(200) | | 지붕코드명 |
| hhldcnt | integer | | 세대수 |
| totpkngcnt | integer | | 총주차면수 |
| useaprday | date | | 사용승인일 |
| raw_data | jsonb | | 원본 JSON 데이터 |
| created_at | timestamp | default: now() | 생성일시 |

**`oi.preset_points` - 프리셋 포인트 (3D 뷰어용)**
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | integer | PK, auto_increment | 포인트 ID |
| lat | double precision | NOT NULL | 위도 |
| lon | double precision | NOT NULL | 경도 |
| apt_nm | varchar(255) | | 아파트명 |
| jibun_address | text | | 지번주소 |
| dong | varchar(50) | | 동 |
| ho | varchar(50) | | 호 |
| exclu_use_ar | numeric(10,2) | | 전용면적 |
| apt_id | integer | FK → apt_info.id | 아파트 ID |
| height | numeric(10,2) | default: 0.0 | 높이 |
| floorplan_image_url | text | | 평면도 URL |
| created_by | varchar(100) | default: 'developer' | 생성자 |
| created_at | timestamp | default: now() | 생성일시 |
| updated_at | timestamp | default: now() | 수정일시 |

**인덱스**: `idx_preset_points_location` GIST (st_point(lon, lat))

#### 🤖 AI 시스템 (`ai` 스키마)

**`ai.embeddings` - 벡터 임베딩 저장소 (pgvector)**
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|----------|------|
| id | bigint | PK, auto_increment | 임베딩 ID |
| source_path | text | NOT NULL | 소스 파일 경로 |
| schema_name | text | | 스키마명 |
| table_name | text | | 테이블명 |
| object_name | text | | 객체명 |
| chunk_id | integer | NOT NULL | 청크 ID |
| content_text | text | NOT NULL | 임베딩 텍스트 |
| token_count | integer | | 토큰 개수 |
| embedding | vector(1536) | NOT NULL | 벡터 임베딩 |
| meta | jsonb | | 메타데이터 |
| created_at | timestamptz | NOT NULL, default: now() | 생성일시 |
| updated_at | timestamptz | NOT NULL, default: now() | 수정일시 |

**인덱스**:
- `embeddings_source_path_chunk_id_key` UNIQUE (source_path, chunk_id)
- `ix_embeddings_vec_cosine` ivfflat (embedding vector_cosine_ops)

#### 🗺️ 공간정보 데이터 (`public` 스키마)

**`public.seoul_bldg` - 서울시 건물 정보**
- 서울시 건물 지리정보 (PostGIS geometry 포함)

**`oi.legal_dong` - 법정동 코드**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| code | varchar | 법정동 코드 (PK) |
| sido | varchar | 시도 |
| sigungu | varchar | 시군구 |
| eupmyeondong | varchar | 읍면동 |
| ri | varchar | 리 |

#### 📚 Raw 데이터 테이블 (ETL 소스)

**`oi.apt_deal_trade_raw` - 매매 실거래 원본 (공공데이터포털)**
**`oi.apt_deal_rent_raw` - 전월세 실거래 원본 (공공데이터포털)**

### 🔗 테이블 관계도

```
oi.apt_info (1) ────┬──── (N) oi.apt_building_info
     │              │
     │              ├──── (N) oi.preset_points
     │              │
     │              └──── (N) oi.ai_smart_summary
     │
     │ (jibun_address 연결)
     │
oi.apt_deal_all
     │
oi.apt_deal_trade_raw ──┬─→ (ETL) ──→ oi.apt_deal_all
oi.apt_deal_rent_raw ───┘

ai.embeddings (독립적)
public.seoul_bldg (독립적)
oi.legal_dong (독립적)
```

### 🏗️ ETL 파이프라인

**1단계: 공공데이터 수집**
- `fetch_trade_raw.ts`: 매매 실거래가 API 수집 → `oi.apt_deal_trade_raw`
- `fetch_rent_raw.ts`: 전월세 실거래가 API 수집 → `oi.apt_deal_rent_raw`
- `fetch_building_info.ts`: 건축물 정보 API → `oi.apt_building_info`

**2단계: 데이터 통합 및 정규화**
- `populate_apt_deal_all.ts`: Raw 테이블 → `oi.apt_deal_all` 통합
- `populate_apt_info_from_trade_raw.ts`: 아파트 기본정보 추출
- `fill_apt_info_coordinates.ts`: 좌표 정보 보완

### 주요 쿼리 예시

```sql
-- 특정 아파트 84㎡ 실거래가 조회
SELECT deal_amount, deal_year, deal_month, exclu_use_ar
FROM oi.apt_deal_all
WHERE apt_nm LIKE '%래미안%'
  AND jibun_address LIKE '%잠실%'
  AND exclu_use_ar BETWEEN 83 AND 85
  AND deal_amount IS NOT NULL
ORDER BY deal_year DESC, deal_month DESC;

-- 반경 1km 내 아파트 검색 (PostGIS)
SELECT ai.apt_nm, ai.jibun_address,
       ST_Distance(
         ST_Point(ai.lon, ai.lat)::geography,
         ST_Point(127.0816, 37.5172)::geography
       ) as distance_m
FROM oi.apt_info ai
WHERE ST_DWithin(
  ST_Point(ai.lon, ai.lat)::geography,
  ST_Point(127.0816, 37.5172)::geography,
  1000
)
ORDER BY distance_m;
```

## 🤖 AI 챗봇 시스템 아키텍처

```mermaid
graph TB
    subgraph "🧠 AI Core Systems"
        SimpleLLM["🔥 Simple LLM System<br/>SimpleLLMProcessor<br/><small>• GPT-4o-mini 기반<br/>• Few-shot 부동산 도메인<br/>• 90% 비용 절감</small>"]

        MultiModal["🎯 멀티모달 챗봇<br/>ChatbotSidebar<br/><small>• 이미지+텍스트 통합<br/>• Firebase 연동<br/>• 상황별 컨텍스트</small>"]

        LLMMaster["🔄 LLM 라이프사이클<br/>LLMMaster<br/><small>• 대화 상태 관리<br/>• 오케스트레이션<br/>• AI 3.0 인텔리전스</small>"]
    end

    subgraph "🔧 Processing Components"
        Encoding["📝 한글 인코딩 처리<br/>SafeBinaryJsonParser<br/><small>• 6가지 인코딩 전략<br/>• UTF-8/EUC-KR/CP949<br/>• 99.9% 정확도</small>"]

        WebSearch["🌐 웹 검색 연동<br/>WebSearchService<br/><small>• 내부 데이터 부족 시<br/>• 부동산 특화 검색<br/>• 타 포털 링크 배제</small>"]

        AptResolver["🏠 아파트명 해석<br/>SmartApartmentResolver<br/><small>• 직접 DB 검색<br/>• 벡터 유사도 검색<br/>• 웹 검색 폴백</small>"]
    end

    subgraph "💾 Data & Context"
        Session["💬 대화 세션<br/>ConversationSession<br/><small>• 30분 TTL<br/>• 슬롯 기반 저장<br/>• 연속성 보장</small>"]

        Embedding["🔍 벡터 임베딩<br/>EmbeddingService<br/><small>• pgvector 저장<br/>• 코사인 유사도<br/>• RAG 시스템</small>"]

        Firebase["🔥 Firebase 연동<br/>Firestore/Storage<br/><small>• 메모 실시간 동기화<br/>• 이미지 다운로드<br/>• Base64 변환</small>"]
    end

    subgraph "🎨 User Interface"
        MemoSelector["📝 메모 선택 모달<br/>MemoSelectorModal<br/><small>• 보라색 테마 UI<br/>• 메타데이터 표시<br/>• 사진 자동 변환</small>"]

        ImageUpload["📷 이미지 업로드<br/>드롭다운 첨부<br/><small>• 직접 파일 선택<br/>• 멀티파트 업로드<br/>• 실시간 프리뷰</small>"]

        MentionSystem["🏢 @mention 시스템<br/>아파트 정보 첨부<br/><small>• 실시간 검색<br/>• 위치 데이터 연동<br/>• 컨텍스트 제공</small>"]
    end

    subgraph "⚡ AI 3.0 Intelligence"
        ContextTracker["📊 컨텍스트 추적<br/>ConversationContextTracker<br/><small>• 대화 패턴 학습<br/>• 사용자 성향 분석</small>"]

        StrategyEngine["🎯 전략 엔진<br/>DialogueStrategyEngine<br/><small>• 5가지 사용자 유형<br/>• 개인화 전략</small>"]

        FlowManager["🌊 자연 플로우<br/>NaturalFlowManager<br/><small>• 기계적 명확화 대체<br/>• 자연스러운 가이드</small>"]

        JourneyOptimizer["🚀 여정 최적화<br/>UserJourneyOptimizer<br/><small>• 6단계 추적<br/>• 경험 최적화</small>"]

        TurnManager["🔄 다중턴 관리<br/>MultiTurnConversationManager<br/><small>• 복잡한 대화 처리<br/>• 맥락 유지</small>"]

        EmotionalAnalyzer["💡 감정 분석<br/>EmotionalContextAnalyzer<br/><small>• 8가지 감정 상태<br/>• 공감적 인터랙션</small>"]
    end

    SimpleLLM --> Encoding
    SimpleLLM --> WebSearch
    SimpleLLM --> Session

    MultiModal --> Firebase
    MultiModal --> MemoSelector
    MultiModal --> ImageUpload
    MultiModal --> MentionSystem

    LLMMaster --> AptResolver
    LLMMaster --> Embedding
    LLMMaster --> ContextTracker
    LLMMaster --> StrategyEngine
    LLMMaster --> FlowManager
    LLMMaster --> JourneyOptimizer
    LLMMaster --> TurnManager
    LLMMaster --> EmotionalAnalyzer

    Session --> SimpleLLM
    Session --> MultiModal
    Session --> LLMMaster

    classDef coreSystem fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dataLayer fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef uiLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef aiIntelligence fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class SimpleLLM,MultiModal,LLMMaster coreSystem
    class Encoding,WebSearch,AptResolver processing
    class Session,Embedding,Firebase dataLayer
    class MemoSelector,ImageUpload,MentionSystem uiLayer
    class ContextTracker,StrategyEngine,FlowManager,JourneyOptimizer,TurnManager,EmotionalAnalyzer aiIntelligence
```

### 🔥 Simple LLM 시스템 상세

**주요 API 엔드포인트**
```typescript
// POST /api/ai/simple-chat - 일반 대화형 AI
{
  message: "잠실 래미안 84형 매매가 알려줘",
  sessionId?: "optional_session_id"
}

// POST /api/ai/apartment-summary - 확장카드 종합 분석 (NEW)
{
  data: {
    aptInfo: { name, address, lat, lon },
    deals: [...실거래가데이터],
    building: {...건물정보},
    landuse: {...토지이용계획},
    nearby: {...주변환경},
    pnu: {...PNU정보}
  }
}

// 응답 - 종합 분석 브리핑
{
  success: true,
  data: {
    summary: "안녕하세요! 잠실래미안에 대한 브리핑을 준비했습니다...(1200-1800자)",
    dataQuality: { deals: true, building: true, landuse: true, nearby: true },
    processingTime: "2340ms"
  }
}
```

### 🎯 멀티모달 챗봇 첨부 시스템

| 첨부 유형 | 구현체 | 설명 |
|-----------|---------|------|
| 📷 **직접 이미지** | 드롭다운 업로드 | 파일 선택 → 멀티파트 업로드 → Base64 변환 |
| 📝 **임장 메모** | MemoSelectorModal | Firebase 조회 → 사진 다운로드 → AI 분석 |
| 🏢 **아파트 정보** | @mention 시스템 | 실시간 검색 → 위치 데이터 → 컨텍스트 제공 |

### 📍 프리셋 포인트 시스템 API

**주요 엔드포인트**
```typescript
// POST /api/preset-points/create - 프리셋 포인트 생성
{
  lat: 37.559874566173,
  lon: 127.0155059430208,
  apt_nm: "청구e편한세상",
  dong: "101동",
  ho: "1501호",
  apt_id: 39367,
  height: 50.0
}

// GET /api/preset-points/list - 전체 프리셋 포인트 조회
// GET /api/preset-points/by-apartment/:aptId - 아파트별 프리셋 포인트 조회
// POST /api/preset-points/fix-apartment-links - 아파트 연결 자동 수정
// DELETE /api/preset-points/:id - 프리셋 포인트 삭제
```

**현재 저장된 데이터**: 4개 프리셋 포인트 (청구e편한세상 3개, 골든카운티 1개)

## 🔧 개발 가이드

### 코딩 컨벤션

**TypeScript**
- Strict mode 활성화
- 모든 컴포넌트에 타입 정의
- API 응답 타입 엄격 검증

**React**
- React 19 Concurrent Features 활용
- React Query로 데이터 페칭 패턴 통일
- 커스텀 훅으로 로직 분리

**API 설계**
- RESTful 규칙 준수
- `{data, isLoading, error}` 응답 패턴
- Swagger/OpenAPI 문서화 필수

### 공간 데이터 처리

```typescript
// PostGIS ST_* 함수 활용
const spatialQuery = `
  SELECT apt_nm, ST_AsGeoJSON(geom) as geometry
  FROM oi.apt_info
  WHERE ST_DWithin(
    ST_Point(lon, lat)::geography,
    ST_Point($1, $2)::geography,
    $3
  )
`;

// GIST 인덱스 최적화
CREATE INDEX idx_apt_info_geom
ON oi.apt_info
USING GIST (ST_Point(lon, lat));
```

## 🔐 보안

**인증/인가**
- Firebase Authentication 통합
- JWT 토큰 기반 세션 관리
- API 키 환경변수 분리

**데이터 보안**
- 민감정보 암호화 저장
- SQL 인젝션 방지 (Parameterized Query)
- CORS 정책 엄격 적용


**오픈임장** - 더 스마트한 부동산 투자의 시작 🏠✨