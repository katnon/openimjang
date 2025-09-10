# apt_deal_rent_raw 테이블

아파트 전월세 거래 원본 데이터를 저장하는 테이블입니다. 보증금, 월세, 계약 조건 등이 포함되어 있습니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NOT NULL) 기본값: nextval('oi.apt_deal_rent_raw_id_seq'::regclass)

**sggcd** (text): 시군구 코드 (행정구역 코드) (NULL 허용) 기본값: 

**umdnm** (text): 읍면동명 (행정동 이름) (NULL 허용) 기본값: 

**aptnm** (text): 아파트명 (NULL 허용) 기본값: 

**jibun** (text): 지번 주소 (NULL 허용) 기본값: 

**excluusear** (numeric): 아파트 전용면적 (단위: 평방미터) (NULL 허용) 기본값: 

**dealyear** (integer): 거래가 발생한 연도 (NULL 허용) 기본값: 

**dealmonth** (integer): 거래가 발생한 월 (1-12) (NULL 허용) 기본값: 

**dealday** (integer): 거래가 발생한 일 (1-31) (NULL 허용) 기본값: 

**deposit** (integer): 보증금 (단위: 만원) (NULL 허용) 기본값: 

**monthlyrent** (integer): 월세금액 (단위: 만원) (NULL 허용) 기본값: 

**floor** (integer): 아파트가 위치한 층수 (NULL 허용) 기본값: 

**buildyear** (integer): 아파트 건축연도 (준공년도) (NULL 허용) 기본값: 

**contractterm** (text): 계약기간 (NULL 허용) 기본값: 

**contracttype** (text): 계약구분 (전세/월세) (NULL 허용) 기본값: 

**userrright** (text): 전용사용권 여부 (NULL 허용) 기본값: 

**predeposit** (integer): 종전 보증금 (NULL 허용) 기본값: 

**premonthlyrent** (integer): 종전 월세 (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: now()

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: now()

