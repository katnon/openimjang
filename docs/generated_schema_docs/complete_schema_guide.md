# OpenImjang 데이터베이스 스키마 문서

OpenImjang 부동산 임장 분석 플랫폼의 데이터베이스 스키마에 대한 상세 설명입니다.

## oi 스키마

# ai_smart_summary 테이블

AI가 분석한 아파트별 투자 요약 정보를 저장하는 테이블입니다.

## 컬럼 정보

**apt_id** (integer): 아파트의 고유 식별자 (NOT NULL) 기본값: 

**apt_nm** (character varying): 아파트명 (NOT NULL) 기본값: 

**jibun_address** (text): 지번 주소 (NOT NULL) 기본값: 

**summary** (text): AI가 생성한 아파트 투자 분석 요약 (NOT NULL) 기본값: 

**user_id** (character varying): 사용자 식별자 (NOT NULL) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: CURRENT_TIMESTAMP

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: CURRENT_TIMESTAMP


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


# apt_deal_trade_raw 테이블

아파트 매매 거래 원본 데이터를 저장하는 테이블입니다. 부동산 실거래가 정보, 거래일자, 건물 정보 등이 포함되어 있습니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NOT NULL) 기본값: nextval('oi.apt_deal_trade_raw_id_seq'::regclass)

**sggcd** (character varying): 시군구 코드 (행정구역 코드) (NULL 허용) 기본값: 

**umdcd** (character varying): 읍면동 코드 (NULL 허용) 기본값: 

**landcd** (character varying): 토지 구분 코드 (NULL 허용) 기본값: 

**bonbun** (character varying): 지번 본번 (NULL 허용) 기본값: 

**bubun** (character varying): 지번 부번 (NULL 허용) 기본값: 

**roadnm** (character varying): 도로명 (NULL 허용) 기본값: 

**roadnmsggcd** (character varying): 도로명 시군구 코드 (NULL 허용) 기본값: 

**roadnmcd** (character varying): 도로명 코드 (NULL 허용) 기본값: 

**roadnmseq** (character varying): 도로명 순번 (NULL 허용) 기본값: 

**roadnmbascd** (character varying): 도로명 기초구역 코드 (NULL 허용) 기본값: 

**roadnmbonbun** (character varying): 도로명 본번 (NULL 허용) 기본값: 

**roadnmbubun** (character varying): 도로명 부번 (NULL 허용) 기본값: 

**umdnm** (character varying): 읍면동명 (행정동 이름) (NULL 허용) 기본값: 

**aptnm** (character varying): 아파트명 (NULL 허용) 기본값: 

**jibun** (character varying): 지번 주소 (NULL 허용) 기본값: 

**excluusear** (numeric): 아파트 전용면적 (단위: 평방미터) (NULL 허용) 기본값: 

**dealyear** (integer): 거래가 발생한 연도 (NULL 허용) 기본값: 

**dealmonth** (integer): 거래가 발생한 월 (1-12) (NULL 허용) 기본값: 

**dealday** (integer): 거래가 발생한 일 (1-31) (NULL 허용) 기본값: 

**dealamount** (integer): 아파트 매매 거래금액 (단위: 만원, 예: 50000 = 5억원) (NULL 허용) 기본값: 

**floor** (integer): 아파트가 위치한 층수 (NULL 허용) 기본값: 

**buildyear** (integer): 아파트 건축연도 (준공년도) (NULL 허용) 기본값: 

**aptseq** (character varying): 아파트 일련번호 (NULL 허용) 기본값: 

**cdealtype** (character varying): 거래 유형 구분 코드 (NULL 허용) 기본값: 

**cdealday** (character varying): 거래일 코드 (NULL 허용) 기본값: 

**dealinggbn** (character varying): 거래 구분 (직거래/중개거래) (NULL 허용) 기본값: 

**estateagentsggnm** (character varying): 중개사소재지 (NULL 허용) 기본값: 

**rgstdate** (character varying): 등록일자 (NULL 허용) 기본값: 

**aptdong** (character varying): 아파트 동 정보 (NULL 허용) 기본값: 

**slergbn** (character varying): 매도자 구분 (NULL 허용) 기본값: 

**buyergbn** (character varying): 매수자 구분 (NULL 허용) 기본값: 

