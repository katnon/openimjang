# OpenImjang 시스템 아키텍처 및 기능 스키마

> AI 기반 부동산 종합 분석 및 공간정보 시각화 플랫폼의 전체 시스템 구조와 기능 흐름

## 📋 목차
1. [유즈케이스 다이어그램](#1-유즈케이스-다이어그램)
2. [시스템 컴포넌트 구조](#2-시스템-컴포넌트-구조)
3. [주요 기능별 시퀀스 다이어그램](#3-주요-기능별-시퀀스-다이어그램)
4. [데이터 플로우 다이어그램](#4-데이터-플로우-다이어그램)
5. [데이터베이스 ER 다이어그램](#5-데이터베이스-er-다이어그램)

---

## 1. 유즈케이스 다이어그램

### 전체 시스템 유즈케이스

```mermaid
graph TD
    %% 액터 정의
    Guest[👤 비로그인 사용자]
    User[🔐 로그인 사용자]
    System[🤖 시스템]
    
    %% 비로그인 사용자 기능
    Guest --> UC1[부동산 검색]
    Guest --> UC2[지도 탐색]
    Guest --> UC3[실거래가 조회]
    Guest --> UC4[건물 정보 조회]
    Guest --> UC5[주변 시설 조회]
    Guest --> UC6[구글 로그인]
    
    %% 로그인 사용자 추가 기능
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC7[온보딩 설정]
    User --> UC8[AI 종합 분석]
    User --> UC9[AI 챗봇 대화]
    User --> UC10[임장 메모 작성]
    User --> UC11[즐겨찾기 관리]
    User --> UC12[내 임장 목록]
    User --> UC13[사용자 프로필 관리]
    
    %% 시스템 자동 기능
    System --> UC14[실시간 데이터 수집]
    System --> UC15[공간 데이터 분석]
    System --> UC16[AI 응답 생성]
    
    %% 서브 유즈케이스
    UC1 --> UC1_1[이름으로 검색]
    UC1 --> UC1_2[주소로 검색]
    UC1 --> UC1_3[좌표 기반 검색]
    
    UC2 --> UC2_1[2D 지도 보기]
    UC2 --> UC2_2[3D 지도 보기]
    UC2 --> UC2_3[지적편집도 오버레이]
    UC2 --> UC2_4[위성/일반 지도 전환]
    
    UC10 --> UC10_1[메모 작성]
    UC10 --> UC10_2[사진 첨부]
    UC10 --> UC10_3[메모 수정]
    UC10 --> UC10_4[메모 삭제]
    
    UC11 --> UC11_1[즐겨찾기 추가]
    UC11 --> UC11_2[즐겨찾기 제거]
    UC11 --> UC11_3[즐겨찾기 핀 토글]
```

---

## 2. 시스템 컴포넌트 구조

### 2.1 프론트엔드 컴포넌트 아키텍처

```mermaid
graph TB
    %% 메인 앱
    App[App.tsx<br/>📱 메인 애플리케이션]
    Router[Router.tsx<br/>🛣️ 라우팅 관리]
    AuthProvider[AuthProvider.tsx<br/>🔐 인증 컨텍스트]
    
    %% 페이지 레벨
    Home[Home.tsx<br/>🏠 메인 페이지]
    
    %% 레이아웃 컴포넌트
    TopBar[TopBar.tsx<br/>📊 상단 바]
    
    %% 지도 관련 컴포넌트
    MapContainer[MapContainer.tsx<br/>🗺️ 2D 카카오맵]
    MapControls[MapControls.tsx<br/>🎮 지도 컨트롤]
    Map3DViewer[MapPrime3DViewer.tsx<br/>🌍 3D Cesium 뷰어]
    GeoOverlay[GeoPolygonOverlay.tsx<br/>📐 지적편집도 오버레이]
    LayerToggle[LayerToggle.tsx<br/>🔄 레이어 토글]
    
    %% 카드/정보 컴포넌트
    SummaryCard[SummaryCard.tsx<br/>📋 요약 카드]
    DealsTable[RealEstateDealsTable.tsx<br/>💰 실거래가 테이블]
    BuildingInfo[BuildingLandInfo.tsx<br/>🏢 건물 정보]
    NearbyPanel[NearbyInfoPanel.tsx<br/>📍 주변 정보]
    AiSummaryPanel[AiSummaryPanel.tsx<br/>🤖 AI 요약 패널]
    
    %% AI 관련 컴포넌트
    AIAnalysis[AIAnalysisModal.tsx<br/>🔬 AI 분석 모달]
    AIChatbot[AIChatbot.tsx<br/>💬 AI 챗봇]
    ChatbotModal[ChatbotModal.tsx<br/>💭 챗봇 모달]
    
    %% 사용자 관리 컴포넌트
    AuthPage[AuthPage.tsx<br/>🔑 로그인 페이지]
    Onboarding[UserOnboardingModal.tsx<br/>👋 온보딩 모달]
    UserProfile[UserProfileModal.tsx<br/>👤 사용자 프로필]
    
    %% 메모/즐겨찾기 컴포넌트
    MemoCreate[MemoCreateModal.tsx<br/>✍️ 메모 작성]
    MyImjang[MyImjangModal.tsx<br/>📝 내 임장 목록]
    FavoritePopup[FavoriteConfirmPopup.tsx<br/>⭐ 즐겨찾기 확인]
    
    %% 관계 설정
    App --> Router
    App --> AuthProvider
    Router --> Home
    
    Home --> TopBar
    Home --> MapContainer
    Home --> MapControls
    Home --> Map3DViewer
    Home --> SummaryCard
    Home --> AuthPage
    Home --> Onboarding
    Home --> UserProfile
    Home --> AIAnalysis
    Home --> AIChatbot
    Home --> ChatbotModal
    Home --> MemoCreate
    Home --> MyImjang
    Home --> FavoritePopup
    
    MapContainer --> GeoOverlay
    MapContainer --> LayerToggle
    
    SummaryCard --> DealsTable
    SummaryCard --> BuildingInfo
    SummaryCard --> NearbyPanel
    SummaryCard --> AiSummaryPanel
```

### 2.2 백엔드 API 구조

```mermaid
graph TB
    %% BFF 메인
    BFF[index.ts<br/>🚀 Hono BFF Server<br/>Port 3000]
    
    %% 미들웨어
    AuthMW[auth.ts<br/>🔐 Firebase 인증<br/>미들웨어]
    CORS[CORS<br/>🌐 크로스 오리진<br/>설정]
    Logger[Logger<br/>📝 요청 로깅]
    
    %% 라우트 모듈
    SearchRoute[search.ts<br/>🔍 부동산 검색 API]
    AIRoute[ai.ts<br/>🤖 AI 분석 API]
    POIRoute[poi.ts<br/>📍 POI 검색 API]
    BuildingRoute[buildings.ts<br/>🏢 건물 정보 API]
    UPISRoute[upis.ts<br/>📐 지적 정보 API]
    
    %% 데이터베이스 연결
    DB[db.ts<br/>🗄️ Kysely ORM<br/>PostGIS 연결]
    
    %% 외부 API 연동
    OpenAI[OpenAI API<br/>🧠 GPT-4o-mini]
    RTMS[국토부 RTMS API<br/>💰 실거래가]
    VWorld[VWorld API<br/>🌍 공간정보]
    KakaoAPI[Kakao API<br/>📍 POI/지도]
    
    %% 관계 설정
    BFF --> Logger
    BFF --> CORS
    BFF --> SearchRoute
    BFF --> AIRoute
    BFF --> POIRoute
    BFF --> BuildingRoute
    BFF --> UPISRoute
    
    SearchRoute --> DB
    AIRoute --> AuthMW
    AIRoute --> OpenAI
    AIRoute --> DB
    POIRoute --> KakaoAPI
    BuildingRoute --> DB
    BuildingRoute --> RTMS
    UPISRoute --> DB
    UPISRoute --> VWorld
    
    DB --> PostgreSQL[(PostgreSQL<br/>+ PostGIS<br/>🗄️ 공간 데이터베이스)]
```

---

## 3. 주요 기능별 시퀀스 다이어그램

### 3.1 사용자 온보딩 프로세스

```mermaid
sequenceDiagram
    participant U as 👤 사용자
    participant F as 📱 Frontend
    participant FB as 🔥 Firebase Auth
    participant FS as 🔥 Firestore
    
    U->>F: 구글 로그인 클릭
    F->>FB: signInWithPopup()
    FB-->>F: 인증 토큰 반환
    F->>F: 온보딩 필요 여부 확인
    
    alt 신규 사용자
        F->>U: 온보딩 모달 표시
        U->>F: 1단계: 부동산 목적 선택
        U->>F: 2단계: 가족 구성 선택  
        U->>F: 3단계: 직장/목적지 설정
        U->>F: 4단계: 통근시간 설정
        U->>F: 5단계: 예산 범위 설정
        U->>F: 6단계: 우선순위 선택
        F->>FS: 프로필 데이터 저장
        FS-->>F: 저장 완료
        F->>U: 온보딩 완료, 메인 화면 진입
    else 기존 사용자
        F->>FS: 기존 프로필 로드
        FS-->>F: 프로필 데이터 반환
        F->>U: 메인 화면 진입
    end
```

### 3.2 부동산 검색 및 정보 조회

```mermaid
sequenceDiagram
    participant U as 👤 사용자
    participant F as 📱 Frontend
    participant B as 🚀 BFF API
    participant DB as 🗄️ PostgreSQL
    participant EXT as 🌐 외부 API
    
    U->>F: 아파트 검색어 입력
    F->>B: GET /api/search?q=아파트명
    B->>DB: 아파트 정보 검색 쿼리
    DB-->>B: 검색 결과 반환
    B-->>F: 검색 결과 JSON
    F->>U: 검색 결과 리스트 표시
    
    U->>F: 특정 아파트 선택
    F->>F: 지도에 마커 표시
    
    par 실거래가 조회
        F->>B: GET /api/search/deals/{aptId}
        B->>DB: 실거래가 데이터 조회
        DB-->>B: 거래 내역 반환
        B-->>F: 거래 데이터 반환
    and 건물 정보 조회
        F->>B: GET /api/search/building-info/{aptId}
        B->>EXT: 건축물대장 API 호출
        EXT-->>B: 건물 정보 반환
        B-->>F: 건물 정보 반환
    and 주변 정보 조회
        F->>B: GET /api/search/nearby?lat=&lon=
        B->>EXT: 카카오 로컬 API 호출
        EXT-->>B: POI 데이터 반환
        B-->>F: 주변 시설 정보 반환
    end
    
    F->>U: 종합 정보 카드 표시
```

### 3.3 AI 종합 분석 프로세스

```mermaid
sequenceDiagram
    participant U as 🔐 로그인 사용자
    participant F as 📱 Frontend
    participant B as 🚀 BFF API
    participant FB as 🔥 Firebase Auth
    participant AI as 🤖 OpenAI API
    participant DB as 🗄️ PostgreSQL
    
    U->>F: AI 종합 분석 요청
    F->>B: POST /api/ai/analyze (with auth token)
    B->>FB: 토큰 검증
    FB-->>B: 사용자 인증 확인
    
    B->>B: 분석 데이터 수집<br/>(실거래가, 건물정보, 주변환경)
    
    B->>AI: GPT-4o-mini API 호출<br/>(구조화된 프롬프트)
    AI-->>B: AI 분석 결과 반환
    
    B->>DB: 분석 결과 저장<br/>(oi.ai_smart_summary)
    DB-->>B: 저장 완료
    
    B-->>F: 분석 결과 JSON 반환
    F->>U: AI 분석 모달 표시<br/>(투자가치, 리스크, 추천사항)
```

### 3.4 임장 메모 작성 및 관리

```mermaid
sequenceDiagram
    participant U as 🔐 로그인 사용자
    participant F as 📱 Frontend
    participant FS as 🔥 Firestore
    participant Storage as 🔥 Firebase Storage
    
    U->>F: 임장 메모 작성 버튼 클릭
    F->>U: 메모 작성 모달 표시
    
    U->>F: 제목, 내용 입력
    opt 사진 첨부
        U->>F: 사진 선택
        F->>Storage: 이미지 업로드
        Storage-->>F: 다운로드 URL 반환
    end
    
    U->>F: 저장 버튼 클릭
    F->>FS: 메모 데이터 저장<br/>users/{uid}/memos
    FS-->>F: 저장 완료
    F->>U: 저장 완료 알림
    
    alt 메모 수정
        U->>F: 기존 메모 수정
        F->>FS: 메모 데이터 업데이트
        FS-->>F: 업데이트 완료
    else 메모 삭제
        U->>F: 메모 삭제
        F->>FS: 메모 문서 삭제
        F->>Storage: 첨부 이미지 삭제
        FS-->>F: 삭제 완료
    end
```

---

## 4. 데이터 플로우 다이어그램

### 전체 시스템 데이터 흐름

```mermaid
flowchart TD
    %% 사용자 입력
    User[👤 사용자]
    
    %% 프론트엔드 레이어
    subgraph "Frontend (React SPA)"
        UI[🖥️ 사용자 인터페이스]
        Auth[🔐 Firebase Auth]
        Map[🗺️ 지도 컴포넌트]
        Cards[📋 정보 카드]
    end
    
    %% BFF 레이어
    subgraph "BFF (Hono + Bun)"
        API[🚀 API 라우터]
        AuthMW[🛡️ 인증 미들웨어]
        DataProc[⚙️ 데이터 처리]
    end
    
    %% 데이터 저장소
    subgraph "Data Layer"
        PG[(🗄️ PostgreSQL<br/>+ PostGIS)]
        FS[(🔥 Firestore)]
        Storage[(📁 Firebase Storage)]
    end
    
    %% 외부 서비스
    subgraph "External APIs"
        OpenAI[🤖 OpenAI GPT-4o-mini]
        RTMS[💰 국토부 RTMS]
        VWorld[🌍 VWorld WMS/WFS]
        Kakao[📍 Kakao Maps/Local]
    end
    
    %% 데이터 흐름
    User --> UI
    UI --> Auth
    UI --> Map
    UI --> Cards
    
    UI --> API
    API --> AuthMW
    API --> DataProc
    
    %% 데이터베이스 연결
    DataProc <--> PG
    DataProc <--> FS
    DataProc <--> Storage
    
    %% 외부 API 연결
    DataProc --> OpenAI
    DataProc --> RTMS
    DataProc --> VWorld
    DataProc --> Kakao
    
    %% 데이터 종류별 흐름
    PG -.->|실거래가 데이터| Cards
    PG -.->|아파트 정보| Map
    PG -.->|공간 데이터| Map
    FS -.->|사용자 프로필| UI
    FS -.->|임장 메모| Cards
    Storage -.->|메모 사진| Cards
    
    %% 스타일
    classDef frontend fill:#61dafb,stroke:#333,stroke-width:2px
    classDef backend fill:#000,color:#fff,stroke:#333,stroke-width:2px
    classDef data fill:#336791,color:#fff,stroke:#333,stroke-width:2px
    classDef external fill:#ff6b6b,color:#fff,stroke:#333,stroke-width:2px
    
    class UI,Auth,Map,Cards frontend
    class API,AuthMW,DataProc backend
    class PG,FS,Storage data
    class OpenAI,RTMS,VWorld,Kakao external
```

### 실시간 데이터 동기화

```mermaid
flowchart LR
    %% 데이터 소스
    subgraph "Data Sources"
        RTMS_API[국토부 RTMS API<br/>📊 실거래가]
        Building_API[건축물대장 API<br/>🏢 건물정보] 
        VWorld_API[VWorld API<br/>🗺️ 공간정보]
    end
    
    %% ETL 파이프라인
    subgraph "ETL Pipeline"
        Fetch[🔄 데이터 수집<br/>fetch_*.ts]
        Transform[⚙️ 데이터 변환<br/>populate_*.ts]
        Load[📥 데이터 적재<br/>PostgreSQL]
    end
    
    %% 실시간 처리
    subgraph "Real-time Processing"
        BFF[🚀 BFF API]
        Cache[⚡ 캐시<br/>5-30분 TTL]
        Spatial[📐 공간 쿼리<br/>PostGIS]
    end
    
    %% 클라이언트
    subgraph "Client"
        Frontend[📱 React Frontend]
        Map_Display[🗺️ 지도 표시]
        Card_Display[📋 카드 표시]
    end
    
    %% 데이터 흐름
    RTMS_API --> Fetch
    Building_API --> Fetch
    VWorld_API --> Fetch
    
    Fetch --> Transform
    Transform --> Load
    
    Load --> Spatial
    Spatial --> Cache
    Cache --> BFF
    
    BFF --> Frontend
    Frontend --> Map_Display
    Frontend --> Card_Display
    
    %% 실시간 업데이트 주기
    RTMS_API -.->|일일 업데이트| Fetch
    Building_API -.->|주간 업데이트| Fetch
    VWorld_API -.->|월간 업데이트| Fetch
```

---

## 5. 데이터베이스 ER 다이어그램

### PostgreSQL + PostGIS 스키마

```mermaid
erDiagram
    %% 아파트 기본 정보
    apt_info {
        int id PK "자동 증가"
        varchar apt_nm "아파트명"
        text jibun_address "지번주소"
        text road_address "도로명주소"  
        double lat "위도 (WGS84)"
        double lon "경도 (WGS84)"
        geometry geom "PostGIS 포인트"
        timestamp created_at "생성일시"
        timestamp updated_at "수정일시"
    }
    
    %% 통합 거래 데이터
    apt_deal_all {
        int id PK "자동 증가"
        varchar apt_nm "아파트명"
        text jibun_address "지번주소"
        numeric exclu_use_ar "전용면적(㎡)"
        int deal_year "거래년도"
        int deal_month "거래월"
        int deal_day "거래일"
        bigint deal_amount "매매가격(만원)"
        bigint deposit "보증금(만원)"
        int monthly_rent "월세(만원)"
        int floor "층"
        int build_year "건축년도"
        varchar deal_type "거래유형"
        timestamp created_at "생성일시"
    }
    
    %% 건축물 정보
    apt_building_info {
        int id PK "자동 증가"
        int apt_id FK "아파트 ID"
        varchar type "정보 유형"
        varchar dongnm "동명"
        numeric platarea "대지면적(㎡)"
        numeric archarea "건축면적(㎡)"
        numeric totarea "연면적(㎡)"
        int grndflrcnt "지상층수"
        int ugrndflrcnt "지하층수"
        varchar mainpurpscdnm "주용도명"
        varchar strctcdnm "구조명"
        int hhldcnt "세대수"
        int totpkngcnt "총주차대수"
        date useaprday "사용승인일"
        timestamp created_at "생성일시"
    }
    
    %% AI 분석 결과
    ai_smart_summary {
        int apt_id PK "아파트 ID"
        varchar apt_nm "아파트명"
        text jibun_address "지번주소"
        text summary "AI 분석 내용"
        varchar user_id "사용자 ID"
        timestamp created_at "생성일시"
        timestamp updated_at "수정일시"
    }
    
    %% 연속지적도
    al_d002_11_20250804 {
        int objectid PK "객체 ID"
        varchar a1 "PNU (부동산고유번호)"
        varchar a2 "법정동코드"
        varchar a3 "지목코드"
        geometry geom "지적경계 (EPSG:5186)"
    }
    
    %% 토지이용계획
    al_d154_11_20250830 {
        int objectid PK "객체 ID"
        text a7 "용도지역코드"
        text a9 "포함상태코드"
        geometry geom "용도지역 경계"
    }
    
    %% 용도지역 코드
    landuse_code {
        varchar code PK "용도지역코드"
        varchar name "용도지역명"
        varchar category "상위분류"
    }
    
    %% 관계 설정
    apt_info ||--o{ apt_deal_all : "아파트명-주소 매칭"
    apt_info ||--o{ apt_building_info : "apt_id"
    apt_info ||--o{ ai_smart_summary : "apt_id"
    al_d154_11_20250830 ||--o{ landuse_code : "a7"
```

### Firebase Firestore 컬렉션 구조

```mermaid
flowchart TD
    %% Firestore 루트
    Root[(🔥 Firestore Root)]
    
    %% 사용자 컬렉션
    Users[👥 users/{uid}]
    Root --> Users
    
    %% 사용자 하위 컬렉션
    Profile[👤 profile/basic<br/>온보딩 설정]
    Favorites[⭐ favorites/{aptId}<br/>즐겨찾기]
    Memos[📝 memos/{memoId}<br/>임장 메모]
    
    Users --> Profile
    Users --> Favorites  
    Users --> Memos
    
    %% 프로필 데이터 구조
    Profile --> P1[purpose: 부동산 목적]
    Profile --> P2[familyType: 가족 구성]
    Profile --> P3[workLocation: 직장/목적지]
    Profile --> P4[commutingRadius: 통근시간]
    Profile --> P5[budgetRange: 예산 범위]
    Profile --> P6[priorities: 우선순위]
    Profile --> P7[completedAt: 완료일시]
    
    %% 즐겨찾기 데이터 구조
    Favorites --> F1[aptId: 아파트 ID]
    Favorites --> F2[aptName: 아파트명]
    Favorites --> F3[aptAddress: 주소]
    Favorites --> F4[lat/lon: 좌표]
    Favorites --> F5[createdAt: 생성일시]
    
    %% 메모 데이터 구조
    Memos --> M1[aptId: 아파트 ID]
    Memos --> M2[title: 제목]
    Memos --> M3[body: 내용]
    Memos --> M4[photoUrl: 사진 URL]
    Memos --> M5[createdAt: 생성일시]
    Memos --> M6[updatedAt: 수정일시]
```

---

## 📋 기능별 상세 워크플로우 요약

### 🔍 부동산 검색 플로우
1. **검색 입력** → 2. **API 호출** → 3. **DB 검색** → 4. **결과 표시** → 5. **지도 마커 표시**

### 🗺️ 지도 상호작용 플로우  
1. **지도 로드** → 2. **마커 표시** → 3. **오버레이 토글** → 4. **2D/3D 전환** → 5. **POI 표시**

### 🤖 AI 분석 플로우
1. **로그인 확인** → 2. **데이터 수집** → 3. **AI API 호출** → 4. **결과 저장** → 5. **모달 표시**

### 📝 임장 메모 플로우
1. **메모 작성** → 2. **사진 업로드** → 3. **Firestore 저장** → 4. **목록 업데이트**

### ⭐ 즐겨찾기 플로우
1. **즐겨찾기 추가** → 2. **확인 팝업** → 3. **Firestore 저장** → 4. **지도 핀 표시**

---

## 🏗️ 기술 스택 의존성 다이어그램

```mermaid
graph TB
    %% Frontend 스택
    subgraph "Frontend Stack"
        React[React 19.1<br/>⚛️ UI 라이브러리]
        Vite[Vite 7.1<br/>⚡ 빌드 도구]
        TS[TypeScript 5.8<br/>🔷 타입 시스템]
        Tailwind[TailwindCSS 3.4<br/>🎨 스타일링]
        
        React --> Vite
        React --> TS
        React --> Tailwind
    end
    
    %% 지도 라이브러리
    subgraph "Map Libraries"
        Kakao[Kakao Maps API<br/>🗺️ 2D 지도]
        Cesium[Cesium + MapPrime3D<br/>🌍 3D 지구본]
    end
    
    %% 인증 및 저장소
    subgraph "Firebase Services"
        FBAuth[Firebase Auth<br/>🔐 구글 OAuth]
        Firestore[Firestore<br/>📄 NoSQL DB]
        FBStorage[Firebase Storage<br/>📁 파일 저장소]
    end
    
    %% Backend 스택
    subgraph "Backend Stack"
        Bun[Bun 1.0<br/>🚀 JS 런타임]
        Hono[Hono 4.4<br/>🌐 웹 프레임워크] 
        Kysely[Kysely 0.28<br/>🗄️ SQL 쿼리 빌더]
        
        Bun --> Hono
        Hono --> Kysely
    end
    
    %% 데이터베이스
    subgraph "Database"
        PG[PostgreSQL 14+<br/>🐘 관계형 DB]
        PostGIS[PostGIS 3.3+<br/>📐 공간 확장]
        
        PG --> PostGIS
    end
    
    %% 외부 API
    subgraph "External APIs"
        OpenAI_API[OpenAI API<br/>🤖 GPT-4o-mini]
        RTMS_API[국토부 RTMS<br/>💰 실거래가]
        VWorld_API[VWorld<br/>🌍 공간정보]
        Kakao_API[Kakao Local API<br/>📍 POI 검색]
    end
    
    %% 의존성 연결
    React --> Kakao
    React --> Cesium
    React --> FBAuth
    React --> Firestore
    React --> FBStorage
    
    Hono --> OpenAI_API
    Hono --> RTMS_API
    Hono --> VWorld_API
    Hono --> Kakao_API
    
    Kysely --> PG
```

---

이 문서는 OpenImjang 시스템의 전체 아키텍처와 기능 흐름을 시각적으로 보여줍니다. 각 다이어그램은 시스템의 다른 관점에서 구조와 동작을 설명하며, GitHub에서 Mermaid 문법을 통해 자동으로 렌더링됩니다.