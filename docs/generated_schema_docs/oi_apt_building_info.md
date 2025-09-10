# apt_building_info 테이블

아파트 건축물의 상세 정보(면적, 층수, 구조 등)를 저장하는 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NOT NULL) 기본값: nextval('oi.apt_building_info_id_seq'::regclass)

**apt_id** (integer): 아파트의 고유 식별자 (NULL 허용) 기본값: 

**type** (character varying): 건물 유형 (NOT NULL) 기본값: 

**dongnm** (character varying): 동명칭 (NULL 허용) 기본값: 

**bldnm** (character varying): 건물명 (NULL 허용) 기본값: 

**platplc** (text): 대지위치 (NULL 허용) 기본값: 

**platarea** (numeric): 대지면적 (단위: 평방미터) (NULL 허용) 기본값: 

**archarea** (numeric): 건축면적 (단위: 평방미터) (NULL 허용) 기본값: 

**totarea** (numeric): 연면적 (단위: 평방미터) (NULL 허용) 기본값: 

**grndflrcnt** (integer): 지상층수 (NULL 허용) 기본값: 

**ugrndflrcnt** (integer): 지하층수 (NULL 허용) 기본값: 

**mainpurpscdnm** (character varying): 주요 용도 (NULL 허용) 기본값: 

**strctcdnm** (character varying): 구조 코드명 (철근콘크리트 등) (NULL 허용) 기본값: 

**roofcdnm** (character varying): 지붕 코드명 (NULL 허용) 기본값: 

**hhldcnt** (integer): 세대수 (NULL 허용) 기본값: 

**mainbldcnt** (integer): 주건축물 수 (NULL 허용) 기본값: 

**atchbldcnt** (integer): 부속건축물 수 (NULL 허용) 기본값: 

**totpkngcnt** (integer): 총 주차대수 (NULL 허용) 기본값: 

**useaprday** (date): 사용승인일자 (NULL 허용) 기본값: 

**raw_data** (jsonb): 원본 건축 데이터 (JSON 형태) (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: now()