**landleaseholdgbn** (character varying): 토지임대여부 (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: now()

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: now()

**roadnmbcd** (character varying): 도로명 건물 코드 (NULL 허용) 기본값: 


# apt_info 테이블

아파트의 기본 정보(위치, 이름, 주소)를 저장하는 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NOT NULL) 기본값: nextval('oi.apt_info_id_seq'::regclass)

**apt_nm** (text): 아파트명 (NOT NULL) 기본값: 

**jibun_address** (text): 지번 주소 (NULL 허용) 기본값: 

**lon** (double precision): 경도 (longitude, WGS84 좌표계) (NULL 허용) 기본값: 

**lat** (double precision): 위도 (latitude, WGS84 좌표계) (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: now()

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: now()


# landuse_included 테이블

토지 이용계획 정보를 저장하는 공간 데이터 테이블입니다.

## 컬럼 정보

**gid** (integer): gid 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 

**code** (text): 법정동 코드 (10자리) (NULL 허용) 기본값: 

**pnu** (text): pnu 컬럼 (NULL 허용) 기본값: 

**pnu_sgg** (text): pnu_sgg 컬럼 (NULL 허용) 기본값: 

**pnu_umd** (text): pnu_umd 컬럼 (NULL 허용) 기본값: 

**pnu_landcd** (text): pnu_landcd 컬럼 (NULL 허용) 기본값: 

**pnu_bonbun** (text): pnu_bonbun 컬럼 (NULL 허용) 기본값: 

**pnu_bubun** (text): pnu_bubun 컬럼 (NULL 허용) 기본값: 


# legal_dong 테이블

대한민국 행정구역의 법정동 코드와 명칭을 저장하는 테이블입니다.

## 컬럼 정보

**code** (character varying): 법정동 코드 (10자리) (NOT NULL) 기본값: 

**sido** (character varying): 시도명 (NULL 허용) 기본값: 

**sigungu** (character varying): 시군구명 (NULL 허용) 기본값: 

**eupmyeondong** (character varying): 읍면동명 (NULL 허용) 기본값: 

**ri** (character varying): 리명 (NULL 허용) 기본값: 


# old_apt_deal_all 테이블

이전 버전의 통합 거래 데이터 백업 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NULL 허용) 기본값: 

**apt_nm** (text): 아파트명 (NULL 허용) 기본값: 

**apt_dong** (text): 아파트 동 정보 (NULL 허용) 기본값: 

**jibun_address** (text): 지번 주소 (NULL 허용) 기본값: 

**exclu_use_ar** (numeric): 전용면적 (단위: 평방미터) (NULL 허용) 기본값: 

**floor** (integer): 아파트가 위치한 층수 (NULL 허용) 기본값: 

**deal_year** (integer): 거래연도 (NULL 허용) 기본값: 

**deal_month** (integer): 거래월 (NULL 허용) 기본값: 

**deal_day** (integer): 거래일 (NULL 허용) 기본값: 

**deal_amount** (integer): 거래금액 (단위: 만원) (NULL 허용) 기본값: 

**deposit** (integer): 보증금 (단위: 만원) (NULL 허용) 기본값: 

**monthly_rent** (integer): 월세 (단위: 만원) (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: 

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: 


# old_apt_deal_rent_raw 테이블

이전 버전의 아파트 전월세 거래 데이터 백업 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NULL 허용) 기본값: 

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

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: 

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: 


# old_apt_deal_trade_raw 테이블

이전 버전의 아파트 매매 거래 데이터 백업 테이블입니다.

## 컬럼 정보

**id** (integer): 테이블의 고유 식별자 (Primary Key) (NULL 허용) 기본값: 

**sggcd** (character varying): 시군구 코드 (행정구역 코드) (NULL 허용) 기본값: 

**umdcd** (character varying): 읍면동 코드 (NULL 허용) 기본값: 

**landcd** (character varying): 토지 구분 코드 (NULL 허용) 기본값: 

**bonbun** (character varying): 지번 본번 (NULL 허용) 기본값: 

**bubun** (character varying): 지번 부번 (NULL 허용) 기본값: 

**roadnm** (character varying): 도로명 (NULL 허용) 기본값: 

