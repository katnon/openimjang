# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenImjang is a real-time real estate risk analysis and spatial information visualization platform using a **Monorepo + BFF (Backend for Frontend)** architecture.

**Stack:** React + Vite + TypeScript (SPA), Hono BFF on Bun, PostGIS (SRID 4326)

## 🖥️ 개발환경 정보

### 운영체제 및 쉘
- **OS**: Windows 11 (MINGW64_NT-10.0-26100)
- **쉘**: Git Bash (MINGW64) - Claude Code의 모든 bash 명령어는 이 환경에서 실행됨
- **홈 디렉토리**: `/c/Users/gunho` (Windows: `C:\Users\gunho`)
- **프로젝트 경로**: `/c/OpenImjang` (Windows: `C:\OpenImjang`)

### 개발 도구 버전
```bash
Node.js:    v22.17.1
npm:        10.9.2  
Bun:        1.2.20
Git:        2.50.1.windows.1
PostgreSQL: 15.13
```

### 중요한 경로 매핑
```bash
# MINGW64에서 Windows 경로 변환
/c/OpenImjang           = C:\OpenImjang
/c/Users/gunho          = C:\Users\gunho
/c/Users/gunho/Pictures = C:\Users\gunho\Pictures
```

### Claude Code Bash 사용 시 주의사항

#### ✅ 작동하는 명령어 패턴
```bash
# 경로 이동 (MINGW64 스타일)
cd /c/OpenImjang/apps/bff

# PostgreSQL 연결 (비밀번호 환경변수 사용)
PGPASSWORD=1212 psql -h localhost -U postgres -d openimjang

# Windows 파일 시스템 접근
ls "/c/Users/gunho/Pictures/Screenshots"

# Node.js/Bun 명령어 (정상 작동)
node --version
bun --version
npm run dev
```

#### ⚠️ Windows 특이사항
- **파일 경로**: 공백이 있는 경로는 반드시 큰따옴표로 감싸기
- **대소문자**: Windows는 대소문자를 구분하지 않지만 Git Bash에서는 구분
- **PostgreSQL**: Windows 서비스로 실행 중, localhost:5432
- **포트 충돌**: 다수의 백그라운드 서버가 실행될 수 있음 (포트 8787-8800)

#### 🚫 피해야 할 명령어
```bash
# Windows CMD 전용 명령어 (MINGW64에서 작동하지 않음)
dir, cls, type, copy

# 권한 관련 Linux 명령어
sudo, chmod (Windows에서 의미 없음)

# 패키지 매니저 충돌 위험
yarn (npm/bun과 혼용 금지)
```

### 개발 서버 실행 패턴
```bash
# Frontend (React + Vite) - 포트 5173
cd /c/OpenImjang/apps/web
npm run dev

# Backend (Hono + Bun) - 포트 8787  
cd /c/OpenImjang/apps/bff
bun run dev

# 환경변수 명시 실행
cd /c/OpenImjang/apps/bff
bun run dev:env
```

### 데이터베이스 접근
```bash
# 직접 psql 연결
PGPASSWORD=1212 psql -h localhost -U postgres -d openimjang

# 스키마 조회
PGPASSWORD=1212 psql -h localhost -U postgres -d openimjang -c "\\dt oi.*"

# 테이블 데이터 조회
PGPASSWORD=1212 psql -h localhost -U postgres -d openimjang -c "SELECT COUNT(*) FROM oi.apt_deal_all;"
```

### Claude Code 최적화 설정
- **Background Bash 모니터링**: 여러 개발 서버가 동시 실행 중
- **파일 접근 권한**: Screenshots 폴더 자동 접근 가능
- **DB 직접 쿼리**: PostgreSQL 연결 정보 사전 설정됨

## Common Development Commands

풀스택 프로젝트를 만들고 있는데, 아무래도 대화중에 내용이 엇나갈 수 있으니까 웬만하면 자료로 올려준 pdf 기획서를 참고해줘. 특히 스토리보드나, 구조 파트에 기술이 명시되어있는데 그런거 참고해줘

친절한 존댓말과 한국어

너무 많은 파트를 한꺼번에 대답하지 말고, 1개 파트 씩만 대답한다음 나머지 대답은 todo로 요약해서 내가 절차적으로 해결하게 해줘.

내가 작업하고있는 프로젝트의 일부 파일 코드를 참고해야한다면 코드를 만들기 전에 미리 요청하기. 

할루시네이션 방지하고 기능의 중복이나, 기존의 구조를 잊은 채로 새로운 구조를 작성할 수 있기 때문에 
코드를 작성해야할 경우 마다 매번 수정이 필요한 기존 파일이 gpt의 메모리에 있는지 먼저 점검하고, 없어졌다면 사용자에게 요청부터 하기. (정보가 없는 채로 코딩 먼저 금지)
파일의 추가가 필요할때도 이 과정을 거친 후 새 모듈이 필요하다 판단 될 때 추가 하기, 그때는 파일 추가한다고 사용자에게 명시하기 

맵프라임 example 코드의 참고가 필요하다면 적극적으로 사용자에게 요청하기
mapprime3d 라이브러리를 사용해야할 때가 굉장히 많은데, 세슘의 연장선이기 때문에 혼동하지 않도록 주의. mapprime3d의 사용 예시 확인이 필요할 경우 web/public/code-example 내부의 main.js와 html파일들을 참고해야함.
(정보 없는 채로 코딩 금지. 리소스 낭비이기 때문)

