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

