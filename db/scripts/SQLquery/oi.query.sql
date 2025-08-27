CREATE TABLE oi.apt_deal_trade (
  id SERIAL PRIMARY KEY,
  sgg_cd VARCHAR(5),              -- 시군구 코드
  umd_nm VARCHAR(60),             -- 법정동
  jibun VARCHAR(20),              -- 지번
  road_nm VARCHAR(100),           -- 도로명
  apt_nm VARCHAR(100),            -- 단지명
  build_year INT,                 -- 건축년도
  floor INT,                      -- 층
  deal_year INT,                  -- 계약년도
  deal_month INT,                 -- 계약월
  deal_day INT,                   -- 계약일
  deal_amount INT,                -- 거래금액(만원)
  exclu_use_ar FLOAT,             -- 전용면적
  deal_type VARCHAR(20),         -- 중개거래/직거래 등
  sler_gbn VARCHAR(20),          -- 매도자 (개인/법인 등)
  buyer_gbn VARCHAR(20),         -- 매수자
  lat FLOAT,
  lng FLOAT,
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);



CREATE TABLE oi.apt_deal_lease (
  id SERIAL PRIMARY KEY,
  sgg_cd VARCHAR(5),              -- 시군구 코드
  umd_nm VARCHAR(60),             -- 법정동
  jibun VARCHAR(20),              -- 지번
  apt_nm VARCHAR(100),            -- 단지명
  build_year INT,                 -- 건축년도
  floor INT,                      -- 층
  deal_year INT,                  -- 계약년도
  deal_month INT,                 -- 계약월
  deal_day INT,                   -- 계약일
  exclu_use_ar FLOAT,             -- 전용면적
  deposit INT,                    -- 보증금(만원)
  monthly_rent INT,              -- 월세(만원)
  contract_term VARCHAR(20),      -- 계약기간
  contract_type VARCHAR(20),      -- 계약구분 (예: 전세/월세)
  lat FLOAT,
  lng FLOAT,
  geom GEOMETRY(Point, 4326),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE oi.legal_dong (
  code VARCHAR(10) PRIMARY KEY,     -- 10자리 법정동코드
  sido VARCHAR(20),                 -- 시/도명
  sigungu VARCHAR(40),              -- 시/군/구명
  eupmyeondong VARCHAR(40),         -- 읍/면/동명
  ri VARCHAR(40)                  -- 리명 (없으면 NULL)
);


CREATE TABLE oi.apt_deal_trade_raw (
  id SERIAL PRIMARY KEY,

  sggCd VARCHAR(5),
  umdCd VARCHAR(5),
  landCd VARCHAR(1),
  bonbun VARCHAR(4),
  bubun VARCHAR(4),
  roadNm VARCHAR(100),
  roadNmSggCd VARCHAR(5),
  roadNmCd VARCHAR(7),
  roadNmSeq VARCHAR(2),
  roadNmBasCd VARCHAR(1),
  roadNmBonbun VARCHAR(5),
  roadNmBubun VARCHAR(5),
  umdNm VARCHAR(60),
  aptNm VARCHAR(100),
  jibun VARCHAR(20),
  excluUseAr NUMERIC(10, 4),
  dealYear INT,
  dealMonth INT,
  dealDay INT,
  dealAmount INT,
  floor INT,
  buildYear INT,
  aptSeq VARCHAR(20),
  cdealType VARCHAR(1),
  cdealDay VARCHAR(8),
  dealingGbn VARCHAR(10),
  estateAgentSggNm VARCHAR(100),
  rgstDate VARCHAR(8),
  aptDong VARCHAR(400),
  slerGbn VARCHAR(100),
  buyerGbn VARCHAR(100),
  landLeaseholdGbn VARCHAR(1),

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);


ALTER TABLE oi.apt_deal_trade_raw
ADD COLUMN roadnmbcd VARCHAR(1);


CREATE TABLE oi.apt_deal_rent_raw (
  id SERIAL PRIMARY KEY,
  sggCd TEXT,                   -- 지역코드 (5)
  umdNm TEXT,                   -- 법정동
  aptNm TEXT,                   -- 아파트명
  jibun TEXT,                   -- 지번
  excluUseAr NUMERIC,          -- 전용면적
  dealYear INTEGER,            -- 계약년도
  dealMonth INTEGER,           -- 계약월
  dealDay INTEGER,             -- 계약일
  deposit INTEGER,             -- 보증금액 (만원)
  monthlyRent INTEGER,         -- 월세금액 (만원)
  floor INTEGER,               -- 층
  buildYear INTEGER,           -- 건축년도
  contractTerm TEXT,           -- 계약기간
  contractType TEXT,           -- 계약구분
  useRRRight TEXT,             -- 갱신요구권사용
  preDeposit INTEGER,          -- 종전계약보증금
  preMonthlyRent INTEGER,      -- 종전계약월세
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);


-- apt_info 테이블 생성 (작성일: 2025-08-25)
CREATE TABLE IF NOT EXISTS oi.apt_info (
    id SERIAL PRIMARY KEY,
    apt_nm TEXT NOT NULL,           -- 아파트 이름
    apt_dong TEXT,                  -- 동 이름 (101동 등), 없으면 NULL
    addr_jibun TEXT,                -- 지번 주소
    addr_road TEXT,                 -- 도로명 주소
    lat DOUBLE PRECISION,          -- 위도 (Kakao API 통해 추후 입력)
    lng DOUBLE PRECISION,          -- 경도 (Kakao API 통해 추후 입력)
    is_exact_dong BOOLEAN DEFAULT FALSE, -- 동 단위 좌표 여부
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE (apt_nm, apt_dong)       -- 같은 아파트/동은 한 번만 저장
);

CREATE TABLE oi.apt_info (
  id SERIAL PRIMARY KEY,
  apt_nm TEXT NOT NULL,				-- 아파트 이름
  apt_dong TEXT,					-- 동 이름 (101동 등), 없으면 NULL
  jibun_address TEXT,				-- 지번 주소
  road_address TEXT,				-- 도로명 주소
  lon DOUBLE PRECISION,				-- 경도 (Kakao API 통해 추후 입력)
  lat DOUBLE PRECISION,				-- 위도 (Kakao API 통해 추후 입력)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (apt_nm, apt_dong)			-- 같은 아파트/동은 한 번만 저장
);

Delete from oi.apt_info;

-- 기존 제약 조건 삭제
ALTER TABLE oi.apt_info DROP CONSTRAINT apt_info_apt_nm_apt_dong_key;

-- 새로운 고유 제약 조건 추가 (지번 주소까지 포함)
ALTER TABLE oi.apt_info ADD CONSTRAINT unique_apt_nm_dong_jibun
UNIQUE (apt_nm, apt_dong, jibun_address);

CREATE TABLE oi.apt_deal_all (
  id             SERIAL PRIMARY KEY,
  -- 아파트 식별 정보
  apt_nm         TEXT NOT NULL,
  apt_dong       TEXT,               -- 전월세는 null일 수 있음
  jibun_address  TEXT NOT NULL,

  -- 거래 정보
  exclu_use_ar   NUMERIC(10, 2),     -- 전용면적(m²)
  "floor"        INTEGER,            -- 층수
  deal_year      INTEGER NOT NULL,
  deal_month     INTEGER NOT NULL,
  deal_day       INTEGER NOT NULL,

  -- 매매일 경우
  deal_amount    INTEGER,            -- 매매가 (만원)

  -- 전월세일 경우
  deposit        INTEGER,            -- 보증금 (만원)
  monthly_rent   INTEGER,            -- 월세 (만원)

  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX uniq_deal_all
ON oi.apt_deal_all (
  apt_nm,
  COALESCE(apt_dong, ''),
  jibun_address,
  exclu_use_ar,
  "floor",
  deal_year,
  deal_month,
  deal_day
);
SELECT conname
FROM pg_constraint
WHERE conrelid = 'oi.apt_deal_all'::regclass;

ALTER TABLE oi.apt_deal_all
DROP CONSTRAINT IF EXISTS apt_deal_all_unique;

DROP INDEX IF EXISTS oi.uniq_deal_all;

Delete from oi.apt_deal_all;

ALTER TABLE oi.apt_info
DROP COLUMN road_address;

SELECT id, apt_nm, jibun_address
FROM oi.apt_info
WHERE lon IS NULL OR lat IS NULL
ORDER BY id ASC;
