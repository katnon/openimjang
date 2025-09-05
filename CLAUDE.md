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

절대로 vite.config.ts 등과 같은 곳에서 bff서버주소의 포트 같은걸 변경하지 마. 
claude code가 자체적으로 bash켜서 테스트를 해보고 로그를 확인해본다 하면, 무조건 프론트 5173 bff 8787포트로만 해. 
항상 해당 포트로 프론트와 bff 켜져있으니 로그 확인하고싶으면 해당포트에서 테스트 해봐.
만약 접근 불가할경우 기존 5173,8787 끈 다음에 직접 같은 포트로 다시 켜.

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