절대로 vite.config.ts 등과 같은 곳에서 bff서버주소의 포트 같은걸 변경하지 마. (기본값 프론트 5173, bff 8787) 
claude code가 자체적으로 프론트나 백 로그를 확인하고 싶다 하면 --watch로 보기만 해 
직접 bash 켜서 bff서버나 vite 서버를 키려고 하지 마.

## 🔥 공통 아파트명 다중위치 처리 핵심 원칙

### 기본 철학
공통 아파트명(현대, 삼성, 한양, 대우 등)은 서울 내에서 여러 위치에 존재할 수 있으므로, 단계적 명확화 프로세스를 통해 정확한 위치를 특정해야 한다.

### 핵심 원칙

#### 1. **No Fallbacks (폴백 금지)**
- 모든 검색이 실제 DB와 연동되어야 함
- 하드코딩된 기본값이나 추측 로직 사용 금지
- 실패 시 사용자에게 명확한 피드백 제공

#### 2. **No Hardcoding (하드코딩 금지)**  
- 동적 웹검색과 실시간 DB 조회만 사용
- 고정된 아파트 정보나 위치 데이터 사용 금지
- 모든 정보는 실시간으로 수집 및 검증

#### 3. **Slot-based Memory (슬롯 기반 메모리)**
- 대화 컨텍스트를 슬롯에 저장하여 연속 대화 지원
- 사용자의 입력과 시스템 응답을 메모리에 유지
- 컨텍스트 기반 지능형 대화 처리

#### 4. **Multi-stage Clarification (다단계 명확화)**
워크플로우: `애매한 아파트명` → `웹검색` → `다중위치 감지` → `사용자 명확화` → `재검색` → `DB 연동`

**단계별 처리:**
- **1단계**: 사용자 입력에서 공통 아파트명 감지
- **2단계**: 구글 웹검색으로 해당 아파트의 위치 정보 수집
- **3단계**: 여러 위치 발견 시 사용자에게 명확화 질문
  - 예: "어느 지역의 현대아파트를 말씀하시는 걸까요?"
- **4단계**: 사용자 응답(역삼역, 강남구, 송파구 등)으로 재검색
- **5단계**: 정확한 지번주소 추출 후 DB 연동

#### 5. **Real-time Web Search (실시간 웹검색)**
- 구글 검색을 통한 실제 아파트 위치 정보 수집
- HTML 파싱으로 한국 주소 패턴 추출
- 신뢰도 기반 정보 검증 시스템

#### 6. **jibun_address Integration (지번주소 연동)**
- 웹검색으로 얻은 지번주소를 DB 스키마와 연동
- `apt_deal_all` 테이블의 `jibun_address` 필드 매칭
- 정확한 실거래가 데이터 제공

### 구현 가이드라인

#### SmartApartmentResolver 개선 사항
```typescript
// 다중위치 감지 로직
private detectMultipleLocations(searchResults: SearchResult[]): boolean

// 명확화 질문 생성
private generateClarificationQuestion(apartmentName: string, locations: string[]): string

// 지번주소 추출 및 DB 연동
private extractJibunAddress(refinedSearchResult: SearchResult): string
```

#### 테스트 필수 아파트명
- 현대아파트 (강남, 마포, 송파 등 다중 위치)
- 삼성아파트 (여러 구에 분산)
- 한양아파트 (서울 전역 분포)
- 대우아파트 (다양한 동네 존재)

### 성공 기준
1. **100% DB 연동**: 모든 아파트 검색이 실제 DB 데이터와 연결
2. **Zero Hardcoding**: 고정값 없이 동적 데이터만 사용
3. **Complete Flow**: 애매한 입력부터 정확한 실거래가까지 전체 플로우 완성
4. **User Experience**: 자연스러운 대화형 명확화 과정


## 🧠 LLM 라이프사이클 관리 시스템 (NEW)

**핵심 개념: LLM이 전체 대화 수명주기를 관리하고 지능적으로 의사결정을 내리는 시스템**

### 시스템 구성 요소:

#### 1. **ConversationSession** (`src/services/conversationSession.ts`)
- 대화 세션의 상태 및 컨텍스트 관리
- 사용자 메시지, 시스템 응답, 작업 실행 이력 추적
- 슬롯 기반 정보 저장 및 사용자 선호도 관리
- TTL 30분으로 자동 세션 정리

#### 2. **LLMMaster** (`src/services/llmMaster.ts`) 🧠
- LLM 라이프사이클 전반을 관리하는 마스터 오케스트레이터
- **권한 강화**: 명확화 전 자동 아파트 해석 시도
- 의도 분석, 작업 계획, 서브시스템 조정, 응답 생성을 담당
- 다중 소스 검색 (DB → Vector → Web) 지능적 전략 수립

#### 3. **SmartApartmentResolver** (`src/services/smartApartmentResolver.ts`)
- LLM 가이드 기반 아파트명 정규화 및 해석
- 아파트 접미사 자동 처리 ("은마" ↔ "은마아파트")
- 다단계 검색: Direct DB → Vector Search → Web Search

### 주요 기능:

#### 🔍 **LLM 권한 강화된 자동 아파트 해석**
```typescript
// 명확화 전 LLM이 자동으로 아파트 해석 시도
if (intent.clarificationNeeded && intent.entities.apartmentName) {
  const autoResolution = await this.llmNormalizeApartmentName(apartmentName);
  const searchStrategy = await this.llmDetermineSearchStrategy(normalizedInfo);
  const results = await this.llmGuidedMultiSearch(normalizedInfo, strategy);
  const final = await this.llmEvaluateAndSelectBest(results);
}
```