**roadnmsggcd** (character varying): 도로명 시군구 코드 (NULL 허용) 기본값: 

**roadnmcd** (character varying): 도로명 코드 (NULL 허용) 기본값: 

**roadnmseq** (character varying): 도로명 순번 (NULL 허용) 기본값: 

**roadnmbascd** (character varying): 도로명 기초구역 코드 (NULL 허용) 기본값: 

**roadnmbonbun** (character varying): 도로명 본번 (NULL 허용) 기본값: 

**roadnmbubun** (character varying): 도로명 부번 (NULL 허용) 기본값: 

**umdnm** (character varying): 읍면동명 (행정동 이름) (NULL 허용) 기본값: 

**aptnm** (character varying): 아파트명 (NULL 허용) 기본값: 

**jibun** (character varying): 지번 주소 (NULL 허용) 기본값: 

**excluusear** (numeric): 아파트 전용면적 (단위: 평방미터) (NULL 허용) 기본값: 

**dealyear** (integer): 거래가 발생한 연도 (NULL 허용) 기본값: 

**dealmonth** (integer): 거래가 발생한 월 (1-12) (NULL 허용) 기본값: 

**dealday** (integer): 거래가 발생한 일 (1-31) (NULL 허용) 기본값: 

**dealamount** (integer): 아파트 매매 거래금액 (단위: 만원, 예: 50000 = 5억원) (NULL 허용) 기본값: 

**floor** (integer): 아파트가 위치한 층수 (NULL 허용) 기본값: 

**buildyear** (integer): 아파트 건축연도 (준공년도) (NULL 허용) 기본값: 

**aptseq** (character varying): 아파트 일련번호 (NULL 허용) 기본값: 

**cdealtype** (character varying): 거래 유형 구분 코드 (NULL 허용) 기본값: 

**cdealday** (character varying): 거래일 코드 (NULL 허용) 기본값: 

**dealinggbn** (character varying): 거래 구분 (직거래/중개거래) (NULL 허용) 기본값: 

**estateagentsggnm** (character varying): 중개사소재지 (NULL 허용) 기본값: 

**rgstdate** (character varying): 등록일자 (NULL 허용) 기본값: 

**aptdong** (character varying): 아파트 동 정보 (NULL 허용) 기본값: 

**slergbn** (character varying): 매도자 구분 (NULL 허용) 기본값: 

**buyergbn** (character varying): 매수자 구분 (NULL 허용) 기본값: 

**landleaseholdgbn** (character varying): 토지임대여부 (NULL 허용) 기본값: 

**created_at** (timestamp without time zone): 데이터가 생성된 시각 (NULL 허용) 기본값: 

**updated_at** (timestamp without time zone): 데이터가 마지막으로 수정된 시각 (NULL 허용) 기본값: 

**roadnmbcd** (character varying): 도로명 건물 코드 (NULL 허용) 기본값: 


## public 스키마

# al_d002_11_20250804 테이블

al_d002_11_20250804 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NOT NULL) 기본값: nextval('al_d002_11_20250804_gid_seq'::regclass)

**a0** (integer): a0 컬럼 (NULL 허용) 기본값: 

**a1** (character varying): a1 컬럼 (NULL 허용) 기본값: 

**a2** (character varying): a2 컬럼 (NULL 허용) 기본값: 

**a3** (character varying): a3 컬럼 (NULL 허용) 기본값: 

**a4** (character varying): a4 컬럼 (NULL 허용) 기본값: 

**a5** (character varying): a5 컬럼 (NULL 허용) 기본값: 

**a6** (date): a6 컬럼 (NULL 허용) 기본값: 

**a7** (character varying): a7 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 


# al_d154_11_20250830 테이블

al_d154_11_20250830 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NOT NULL) 기본값: nextval('al_d154_11_20250830_gid_seq'::regclass)

**a0** (character varying): a0 컬럼 (NULL 허용) 기본값: 

**a1** (character varying): a1 컬럼 (NULL 허용) 기본값: 

**a2** (character varying): a2 컬럼 (NULL 허용) 기본값: 

**a3** (character varying): a3 컬럼 (NULL 허용) 기본값: 

**a4** (character varying): a4 컬럼 (NULL 허용) 기본값: 

