# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenImjang is a real-time real estate risk analysis and spatial information visualization platform using a **Monorepo + BFF (Backend for Frontend)** architecture.

**Stack:** React + Vite + TypeScript (SPA), Hono BFF on Bun, PostGIS (SRID 4326)

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

## 데이터베이스 컬럼명 지침 (매우 중요)

### 실제 DB 스키마와 컬럼명 (혼동 방지용)

**⚠️ AI 쿼리 생성 시 반드시 아래 정확한 컬럼명 사용하기**

#### 🔥 아파트명 표기 통일 규칙 (매우 중요)
- **"이편한세상" → "e편한세상"** 으로 통일 (DB에 "청구e편한세상"으로 저장됨)
- **"e-편한세상" → "e편한세상"** 으로 통일 (하이픈 제거)
- 사용자가 "청구이편한세상"이라고 입력해도 "청구e편한세상"으로 검색해야 함

#### `oi.apt_info` 테이블 (기본 아파트 정보)
- `id` ✅ (기준 아파트 ID, 챗봇 및 LLM 전달 시 사용)
- `apt_nm` ✅ (아파트명)
- `jibun_address` ✅ (지번주소, 실거래가 연결용)
- `lat`, `lon` ✅ (위도, 경도)

#### `oi.apt_deal_all` 테이블 (모든 거래 정보 통합, raw 테이블 대체)
- `exclu_use_ar` ✅ (전용면적)
- `jibun_address` ✅ (지번주소, apt_info와 연결 및 지역 필터링용)
- `deal_year`, `deal_month`, `deal_day` ✅
- `deal_amount` ✅ (매매가, 만원 단위)
- `deposit`, `monthly_rent` ✅ (보증금, 월세)
- `apt_nm`, `apt_dong`, `floor` ✅

#### `oi.apt_building_info` 테이블 (건물 상세 정보: 표제부등본, 총괄표제부)
- `apt_id` ✅ (외래키: apt_info.id 참조)
- `type` ✅ (건물 유형)
- `dongnm` ✅ (동명)
- `bldnm` ✅ (건물명)
- `platplc` ✅ (소재지)
- `platarea` ✅ (대지면적)
- `archarea` ✅ (건축면적)
- `totarea` ✅ (총면적)
- `grndflrcnt` ✅ (지상층수)
- `ugrndflrcnt` ✅ (지하층수)
- `mainpurpscdnm` ✅ (주용도명)
- `strctcdnm` ✅ (구조명)
- `roofcdnm` ✅ (지붕명)
- `hhldcnt` ✅ (세대수)
- `mainbldcnt` ✅ (주건축물수)
- `atchbldcnt` ✅ (부속건축물수)
- `totpkngcnt` ✅ (총주차대수)
- `useaprday` ✅ (사용승인일)
- `raw_data` ✅ (원본 데이터 JSON)
- `created_at` ✅ (생성일시)

### 테이블 간 연결 방법
```sql
-- apt_info와 apt_building_info 연결 (ID 기준)
SELECT ai.apt_nm, abi.* 
FROM oi.apt_info ai
JOIN oi.apt_building_info abi ON ai.id = abi.apt_id

-- apt_info와 apt_deal_all 연결 (jibun_address 기준)
SELECT ai.apt_nm, ada.deal_amount
FROM oi.apt_info ai  
JOIN oi.apt_deal_all ada ON ai.jibun_address = ada.jibun_address

-- 지역 필터링 (서울)
WHERE jibun_address ILIKE '%서울%'
```

### 면적별 분석 쿼리 패턴

#### 1. 면적 허용 오차(±1㎡) 적용
```sql
-- 84㎡ 전후 범위 분석
WHERE excluusear BETWEEN 83 AND 85
```

#### 2. 면적 그룹핑 방법
```sql
-- 반올림 그룹핑 (추천)
GROUP BY ROUND(exclu_use_ar)

-- 10㎡ 단위 그룹핑
GROUP BY FLOOR(excluusear/10)*10
```

#### 3. PostgreSQL Alias 충돌 방지
```sql
-- ❌ 잘못된 예 (alias 충돌)
SELECT CASE WHEN ... THEN '소형' END as size_category
GROUP BY size_category  -- 오류 발생

-- ✅ 올바른 예
SELECT CASE WHEN ... THEN '소형' END as size_category  
GROUP BY CASE WHEN ... THEN '소형' END
```

### 자주 사용하는 면적별 분석 쿼리

#### 인기 면적대 TOP 10
```sql
SELECT ROUND(exclu_use_ar) AS area,
       COUNT(*) AS trade_count,
       AVG(deal_amount) AS avg_price
FROM oi.apt_deal_all
WHERE deal_year = 2024 AND jibun_address ILIKE '%서울%'
GROUP BY ROUND(exclu_use_ar)
ORDER BY COUNT(*) DESC LIMIT 10;
```

#### 84㎡ ±1㎡ 월별 트렌드
```sql  
SELECT dealmonth,
       AVG(dealamount) AS avg_price,
       COUNT(*) AS trade_count
FROM oi.apt_deal_trade_raw
WHERE dealyear = 2024 
  AND excluusear BETWEEN 83 AND 85
  AND umdnm ILIKE '%동'
GROUP BY dealmonth ORDER BY dealmonth;
```

### ⚠️ 절대 규칙 - 테이블 사용 지침 (중요)

**1. raw 테이블 사용 금지**
- `apt_deal_trade_raw`, `apt_deal_rent_raw` 등 raw 테이블은 **절대 사용하지 않기**
- **오직 `apt_deal_all` 테이블만 사용** (모든 거래 정보가 통합되어 있음)

**2. AI 쿼리 생성 프롬프트에서 컬럼명 정확히 명시**
- forceSchemaHints에서 정확한 테이블명과 컬럼명 강제 지정
- 예: `'oi.apt_deal_all(deal_amount, exclu_use_ar, deal_year, jibun_address)'`

**3. 면적 허용 오차(±1㎡) 로직 적용**
- 84㎡ 검색 시: `exclu_use_ar BETWEEN 83 AND 85` 
- 59㎡ 검색 시: `exclu_use_ar BETWEEN 58 AND 60`
- 이를 통해 더 많은 거래 데이터 확보 가능

### 컬럼명 혼동 방지 체크리스트

**❌ 잘못된 컬럼명들 (절대 사용 금지)**
- `apt_dong` (존재하지 않음)
- `excluusear` (raw 테이블 전용)
- `dealyear`, `dealmonth`, `dealamount` (raw 테이블 전용)
- `jibunaddress` (언더스코어 없음 - 잘못됨)

**✅ 올바른 컬럼명들 (apt_deal_all 테이블)**
- `exclu_use_ar` ✅ (전용면적)
- `deal_year`, `deal_month`, `deal_day` ✅
- `deal_amount` ✅ (거래가)
- `jibun_address` ✅ (지번주소)

### 중요 참고사항
1. **임베딩 DB 스키마는 정확함**: RAG 시스템의 schema 문서들이 실제 DB와 일치
2. **apt_deal_all 테이블만 사용**: raw 테이블들은 더 이상 사용하지 않음 
3. **면적별 분석 성공률**: apt_deal_all 테이블 사용 시 3/7 성공 (43%), PostgreSQL alias 문제 해결 필요
4. **PostgreSQL GROUP BY 별칭 문제**: `HAVING area_group != '기타'` 대신 전체 CASE 구문 반복 사용