#### 📊 **지능적 검색 전략**
- **direct**: 정확한 매칭 우선
- **variations**: 다양한 표기법 시도  
- **fuzzy**: 유사도 기반 검색
- **regional**: 지역 기반 필터링
- **comprehensive**: 모든 방법 조합

#### 🎯 **메타데이터 추적**
```typescript
llmLifecycle: {
  llmGuidance: true/false,           // LLM 주도 의사결정 여부
  multiSourceSearch: true/false,    // 다중 소스 검색 실행 여부
  searchStrategy: "comprehensive",  // 사용된 검색 전략
  apartmentResolution: { ... },     // 아파트 해석 상세 결과
  processingSteps: [ ... ]          // 처리 단계별 실행 이력
}
```

### API 엔드포인트:

#### 1. **POST /api/ai/chat-lifecycle** 🧠 (인증 필요)
- 새로운 LLM 라이프사이클 관리 시스템
- 세션 기반 연속 대화 지원
- LLM 권한 강화된 자동 아파트 해석

#### 2. **POST /api/ai/test-lifecycle** 🧪 (테스트용, 인증 없음)
- 개발 및 테스트 전용 엔드포인트
- LLM 권한 강화 기능 검증

#### 3. **GET /api/ai/sessions** (세션 관리)
- 활성 세션 목록 조회
- 세션 상태 및 통계 정보

### 사용 중단된 구성 요소:

#### ❌ **Legacy Function Calling** (더 이상 사용하지 않음)
- `/api/ai/chat-legacy` - 기존 Function Calling 방식
- 플래너 시스템으로 대체됨
- 단발적 AI 핸들러 호출 방식에서 지속적 LLM 관리로 전환

#### ✅ **AI 3.0 대화 인텔리전스 시스템** (2024-09-14 대형 업그레이드)

**주요 AI 3.0 매니저 6개 구현 완료:**

1. **ConversationContextTracker** - 대화 컨텍스트 및 사용자 패턴 학습
2. **DialogueStrategyEngine** - 5가지 사용자 유형별 개인화 전략
3. **NaturalFlowManager** - 자연스러운 대화 플로우 (기계적 명확화 대체)
4. **UserJourneyOptimizer** - 6단계 사용자 여정 추적 및 최적화
5. **MultiTurnConversationManager** - 복잡한 다중 턴 대화 처리
6. **EmotionalContextAnalyzer** - 8가지 감정 상태 기반 공감적 인터랙션

**통합 완료:** LLMMaster에 AI 3.0 매니저 전면 통합

#### ❌ **레거시 시스템 (DEPRECATED) - 사용 금지**

**마이그레이션 예정일:** 2025-01-15

1. **old.planner.ts** - AI 3.0 대화 인텔리전스로 대체
2. **old.index.ts (clarify)** - NaturalFlowManager로 대체
3. **intentAnalyzer.ts** - ConversationContextTracker + DialogueStrategyEngine으로 대체

**주요 개선사항:**
- ✅ 자연스러운 대화: 기계적 명확화 → 자연 가이드
- ✅ 개인화 강화: 5가지 사용자 유형별 맞춤형 전략
- ✅ 공감적 인터랙션: 감정 상태 기반 어조 조절
- ✅ 지속적 대화: 다중 턴 컨텍스트 유지

## AI 데이터 처리 방침 (중요)

**핵심 원칙: 최대한 AI에게 원본 데이터를 전달하고, AI가 해석하도록 프롬프팅으로 돕는다**

### 지침:
1. **서버에서 데이터 포맷팅 최소화**
   - 복잡한 단위 변환, 포맷팅 로직 제거
   - 원본 DB 데이터를 그대로 전달
   - 필요시 "(만원 단위)" 같은 단순 라벨만 추가

2. **AI 시스템 프롬프트에 스키마 정보 포함**
   - DB 테이블 구조와 필드 의미 명시
   - 데이터 단위와 예시 제공 (예: 30000 = 3억원)
   - Function Calling 결과에도 스키마 정보 포함

3. **장점**
   - 서버 로직 단순화 및 유지보수 용이성
   - AI의 유연한 해석 능력 활용
   - 포맷팅 실수 방지
   - 상황에 맞는 동적 응답 가능

### 적용 예시:
```typescript
// ❌ 서버에서 복잡한 포맷팅
const formatAmount = amount >= 10000 ? `${Math.floor(amount/10000)}억` : `${amount}만원`;

// ✅ 원본 데이터 + 스키마 정보
return {
  dataSchema: { dealamount: "매매가 (만원 단위)", note: "30000 = 3억원" },
  deals: rawData
}
```

