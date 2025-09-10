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

