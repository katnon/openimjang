# OpenImjang (오픈임장)

## Project Overview

OpenImjang is a real-time real estate risk analysis and spatial information visualization platform. It is built with a modern web technology stack, featuring a Monorepo + BFF (Backend for Frontend) architecture.

- **Frontend:** A React Single Page Application (SPA) using Vite, TypeScript, and TailwindCSS. It integrates with Kakao Maps API, OpenLayers, and Cesium for advanced mapping and 3D visualization.
- **Backend:** A high-performance Backend for Frontend (BFF) built with Bun, Hono, and Kysely for type-safe database queries.
- **Database:** PostgreSQL with the PostGIS extension for storing and querying spatial data.
- **Monorepo:** The project is structured as a monorepo, with the frontend and backend applications located in the `apps` directory, and shared packages in the `packages` directory.

## Building and Running

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

### Prerequisites

- Bun 1.0+ or Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Git

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/OpenImjang.git
    cd OpenImjang
    ```
2.  **Install dependencies:**
    ```bash
    # Recommended
    bun install

    # Or with npm
    npm install
    ```

### Environment Variables

You will need to create `.env` files for both the frontend and backend applications.

-   **Frontend (`apps/web/.env.local`):**
    ```
    VITE_KAKAO_JS_KEY=your_kakao_javascript_key
    VITE_VWORLD_KEY=your_vworld_api_key
    VITE_VWORLD_DOMAIN=localhost
    ```
-   **Backend (`apps/bff/.env`):**
    ```
    DATABASE_URL=postgresql://username:password@localhost:5432/openimjang
    VWORLD_KEY=your_vworld_api_key
    VWORLD_DOMAIN=localhost
    KAKAO_REST_KEY=your_kakao_rest_api_key
    RTMS_API_KEY=your_molit_rtms_api_key
    ```

### Database Setup

1.  **Create the database and enable PostGIS:**
    ```bash
    createdb openimjang
    psql -d openimjang -c "CREATE EXTENSION postgis;"
    ```
2.  **Initialize the schema:**
    ```bash
    # The README mentions a migrations/init.sql file, but it is not present in the project structure.
    # You may need to create it or use the migrations in the db/migrations folder.
    # For now, you can try to run the following command:
    psql -U postgres -d openimjang -f db/migrations/init.sql
    ```

### Running the Application

-   **Run both frontend and backend concurrently:**
    ```bash
    npm run dev
    ```
-   **Run separately:**
    ```bash
    # Backend (http://localhost:3000)
    cd apps/bff
    bun run dev

    # Frontend (http://localhost:5173)
    cd apps/web
    bun run dev
    ```

### Data Loading

-   **Load legal dong data:**
    ```bash
    npm run load-legal-dong
    ```
-   **Fetch real estate trade data:**
    ```bash
    cd db/scripts/fetch
    bun run fetch_trade_raw.ts
    ```

## Development Conventions

-   **Coding Style:** The project uses ESLint and Prettier for code formatting and style consistency. Refer to `eslint.config.js` and the `prettier` configuration in `package.json` for details.
-   **TypeScript:** The project enforces strict TypeScript rules for type safety.
-   **API Design:** The BFF exposes a RESTful API. Refer to the "API 설계 원칙" section in the `README.md` for more details.
-   **Testing:** The `README.md` mentions a testing strategy using `bun test`, but no test files are visible in the project structure. You may need to create them.