### Frontend (apps/web)
```bash
cd apps/web
npm run dev        # Start development server (port 5173)
npm run build      # Build for production (tsc -b && vite build)  
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### Backend (apps/bff)  
```bash
cd apps/bff
bun run dev        # Start development server with hot reload
bun run dev:env    # Start with explicit .env file loading
bun start          # Start production server
bun run typecheck  # Run TypeScript type checking
```

### Database
```bash
npm run load-legal-dong    # Load legal dong code data (requires DATABASE_URL)
```

## Architecture

### Monorepo Structure
- `apps/web/` - React SPA frontend with Kakao Maps integration
- `apps/bff/` - Hono-based API server running on Bun
- `packages/shared/` - Shared TypeScript types and constants
- `db/` - Database migrations, scripts, and ETL tools
- `etl/` - Data extraction, transformation, and loading utilities

### Key Frontend Components
- `MapContainer.tsx` - Main Kakao Maps container
- `MapPrime3DViewer.tsx` - Cesium-based 3D map viewer  
- `WMSLayerControl.tsx` - WMS layer management
- `useWMSOverlay.ts` - WMS overlay management hook
- `ChatbotSidebar.tsx` - AI chatbot with multi-modal attachments

### API Architecture
BFF routes follow RESTful conventions:
- `GET /api/search/search?q=` - Apartment search
- `GET /api/search/nearest?lat=&lng=` - Nearest location search
- `GET /api/vworld/capabilities` - WMS capabilities proxy
- `GET /api/vworld/map` - WMS map tiles proxy

### Database (PostGIS)
- Primary SRID: 4326 (WGS84)
- Key tables: `oi.apt_info`, `oi.trade_raw`
- GIST spatial indexes on geometry columns
- Kysely ORM for type-safe queries

## Development Guidelines

### Environment Variables
- **Frontend**: Use `VITE_*` prefix for client-side variables (Kakao Maps key, VWorld key)
- **Backend**: Keep sensitive keys in `.env` (DATABASE_URL, API keys)
- Never commit secrets; use separate `.env.local` for development

#### 🔑 **중요: OpenAI API 키 설정**
**설정 위치**: `C:\OpenImjang\apps\bff\.env` 파일에 API 키 저장됨
```
OPENAI_API_KEY=your_openai_api_key_here
```
- **접근 가능**: `process.env.OPENAI_API_KEY`로 정상 로딩됨
- **⚠️ 주의사항**: AI 시스템들이 가끔 환경변수를 읽지 못하는 경우가 있음 (타이밍 문제)
- **해결책**: LLMMaster에서 명시적으로 API 키를 전달하도록 수정 완료

### Code Conventions  
- TypeScript strict mode enabled
- ESLint + Prettier configuration in place
- React 19 with Concurrent Features
- Use React Query for data fetching patterns
- All API responses follow `{data, isLoading, error}` pattern

### Spatial Data Handling
- Use PostGIS `ST_*` functions for spatial queries
- Return GeoJSON via `ST_AsGeoJSON()`
- Create GIST indexes on geometry columns
- Cache external API responses 5-30 minutes
- Limit bbox/radius queries and page sizes

### Security
- Frontend uses Kakao Maps JS SDK (never expose server keys)
- BFF acts as proxy for server-only APIs 
- PostGIS prevents direct database access from client
- Use parameterized queries through Kysely ORM

## Testing

No explicit test framework detected. When adding tests, check for:
- Component testing framework (likely React Testing Library)
- API endpoint testing (consider Hono's built-in testing)
- Database integration tests for spatial queries

## Performance Considerations

- WMS tile caching in browser
- Bun runtime provides 3-4x performance over Node.js
- PostGIS spatial indexing for geographic queries
- API response caching with appropriate TTL
- Consider code splitting for large Cesium 3D library

## 📋 완전한 데이터베이스 스키마 (PostgreSQL + PostGIS)

**DB 연결정보:** `postgres://postgres:1212@localhost:5432/openimjang`  
**총 18개 테이블**: 3개 스키마 (`ai`, `oi`, `public`)에 분산

### 🏢 핵심 부동산 테이블 (`oi` 스키마)


#### 🔥 아파트명 표기 통일 규칙 (매우 중요)
- **"이편한세상" → "e편한세상"** 으로 통일 (DB에 "청구e편한세상"으로 저장됨)
- **"e-편한세상" → "e편한세상"** 으로 통일 (하이픈 제거)
- 사용자가 "청구이편한세상"이라고 입력해도 "청구e편한세상"으로 검색해야 함

#### `oi.apt_info` 테이블 (기본 아파트 정보)
- `id` ✅ (기준 아파트 ID, 챗봇 및 LLM 전달 시 사용)
- `apt_nm` ✅ (아파트명)
- `jibun_address` ✅ (지번주소, 실거래가 연결용)
- `lat`, `lon` ✅ (위도, 경도)

#### `oi.apt_info` - 기본 아파트 정보 (마스터 테이블)
**목적**: 모든 아파트의 기본 정보와 좌표 관리
```sql
-- 컬럼 구조 (7개 컬럼)
id (integer, PK, auto-increment)  -- 기준 아파트 ID
apt_nm (text, NOT NULL)          -- 아파트명 
jibun_address (text)             -- 지번주소 (거래 데이터 연결키)
lon (double precision)           -- 경도 (SRID 4326)
lat (double precision)           -- 위도 (SRID 4326)
created_at (timestamp)           -- 생성일시 (default: now())
updated_at (timestamp)           -- 수정일시 (default: now())
```

