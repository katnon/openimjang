#!/bin/bash

# WFS 데이터를 PostGIS로 가져오는 스크립트
# ogr2ogr을 사용하여 vWorld WFS 데이터를 PostGIS로 적재

set -e

# 환경 변수 설정
source .env

# 설정 파일 경로
CONFIG_FILE="etl/configs/wfs-layers.json"
OUTPUT_DIR="data/wfs"

# PostgreSQL 연결 정보
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-openimjang}
DB_USER=${DB_USER:-postgres}

# ogr2ogr 명령어 확인
if ! command -v ogr2ogr &> /dev/null; then
    echo "ogr2ogr이 설치되지 않았습니다. GDAL을 설치해주세요."
    exit 1
fi

# 출력 디렉토리 생성
mkdir -p "$OUTPUT_DIR"

echo "=== WFS 데이터 PostGIS 적재 시작 ==="

# 용도지역 레이어 가져오기
echo "용도지역 레이어 가져오는 중..."
ogr2ogr -f "PostgreSQL" \
    "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
    "WFS:http://api.vworld.kr/req/data?key=$VWORLD_API_KEY&service=data&request=GetFeature&typeName=zoning&outputFormat=application/json" \
    -nln zoning \
    -a_srs EPSG:4326 \
    -t_srs EPSG:4326 \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=id \
    -lco PRECISION=NO \
    --config GDAL_WFS_USE_STREAMING YES \
    --config GDAL_WFS_PAGING_ALLOWED YES \
    --config GDAL_WFS_PAGE_SIZE 1000

# 지적 레이어 가져오기
echo "지적 레이어 가져오는 중..."
ogr2ogr -f "PostgreSQL" \
    "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
    "WFS:http://api.vworld.kr/req/data?key=$VWORLD_API_KEY&service=data&request=GetFeature&typeName=parcel&outputFormat=application/json" \
    -nln parcel \
    -a_srs EPSG:4326 \
    -t_srs EPSG:4326 \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=pnu \
    -lco PRECISION=NO \
    --config GDAL_WFS_USE_STREAMING YES \
    --config GDAL_WFS_PAGING_ALLOWED YES \
    --config GDAL_WFS_PAGE_SIZE 1000

# 주변시설 레이어 가져오기
echo "주변시설 레이어 가져오는 중..."
ogr2ogr -f "PostgreSQL" \
    "PG:host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER" \
    "WFS:http://api.vworld.kr/req/data?key=$VWORLD_API_KEY&service=data&request=GetFeature&typeName=places&outputFormat=application/json" \
    -nln places \
    -a_srs EPSG:4326 \
    -t_srs EPSG:4326 \
    -lco GEOMETRY_NAME=geometry \
    -lco FID=id \
    -lco PRECISION=NO \
    --config GDAL_WFS_USE_STREAMING YES \
    --config GDAL_WFS_PAGING_ALLOWED YES \
    --config GDAL_WFS_PAGE_SIZE 1000

echo "=== WFS 데이터 PostGIS 적재 완료 ==="

# 인덱스 생성
echo "공간 인덱스 생성 중..."
psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -c "
CREATE INDEX IF NOT EXISTS idx_zoning_geometry ON zoning USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_parcel_geometry ON parcel USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_places_geometry ON places USING GIST (geometry);
"

# 통계 정보 업데이트
echo "통계 정보 업데이트 중..."
psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -c "ANALYZE;"

echo "=== 모든 작업 완료 ==="
