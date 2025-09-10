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