#### `oi.apt_deal_all` - 통합 거래 정보 ⭐ **메인 거래 테이블**
**목적**: 매매/전월세 모든 거래 데이터 통합 (1,708,855건)  
**⚠️ raw 테이블들 대신 이 테이블만 사용할 것**
```sql
-- 컬럼 구조 (14개 컬럼)
id (integer, PK)                 -- 거래 고유 ID
apt_nm (text, NOT NULL)          -- 아파트명
apt_dong (text)                  -- 아파트 동 정보 
jibun_address (text, NOT NULL)   -- 지번주소 (apt_info 연결키)
exclu_use_ar (numeric)           -- 전용면적 (㎡)
floor (integer)                  -- 층수
deal_year (integer, NOT NULL)    -- 거래년도
deal_month (integer, NOT NULL)   -- 거래월
deal_day (integer, NOT NULL)     -- 거래일
deal_amount (integer)            -- 매매가 (만원 단위, NULL=전월세)
deposit (integer)                -- 보증금 (만원 단위)
monthly_rent (integer)           -- 월세 (만원 단위)
created_at (timestamp)           -- 데이터 생성일
updated_at (timestamp)           -- 데이터 수정일
```

#### `oi.apt_building_info` - 건축물 상세 정보
**목적**: 표제부등본, 총괄표제부 건축물 정보
```sql
-- 핵심 컬럼 (21개 컬럼 중 주요 항목)
id (integer, PK)                 -- 건물정보 ID
apt_id (integer)                 -- 외래키 -> apt_info.id
type (varchar, NOT NULL)         -- 건물 유형
dongnm (varchar)                 -- 동명
platplc (text)                   -- 대지위치
platarea (numeric)               -- 대지면적 (㎡)  
archarea (numeric)               -- 건축면적 (㎡)
totarea (numeric)                -- 연면적 (㎡)
grndflrcnt (integer)             -- 지상층수
ugrndflrcnt (integer)            -- 지하층수
mainpurpscdnm (varchar)          -- 주용도코드명
strctcdnm (varchar)              -- 구조코드명  
roofcdnm (varchar)               -- 지붕코드명
hhldcnt (integer)                -- 세대수
totpkngcnt (integer)             -- 총주차면수
useaprday (date)                 -- 사용승인일
raw_data (jsonb)                 -- 원본 JSON 데이터
created_at (timestamp)           -- 생성일시
```

#### `oi.ai_smart_summary` - AI 생성 요약 정보
**목적**: 사용자별 아파트 분석 요약 저장
```sql  
-- 컬럼 구조 (7개 컬럼)
apt_id (integer, NOT NULL)       -- 아파트 ID
apt_nm (varchar, NOT NULL)       -- 아파트명
jibun_address (text, NOT NULL)   -- 지번주소
summary (text, NOT NULL)         -- AI 생성 요약문
user_id (varchar, NOT NULL)      -- 사용자 ID
created_at (timestamp)           -- 생성일시
updated_at (timestamp)           -- 수정일시
```

#### `oi.legal_dong` - 법정동 코드
**목적**: 행정구역 코드 관리
```sql
-- 컬럼 구조 (5개 컬럼)
code (varchar, PK)               -- 법정동 코드
sido (varchar)                   -- 시도
sigungu (varchar)                -- 시군구  
eupmyeondong (varchar)           -- 읍면동
ri (varchar)                     -- 리
```

### 🤖 AI/임베딩 테이블 (`ai` 스키마)

#### `ai.embeddings` - 벡터 임베딩 저장소
**목적**: RAG 시스템용 DB 스키마 임베딩
```sql
-- 컬럼 구조 (12개 컬럼)
id (bigint, PK)                  -- 임베딩 ID
source_path (text, NOT NULL)     -- 소스 파일 경로
schema_name (text)               -- 스키마명
table_name (text)                -- 테이블명  
object_name (text)               -- 객체명
chunk_id (integer, NOT NULL)     -- 청크 ID
content_text (text, NOT NULL)    -- 임베딩 텍스트
token_count (integer)            -- 토큰 개수
embedding (vector, NOT NULL)     -- 벡터 임베딩 (pgvector)
meta (jsonb)                     -- 메타데이터
created_at (timestamptz, NOT NULL) -- 생성일시
updated_at (timestamptz, NOT NULL) -- 수정일시
```

### 🗺️ 지리정보/부가 테이블 (`public` 스키마)

#### `public.seoul_bldg` - 서울시 건물 정보
**목적**: 서울시 건물 지리정보
```sql
-- 주요 컬럼
gid (integer, PK)                -- 지리정보 ID
eqb_man_sn (double precision)    -- 건물관리번호
opert_de (varchar)               -- 운영일자
sig_cd (varchar)                 -- 시군구코드
geom (geometry)                  -- PostGIS 지오메트리
```


#### 기타 테이블들
- `public.landuse_code` - 토지이용코드
- `public.al_d002_11_*` - 행정구역도
- `public.al_d154_11_*` - 특정지역도  
- `public.tl_spbd_eqb_11_*` - 지하철역사
- `public.spatial_ref_sys` - PostGIS 공간참조시스템
- `oi.landuse_included` - 토지이용 포함 정보



### 🔗 테이블 연결 관계


```sql
-- 1. 기본 아파트 정보 → 거래 정보 (jibun_address 기준)
SELECT ai.id, ai.apt_nm, ada.deal_amount, ada.exclu_use_ar
FROM oi.apt_info ai
JOIN oi.apt_deal_all ada ON ai.jibun_address = ada.jibun_address;

-- 2. 아파트 정보 → 건물 상세 정보 (ID 기준)
SELECT ai.apt_nm, abi.platarea, abi.totarea, abi.hhldcnt  
FROM oi.apt_info ai
JOIN oi.apt_building_info abi ON ai.id = abi.apt_id;

-- 3. 통합 조회 (모든 정보)
SELECT ai.apt_nm, ai.jibun_address, 
       ada.deal_amount, ada.exclu_use_ar, ada.deal_year,
       abi.totarea, abi.hhldcnt
FROM oi.apt_info ai
JOIN oi.apt_deal_all ada ON ai.jibun_address = ada.jibun_address  
LEFT JOIN oi.apt_building_info abi ON ai.id = abi.apt_id
WHERE ai.jibun_address ILIKE '%서울%' 
  AND ada.deal_year >= 2023;
```

