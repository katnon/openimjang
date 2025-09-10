-- 1) 로그인 가능한 읽기전용 롤 생성 (만료 시간 반드시 지정)
CREATE ROLE cc_readonly LOGIN PASSWORD '0000'
  VALID UNTIL 'infinity';

-- 2) 데이터베이스 접속 권한 최소화
REVOKE ALL ON DATABASE openimjang FROM cc_readonly;
GRANT CONNECT ON DATABASE openimjang TO cc_readonly;

-- 3) 스키마 사용 권한 (필요 스키마별 반복)
GRANT USAGE ON SCHEMA public TO cc_readonly;
GRANT USAGE ON SCHEMA oi TO cc_readonly;

-- 4) 테이블/시퀀스 SELECT 권한 부여 (기존 객체)
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO cc_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO cc_readonly;
GRANT SELECT ON ALL TABLES    IN SCHEMA oi TO cc_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA oi TO cc_readonly;

-- 5) 앞으로 생성될 객체의 기본 권한도 SELECT 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO cc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON SEQUENCES TO cc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA oi
GRANT SELECT ON TABLES TO cc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA oi
GRANT SELECT ON SEQUENCES TO cc_readonly;


-- (선택) 다른 스키마도 동일 패턴으로 반복
-- GRANT USAGE ON SCHEMA realestate TO cc_readonly; ...
ALTER ROLE cc_readonly VALID UNTIL 'infinity';

-- 로그인 막기(임시)
ALTER ROLE cc_readonly NOLOGIN;

-- 이 데이터베이스(openimjang)에서 cc_readonly 세션 종료
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'cc_readonly'
  AND datname = 'openimjang'
  AND pid <> pg_backend_pid();

-- (선택) 혹시라도 소유 객체가 있다면 postgres 등 다른 롤로 소유권 이전
REASSIGN OWNED BY cc_readonly TO postgres;

-- cc_readonly가 가진 권한/소유 모두 제거
DROP OWNED BY cc_readonly;

DROP ROLE cc_readonly;



-- 0) 확장 설치
CREATE EXTENSION IF NOT EXISTS vector;

-- 1) 전용 스키마
CREATE SCHEMA IF NOT EXISTS ai;

-- 2) 임베딩 테이블(최소본)
--    - source_path: 파일/객체 경로(또는 테이블명+PK 등), 청킹 기준으로 고유 관리
--    - schema_name/table_name/object_name: 출처 메타(필요 없는 칼럼은 비워둬도 됨)
--    - embedding: vector(1536)  ← text-embedding-3-small 기준
CREATE TABLE IF NOT EXISTS ai.embeddings (
  id            BIGSERIAL PRIMARY KEY,
  source_path   TEXT        NOT NULL,
  schema_name   TEXT        NULL,
  table_name    TEXT        NULL,
  object_name   TEXT        NULL,
  chunk_id      INTEGER     NOT NULL,
  content_text  TEXT        NOT NULL,
  token_count   INTEGER     NULL,
  embedding     VECTOR(1536) NOT NULL,
  meta          JSONB       NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_path, chunk_id)
);

-- 3) 검색 인덱스(코사인 유사도)
--    lists 값은 데이터 양에 따라 조정(초기 100 권장, 후에 200~1000로 조정 가능)
CREATE INDEX IF NOT EXISTS ix_embeddings_vec_cosine
  ON ai.embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- (선택) 출처 필터링용 보조 인덱스
CREATE INDEX IF NOT EXISTS ix_embeddings_src
  ON ai.embeddings (schema_name, table_name);

-- 4) 권한 (읽기/쓰기 분리 권장)
--    - 읽기전용 계정: cc_readonly → SELECT만 허용
--    - 쓰기 작업(업서트)용: cc_ai_writer → ai 스키마에만 INSERT/UPDATE/DELETE/SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_ai_writer') THEN
    CREATE ROLE cc_ai_writer LOGIN PASSWORD '0000' VALID UNTIL '2025-12-31 23:59:59+09';
  END IF;
END$$;

GRANT USAGE ON SCHEMA ai TO cc_readonly, cc_ai_writer;
GRANT SELECT ON ai.embeddings TO cc_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai.embeddings TO cc_ai_writer;

-- 앞으로 ai 스키마에 생기는 새 테이블/시퀀스에 대한 기본 권한(선택)
ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT SELECT ON TABLES TO cc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cc_ai_writer;

-- 5) 통계 수집
ANALYZE ai.embeddings;