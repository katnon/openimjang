# OpenImjang (오픈임장)

부동산 위험도 분석 플랫폼

## 🏗️ 프로젝트 구조

```
openimjang/
├─ apps/
│  ├─ web/                     # 프런트: React + Vite + TS
│  └─ bff/                     # 백엔드: Bun + Hono
├─ packages/
│  └─ shared/                  # 공용 타입 & 상수
├─ db/                         # PostGIS 스키마/마이그레이션
├─ etl/                        # 데이터 적재 스크립트
└─ data/                       # 정적 데이터
```

## 🚀 시작하기

### 필수 요구사항
- Node.js 18+
- Bun 1.0+
- PostgreSQL 14+ with PostGIS

### 설치 및 실행

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **환경 변수 설정**
   ```bash
   # apps/web/.env.local
   VITE_KAKAO_JS_KEY=your_kakao_key
   
   # apps/bff/.env
   DATABASE_URL=postgresql://user:pass@localhost:5432/openimjang
   KAKAO_REST_KEY=your_kakao_rest_key
   ```

3. **데이터베이스 설정**
   ```bash
   cd db
   psql -U postgres -d openimjang -f migrations/0001_init.sql
   psql -U postgres -d openimjang -f migrations/0002_indexes.sql
   psql -U postgres -d openimjang -f migrations/0003_views.sql
   ```

4. **개발 서버 실행**
   ```bash
   npm run dev
   ```

## 📚 주요 기능

- **지도 기반 부동산 정보**: 카카오맵 API 연동

- **용도지역 정보**: 지구·지적 겹침 분석
- **주변 시설**: POI, 역, 정류장 정보

## 🛠️ 기술 스택

- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Bun, Hono, TypeScript
- **Database**: PostgreSQL, PostGIS
- **Maps**: Kakao Maps API
- **Data**: 국토부 API, vWorld WFS

## �� 라이선스

MIT License