**a5** (character varying): a5 컬럼 (NULL 허용) 기본값: 

**a6** (character varying): a6 컬럼 (NULL 허용) 기본값: 

**a7** (character varying): a7 컬럼 (NULL 허용) 기본값: 

**a8** (character varying): a8 컬럼 (NULL 허용) 기본값: 

**a9** (character varying): a9 컬럼 (NULL 허용) 기본값: 

**a10** (character varying): a10 컬럼 (NULL 허용) 기본값: 

**a11** (date): a11 컬럼 (NULL 허용) 기본값: 

**a12** (character varying): a12 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 


# geography_columns 테이블

geography_columns 테이블

## 컬럼 정보

**f_table_catalog** (name): f_table_catalog 컬럼 (NULL 허용) 기본값: 

**f_table_schema** (name): f_table_schema 컬럼 (NULL 허용) 기본값: 

**f_table_name** (name): f_table_name 컬럼 (NULL 허용) 기본값: 

**f_geography_column** (name): f_geography_column 컬럼 (NULL 허용) 기본값: 

**coord_dimension** (integer): coord_dimension 컬럼 (NULL 허용) 기본값: 

**srid** (integer): srid 컬럼 (NULL 허용) 기본값: 

**type** (text): 건물 유형 (NULL 허용) 기본값: 


# geometry_columns 테이블

geometry_columns 테이블

## 컬럼 정보

**f_table_catalog** (character varying): f_table_catalog 컬럼 (NULL 허용) 기본값: 

**f_table_schema** (name): f_table_schema 컬럼 (NULL 허용) 기본값: 

**f_table_name** (name): f_table_name 컬럼 (NULL 허용) 기본값: 

**f_geometry_column** (name): f_geometry_column 컬럼 (NULL 허용) 기본값: 

**coord_dimension** (integer): coord_dimension 컬럼 (NULL 허용) 기본값: 

**srid** (integer): srid 컬럼 (NULL 허용) 기본값: 

**type** (character varying): 건물 유형 (NULL 허용) 기본값: 


# landuse_code 테이블

landuse_code 테이블

## 컬럼 정보

**code** (character varying): 법정동 코드 (10자리) (NOT NULL) 기본값: 

**name** (character varying): name 컬럼 (NULL 허용) 기본값: 

**description** (text): description 컬럼 (NULL 허용) 기본값: 


# seoul_bldg 테이블

seoul_bldg 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NOT NULL) 기본값: nextval('seoul_bldg_gid_seq'::regclass)

**eqb_man_sn** (double precision): eqb_man_sn 컬럼 (NULL 허용) 기본값: 

**opert_de** (character varying): opert_de 컬럼 (NULL 허용) 기본값: 

**sig_cd** (character varying): sig_cd 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 


# spatial_ref_sys 테이블

spatial_ref_sys 테이블

## 컬럼 정보

**srid** (integer): srid 컬럼 (NOT NULL) 기본값: 

**auth_name** (character varying): auth_name 컬럼 (NULL 허용) 기본값: 

**auth_srid** (integer): auth_srid 컬럼 (NULL 허용) 기본값: 

**srtext** (character varying): srtext 컬럼 (NULL 허용) 기본값: 

**proj4text** (character varying): proj4text 컬럼 (NULL 허용) 기본값: 


# tl_spbd_eqb_11_202508 테이블

tl_spbd_eqb_11_202508 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NOT NULL) 기본값: nextval('tl_spbd_eqb_11_202508_gid_seq'::regclass)

**eqb_man_sn** (double precision): eqb_man_sn 컬럼 (NULL 허용) 기본값: 

**opert_de** (character varying): opert_de 컬럼 (NULL 허용) 기본값: 

**sig_cd** (character varying): sig_cd 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 


# v_landuse_included 테이블

v_landuse_included 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 

**code** (text): 법정동 코드 (10자리) (NULL 허용) 기본값: 


# v_landuse_included_agg 테이블

v_landuse_included_agg 테이블

## 컬럼 정보

**gid** (integer): gid 컬럼 (NULL 허용) 기본값: 

**geom** (USER-DEFINED): geom 컬럼 (NULL 허용) 기본값: 

**code** (text): 법정동 코드 (10자리) (NULL 허용)


