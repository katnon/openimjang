$ErrorActionPreference = "Stop"

# === 경로/환경 설정 ===
$Repo  = "C:\OpenImjang"                         # 리포지토리 루트
$outDir = Join-Path $Repo "docs\db_schema_report"

# psql/pg_dump 경로 (PATH에 이미 있다면 자동감지, 아니면 수동 지정)
$pgBin = (Get-Command psql -ErrorAction SilentlyContinue).Path
if (-not $pgBin) {
  # 여기를 실제 설치 경로로 바꾸세요(예: PostgreSQL 16)
  $PgBinManual = "C:\Program Files\PostgreSQL\16\bin"
  $env:Path = "$PgBinManual;$env:Path"
} else {
  $env:Path = (Split-Path $pgBin) + ";" + $env:Path
}

# .pgpass 경로 지정(무프롬프트 접속)
$env:PGPASSFILE = "$env:APPDATA\postgresql\pgpass.conf"

# DB 접속 정보(로컬, no SSL)
$HostName = "127.0.0.1"
$Port     = "5432"
$Db       = "openimjang"
$User     = "cc_readonly"

# 출력 폴더
New-Item -ItemType Directory -Force $outDir | Out-Null

# === 1) 스키마 DDL 덤프(public + oi) ===
& pg_dump -h $HostName -p $Port -U $User -d $Db -s -n public -n oi -f (Join-Path $Repo "db_schema_public_oi.sql")

# === 2) 테이블 목록(table_list.tsv) ===
& psql --no-psqlrc --pset=pager=off `
  -h $HostName -p $Port -U $User -d $Db `
  -At -F "`t" `
  -o (Join-Path $outDir "table_list.tsv") `
  -c "SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname IN ('public','oi')
      ORDER BY schemaname, tablename;"

# === 3) per-table 상세 파일 psql 스크립트 생성 ===
$tableList = Get-Content (Join-Path $outDir "table_list.tsv")
$psqlScriptPath = Join-Path $outDir "_dump_tables.sql"
$sb = New-Object System.Text.StringBuilder

foreach ($line in $tableList) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split "`t"
  if ($parts.Count -ne 2) { continue }
  $schema = $parts[0]; $table = $parts[1]

  # psql의 \o는 경로 구분자에 슬래시(/)가 더 안전
  $outfile = ($outDir + "/$schema.$table.txt").Replace("\","/")
  [void]$sb.AppendLine("\o $outfile")
  [void]$sb.AppendLine("\d+ $schema.$table")
}
[void]$sb.AppendLine("\o")
$sb.ToString() | Set-Content -Encoding UTF8 $psqlScriptPath

# === 4) per-table 상세 파일 일괄 생성 ===
& psql --no-psqlrc --pset=pager=off -v ON_ERROR_STOP=1 `
  -h $HostName -p $Port -U $User -d $Db `
  -f $psqlScriptPath

# === 5) 컬럼 사전(columns.tsv) ===
& psql --no-psqlrc --pset=pager=off `
  -h $HostName -p $Port -U $User -d $Db `
  -At -F "`t" `
  -o (Join-Path $outDir "columns.tsv") `
  -c "SELECT table_schema, table_name, ordinal_position, column_name,
             data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema IN ('public','oi')
      ORDER BY table_schema, table_name, ordinal_position;"

# === 6) 제약 사전(constraints.tsv) ===
& psql --no-psqlrc --pset=pager=off `
  -h $HostName -p $Port -U $User -d $Db `
  -At -F "`t" `
  -o (Join-Path $outDir "constraints.tsv") `
  -c "WITH cons AS (
        SELECT n.nspname AS schema_name,
               c.relname  AS table_name,
               con.*
        FROM pg_constraint con
        JOIN pg_class     c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public','oi')
      )
      SELECT schema_name, table_name, conname, contype,
             pg_get_constraintdef(oid, true) AS definition
      FROM cons
      ORDER BY schema_name, table_name, conname;"

# === 7) 타임스탬프 마커 ===
(Get-Date).ToString("yyyy-MM-dd HH:mm:ss K") | Set-Content -Encoding UTF8 (Join-Path $outDir "_last_run.txt")
