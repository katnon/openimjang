# apt_deal_all 테이블

아파트 매매와 전월세 거래를 통합한 데이터 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NOT NULL) 기본값: nextval('oi.apt_deal_all_id_seq'::regclass)

**apt_nm** (text): 아파트명 (NOT NULL) 기본값: 

**apt_dong** (text): 아파트 동 정보 (NULL 허용) 기본값: 

**jibun_address** (text): 지번 주소 (NOT NULL) 기본값: 

**exclu_use_ar** (numeric): 전용면적 (단위: 평방미터) (NULL 허용) 기본값: 

**floor** (integer): 아파트가 위치한 층수 (NULL 허용) 기본값: 

**deal_year** (integer): 거래연도 (NOT NULL) 기본값: 

**deal_month** (integer): 거래월 (NOT NULL) 기본값: 

**deal_day** (integer): 거래일 (NOT NULL) 기본값: 

**deal_amount** (integer): 거래금액 (단위: 만원) (NULL 허용) 기본값: 

**deposit** (integer): 보증금 (단위: 만원) (NULL 허용) 기본값: 

**monthly_rent** (integer): 월세 (단위: 만원) (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: now()

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: now()