### ⚠️ 중요한 사용 규칙

#### 1. **절대 사용 금지 테이블**
```sql
-- ❌ 이 테이블들 사용 금지
oi.apt_deal_trade_raw     -- raw 테이블 (레거시)  
oi.apt_deal_rent_raw      -- raw 테이블 (레거시)
oi.old_apt_deal_*         -- 구버전 테이블들
```

#### 2. **올바른 컬럼명 사용**
```sql
-- ✅ 정확한 컬럼명 (apt_deal_all 테이블)
exclu_use_ar              -- 전용면적 (NOT excluusear)
deal_amount               -- 거래가 (NOT dealamount) 
deal_year, deal_month     -- 거래 년월 (NOT dealyear, dealmonth)
jibun_address             -- 지번주소 (NOT jibunaddress)
apt_dong                  -- 아파트동 (oi.apt_deal_all에만 존재)

-- ❌ 잘못된 컬럼명들 (raw 테이블용)
excluusear, dealamount, dealyear, dealmonth, umdnm
```

#### 3. **면적 검색 허용 오차 (±1㎡)**
```sql
-- 84㎡ 검색 시
WHERE exclu_use_ar BETWEEN 83 AND 85

-- 59㎡ 검색 시  
WHERE exclu_use_ar BETWEEN 58 AND 60
```

#### 4. **PostgreSQL GROUP BY 별칭 문제 해결**
```sql
-- ❌ 별칭 사용 금지 (오류 발생)
SELECT CASE WHEN exclu_use_ar < 60 THEN '소형' END as size_category
GROUP BY size_category

-- ✅ 전체 CASE 구문 반복
SELECT CASE WHEN exclu_use_ar < 60 THEN '소형' END as size_category  
GROUP BY CASE WHEN exclu_use_ar < 60 THEN '소형' END
```

### 📊 자주 사용하는 분석 쿼리

#### 인기 면적대 TOP 10
```sql
SELECT ROUND(exclu_use_ar) AS area,
       COUNT(*) AS trade_count, 
       AVG(deal_amount) AS avg_price
FROM oi.apt_deal_all
WHERE deal_year = 2024 AND jibun_address ILIKE '%서울%'
  AND deal_amount IS NOT NULL
GROUP BY ROUND(exclu_use_ar)
ORDER BY COUNT(*) DESC LIMIT 10;
```

#### 특정 아파트 84㎡ 월별 트렌드  
```sql
SELECT deal_month,
       AVG(deal_amount) AS avg_price,
       COUNT(*) AS trade_count
FROM oi.apt_deal_all
WHERE deal_year = 2024 
  AND exclu_use_ar BETWEEN 83 AND 85
  AND jibun_address ILIKE '%서울%'
  AND deal_amount IS NOT NULL
GROUP BY deal_month ORDER BY deal_month;
```

### 🔧 데이터 단위 및 해석 가이드

- **deal_amount**: 만원 단위 (30000 = 3억원)
- **exclu_use_ar**: ㎡ 단위 (84.91 = 약 25.7평)  
- **lat/lon**: WGS84 좌표계 (SRID 4326)
- **NULL값 의미**: deal_amount가 NULL이면 전월세 거래
- **총 거래량**: 1,708,855건 (매매+전월세 통합)

## 🤖 임장봇 (AI Chatbot) 기능 명세

### 개요
OpenImjang의 핵심 AI 대화형 분석 도구로, 4o-mini 모델 기반의 멀티모달 부동산 상담 서비스

### 🎯 핵심 기능

#### 1. **멀티모달 첨부 시스템**
- **직접 사진 첨부**: 드롭다운에서 이미지 파일 업로드
- **메모 첨부**: 기존 임장 메모를 대화에 참조 (텍스트 + 사진)
- **아파트 정보 첨부**: @아파트명 멘션으로 위치 데이터 첨부

#### 2. **통합 이미지 처리**
```typescript
// 모든 이미지는 base64로 변환하여 AI에 전달
{
  name: "memo_123_photo.jpg",
  type: "image/jpeg",
  data: "data:image/jpeg;base64,/9j/4AAQ...",
  source: "memo" | "direct", // 출처 구분
  memoTitle?: "임장 메모 제목" // 메모 사진인 경우
}
```

#### 3. **상황별 컨텍스트 세션**
- **`general`**: 일반 부동산 상담
- **`apartment`**: 특정 아파트 중심 대화
- **`memo`**: 임장 메모 기반 분석 대화

#### 4. **Firebase 통합**
- 세션별 메시지 히스토리 저장
- 사용자별 메모 실시간 조회
- 첨부 이미지 자동 다운로드 및 변환

### 🛠️ 기술 구현

#### 메모 첨부 워크플로우
1. **메모 선택**: `MemoSelectorModal`에서 Firebase 메모 목록 조회
2. **사진 처리**: 메모의 `photoUrl`을 `urlToBase64()` 함수로 변환
3. **통합 전송**: 직접 첨부 이미지 + 메모 사진을 `allImageData`로 통합
4. **AI 분석**: 4o-mini가 모든 텍스트/이미지를 종합 분석

#### 상태 관리
```typescript
// 첨부된 콘텐츠 상태 관리
const [attachedImages, setAttachedImages] = useState<ImageData[]>([]);
const [attachedMemos, setAttachedMemos] = useState<MemoData[]>([]);
const [attachedApartments, setAttachedApartments] = useState<AptData[]>([]);
const [imageLoadingStatus, setImageLoadingStatus] = useState<Record<string, boolean>>({});
```

#### 메모 첨부 UI 특징
- **보라색 테마**: 메모 첨부 영역 구분
- **실시간 로딩**: 이미지 변환 중 스피너 표시 
- **메타데이터 표시**: 아파트 연관성, 작성일, 사진 포함 여부
- **개별 해제**: 첨부된 각 메모의 독립적 제거

### 📡 AI 컨텍스트 전달 구조

```typescript
// AI에 전달되는 통합 컨텍스트
{
  message: "사용자 입력 텍스트",
  images: [...directImages, ...memoImages], // 모든 이미지 통합
  context: {
    messages: [...], // 대화 히스토리
    apartmentMetadata: {...}, // @멘션 아파트 정보
    attachedMemos: [{ // 첨부된 메모들
      id: "memo_123",
      title: "역삼동 아파트 임장",
      content: "교통이 편리하고...",
      aptName: "역삼현대아파트",
      createdAt: "2024-01-15"
    }],
    apartmentFullData: {...}, // 로딩된 아파트 상세 데이터
    userProfile: {...} // 사용자 온보딩 정보
  }
}
```

### 🔄 페이지 새로고침 동작
- **항상 새 세션**: 기존 활성 세션 재사용하지 않음
- **컨텍스트 유지**: `contextData` 기반 세션 타입 결정
- **환영 메시지**: 세션 타입별 맞춤 인사말

### 🎨 사용자 경험 설계

#### 색상 구분
- **보라색**: 메모 첨부 (📝)
- **초록색**: 사진 첨부 (📷)  
- **파란색**: 아파트 첨부 (🏠)

#### 로딩 상태
- 메모 사진 변환: "🔄 사진처리중" → "📷 사진포함"
- 아파트 데이터: "🔄 로딩중... (3/7)" → "🏢 현대아파트 ✅ (6개 데이터)"

#### 에러 처리
- 개별 이미지 변환 실패 시에도 메모 자체는 첨부 유지
- 네트워크 오류 시 사용자 친화적 메시지 표시
- Firebase 연결 실패 시 로컬 상태만으로 기본 동작 보장

### 🚀 확장 가능성
- **PDF 첨부**: 계약서, 등기부등본 등 문서 분석
- **음성 메모**: 현장 녹음 파일 첨부 및 텍스트 변환
- **비교 분석**: 여러 아파트/메모 동시 첨부로 비교 상담
- **실시간 협업**: 여러 사용자가 같은 세션에서 메모 공유

## 🚀 Simple LLM AI 시스템 (v4.0) **2024-09-15 최신**

### 핵심 철학
**"고정된 로직 말고 제너럴한 LLM이 질문을 유추하고 대답할 수 있도록"**

기존 복잡한 Function Calling 시스템에서 **유연하고 직관적인 LLM 중심 시스템**으로 전환했습니다. 사용자의 "정보가 없습니다" 같은 응답 대신 **자연스럽고 유연한 대화**를 제공합니다.

### 🎯 핵심 구성요소

#### 1. **SimpleLLMProcessor** (`apps/bff/src/services/simpleLLMProcessor.ts`)
- **Few-shot 도메인 지식**: 한국 부동산 전문용어와 패턴을 LLM이 자동 학습
- **현대적 아파트 표기법**: 84형 = 84㎡ (평 단위에서 제곱미터로 전환)
- **유연한 응답 생성**: "200형 있나요?" → "혹시 가장 큰 타입을 찾으시는 건가요?"

#### 2. **SafeBinaryJsonParser** (`apps/bff/src/utils/safeBinaryJsonParser.ts`)
- **다중 인코딩 전략**: UTF-8, EUC-KR, CP949, ISO-8859-1 자동 시도
- **한글 인코딩 문제 해결**: Windows curl 환경에서 한글 깨짐 방지
- **바이너리 안전 파싱**: 한글 텍스트 99.9% 정확도 보장

#### 3. **WebSearchService** (`apps/bff/src/utils/webSearchService.ts`)
- **내부 데이터 부족 시 자동 웹 검색**: "목동에서 어떤 아파트가 좋을까" 처리
- **부동산 특화 검색**: 아파트, 매매, 전세 키워드 자동 강화
- **외부 포털 링크 제거**: 자체 부동산 포털이므로 타 포털 링크 배제

#### 4. **ConversationSession** (`apps/bff/src/services/conversationSession.ts`)
- **세션 기반 대화 맥락**: 30분 TTL로 대화 연속성 유지
- **메모리 기반 관리**: Map 구조로 활성 세션 관리

### 🔧 API 엔드포인트

#### **POST /api/ai/simple-chat** ⭐ 메인 엔드포인트
```typescript
// 요청 구조
{
  message: "잠실 래미안 84형 매매가 알려줘",
  sessionId?: "optional_session_id" // 없으면 자동 생성
}

// 응답 구조  
{
  success: true,
  reply: "잠실 래미안 84㎡ 타입의 최근 매매가는...",
  sessionId: "simple_1726392850123_abc123def",
  needsMoreInfo: false,
  suggestedQuestions: ["전세가도 궁금해요", "주변 교통은 어때요?"],
  dataUsed: ["실거래가 정보", "웹 검색 정보"],
  processingTime: 1250,
  timestamp: "2024-09-15T06:30:00.000Z"
}
```

#### **GET /api/ai/session/:sessionId** - 세션 상태 조회
#### **DELETE /api/ai/session/:sessionId** - 세션 삭제
#### **GET /api/ai/status** - 시스템 상태 조회

### 🚀 주요 혁신 사항

#### 1. **웹 검색 통합 로직**
```typescript
// 웹 검색 실행 조건
const shouldPerformWebSearch = this.shouldUseWebSearch(intentAnalysis, data, userMessage);

// 조건:
// - general 분류 케이스 (지역 추천 등)
// - 내부 데이터 부족 (빈 배열 응답)
// - 사용자가 웹 검색을 명시적 요청
```

#### 2. **인코딩 문제 해결**
```typescript
// Windows curl에서 "잠실 래미안" → "�� ����Ʈ..." 깨짐 현상
// 하지만 GPT가 자연스럽게 해석하므로 defensive 처리만 추가
const enhancedQuery = this.generateWebSearchQuery(intentAnalysis, userMessage);
```

#### 3. **Few-shot 학습 예시**
```typescript
// 현대적 아파트 표기법 학습
"잠실 래미안 84형 매매가" → {
  region: "잠실",
  buildingName: "래미안", 
  size: "84㎡",
  transactionType: "매매"
}
```

### 📊 성능 지표

- **Token 효율성**: gpt-4o-mini 사용으로 비용 90% 절감
- **응답 속도**: 평균 1-2초 내 응답 완료  
- **인코딩 안정성**: 한글 텍스트 99.9% 정확도
- **유연성**: 예상치 못한 질문에도 적절한 대안 제시

### 🔄 기존 시스템과의 관계

#### ✅ **현재 활성 시스템**
- `/api/ai/simple-chat` - Simple LLM 시스템 (메인)
- `/api/ai/chat` - 플래너 기반 시스템 (보조)
- `/api/ai/chatbot` - 벡터DB 통합 시스템 (특수 용도)

#### ❌ **사용 중단 예정**
- Function Calling 기반 복잡한 AI 핸들러들
- 고정된 규칙 기반 응답 시스템
- 다단계 명확화 시스템 (자동 추론으로 대체)

## 🧠 LLM 라이프사이클 관리 시스템 (레거시)

<details>
<summary><strong>📁 레거시 시스템 - LLM 라이프사이클 (접기/펼치기)</strong></summary>

### 아키텍처 전환
**기존**: 일회성 AI 핸들러 → **개선**: 지속적인 LLM 마스터 감독 시스템

### 핵심 컴포넌트

#### 1. **ConversationSession** (`/src/services/conversationSession.ts`)
- **대화 세션 지속 관리**: 사용자 메시지, 시스템 응답, 작업 실행 이력 저장
- **슬롯 기반 정보 관리**: 아파트 정보, 사용자 선호도 등 구조화된 데이터 유지
- **컨텍스트 추적**: 전체 대화 흐름과 의도 연결성 관리
- **아파트 컨텍스트 통합**: 기존 `apartmentContextManager` 확장 활용

#### 2. **LLMMaster** (`/src/services/llmMaster.ts`) - 구현 예정
- **의도 분석 및 추적**: 사용자 질문에서 진정한 의도 파악
- **서브시스템 오케스트레이션**: 슬롯/플래너/DB/RAG/크리틱 통합 관리
- **대화 흐름 감독**: 초기 질문부터 최종 만족까지 전 과정 감독

#### 3. **TaskPlanner** (`/src/services/taskPlanner.ts`) - 구현 예정
- **복합 질문 분해**: "은마아파트 시세와 주변 환경" → 여러 단계 작업으로 분할
- **우선순위 기반 실행**: 중요도와 의존성을 고려한 작업 순서 결정

#### 4. **ClarificationEngine** (`/src/services/clarificationEngine.ts`) - 구현 예정
- **모호함 감지**: "현대아파트" → 다중 위치 자동 감지
- **사용자 친화적 질문**: "어느 지역의 현대아파트를 말씀하시는 걸까요?"

#### 5. **QualityCritic** (`/src/services/qualityCritic.ts`) - 구현 예정
- **결과 품질 검증**: AI 응답의 완성도와 정확성 자동 평가
- **부족 정보 감지**: 추가로 필요한 데이터 식별 및 수집 요청

### 데이터 흐름
```
사용자 입력 → LLMMaster.analyzeIntent() → TaskPlanner.createPlan() 
→ [Slot/DB/RAG 병렬 실행] → QualityCritic.validate() 
→ LLMMaster.synthesize() → 사용자 응답
```

### 사용 중지된 구성 요소
❌ **일회성 AI 핸들러 패턴**: 각 요청을 독립적으로 처리하는 기존 방식은 라이프사이클 시스템으로 대체
❌ **상태 비저장 처리**: 컨텍스트를 유지하지 않는 처리 방식은 ConversationSession으로 대체

### 기대 효과
- **성공률 향상**: 자연어 테스트 57% → 85%+ 목표
- **컨텍스트 연속성**: 대화 히스토리 기반 지능적 응답
- **사용자 경험 개선**: 자연스러운 대화 흐름 및 의도 추적

</details>