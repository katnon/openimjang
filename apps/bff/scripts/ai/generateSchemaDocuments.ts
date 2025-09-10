// apps/bff/scripts/ai/generateSchemaDocuments.ts
// columns.tsv를 기반으로 자연어 스키마 문서 생성

import fs from 'fs';
import path from 'path';

// TSV 파일의 컬럼 구조
interface ColumnInfo {
    schema: string;
    table: string;
    position: number;
    column: string;
    dataType: string;
    nullable: string;
    defaultValue?: string;
}

// 부동산 도메인 지식이 포함된 컬럼 설명 매핑
const COLUMN_DESCRIPTIONS: Record<string, string> = {
    // 공통 컬럼
    'id': '테이블의 고유 식별자 (Primary Key)',
    'created_at': '데이터가 생성된 시각',
    'updated_at': '데이터가 마지막으로 수정된 시각',
    'apt_id': '아파트의 고유 식별자',
    'apt_nm': '아파트명',
    'aptnm': '아파트명',
    
    // apt_deal_trade_raw 테이블 (아파트 매매 거래 원본 데이터)
    'dealamount': '아파트 매매 거래금액 (단위: 만원, 예: 50000 = 5억원)',
    'dealyear': '거래가 발생한 연도',
    'dealmonth': '거래가 발생한 월 (1-12)',
    'dealday': '거래가 발생한 일 (1-31)',
    'excluusear': '아파트 전용면적 (단위: 평방미터)',
    'floor': '아파트가 위치한 층수',
    'buildyear': '아파트 건축연도 (준공년도)',
    'jibun': '지번 주소',
    'umdnm': '읍면동명 (행정동 이름)',
    'aptdong': '아파트 동 정보',
    'sggcd': '시군구 코드 (행정구역 코드)',
    'umdcd': '읍면동 코드',
    'landcd': '토지 구분 코드',
    'bonbun': '지번 본번',
    'bubun': '지번 부번',
    'roadnm': '도로명',
    'roadnmsggcd': '도로명 시군구 코드',
    'roadnmcd': '도로명 코드',
    'roadnmseq': '도로명 순번',
    'roadnmbascd': '도로명 기초구역 코드',
    'roadnmbonbun': '도로명 본번',
    'roadnmbubun': '도로명 부번',
    'roadnmbcd': '도로명 건물 코드',
    'aptseq': '아파트 일련번호',
    'cdealtype': '거래 유형 구분 코드',
    'cdealday': '거래일 코드',
    'dealinggbn': '거래 구분 (직거래/중개거래)',
    'estateagentsggnm': '중개사소재지',
    'rgstdate': '등록일자',
    'slergbn': '매도자 구분',
    'buyergbn': '매수자 구분',
    'landleaseholdgbn': '토지임대여부',
    
    // apt_deal_rent_raw 테이블 (전월세 거래)
    'deposit': '보증금 (단위: 만원)',
    'monthlyrent': '월세금액 (단위: 만원)',
    'predeposit': '종전 보증금',
    'premonthlyrent': '종전 월세',
    'contractterm': '계약기간',
    'contracttype': '계약구분 (전세/월세)',
    'userrright': '전용사용권 여부',
    
    // apt_building_info 테이블 (건물 정보)
    'type': '건물 유형',
    'dongnm': '동명칭',
    'bldnm': '건물명',
    'platplc': '대지위치',
    'platarea': '대지면적 (단위: 평방미터)',
    'archarea': '건축면적 (단위: 평방미터)',
    'totarea': '연면적 (단위: 평방미터)',
    'grndflrcnt': '지상층수',
    'ugrndflrcnt': '지하층수',
    'mainpurpscdnm': '주요 용도',
    'strctcdnm': '구조 코드명 (철근콘크리트 등)',
    'roofcdnm': '지붕 코드명',
    'hhldcnt': '세대수',
    'mainbldcnt': '주건축물 수',
    'atchbldcnt': '부속건축물 수',
    'totpkngcnt': '총 주차대수',
    'useaprday': '사용승인일자',
    'raw_data': '원본 건축 데이터 (JSON 형태)',
    
    // ai_smart_summary 테이블 (AI 분석 요약)
    'jibun_address': '지번 주소',
    'summary': 'AI가 생성한 아파트 투자 분석 요약',
    'user_id': '사용자 식별자',
    
    // apt_info 테이블 (아파트 기본 정보)
    'lon': '경도 (longitude, WGS84 좌표계)',
    'lat': '위도 (latitude, WGS84 좌표계)',
    
    // legal_dong 테이블 (법정동 코드)
    'code': '법정동 코드 (10자리)',
    'sido': '시도명',
    'sigungu': '시군구명',
    'eupmyeondong': '읍면동명',
    'ri': '리명',
    
    // apt_deal_all 테이블 (통합 거래 데이터)
    'apt_dong': '아파트 동 정보',
    'exclu_use_ar': '전용면적 (단위: 평방미터)',
    'deal_year': '거래연도',
    'deal_month': '거래월',
    'deal_day': '거래일',
    'deal_amount': '거래금액 (단위: 만원)',
    'monthly_rent': '월세 (단위: 만원)'
};

// 테이블별 설명
const TABLE_DESCRIPTIONS: Record<string, string> = {
    'apt_deal_trade_raw': '아파트 매매 거래 원본 데이터를 저장하는 테이블입니다. 부동산 실거래가 정보, 거래일자, 건물 정보 등이 포함되어 있습니다.',
    'apt_deal_rent_raw': '아파트 전월세 거래 원본 데이터를 저장하는 테이블입니다. 보증금, 월세, 계약 조건 등이 포함되어 있습니다.',
    'apt_deal_all': '아파트 매매와 전월세 거래를 통합한 데이터 테이블입니다.',
    'apt_info': '아파트의 기본 정보(위치, 이름, 주소)를 저장하는 테이블입니다.',
    'apt_building_info': '아파트 건축물의 상세 정보(면적, 층수, 구조 등)를 저장하는 테이블입니다.',
    'ai_smart_summary': 'AI가 분석한 아파트별 투자 요약 정보를 저장하는 테이블입니다.',
    'legal_dong': '대한민국 행정구역의 법정동 코드와 명칭을 저장하는 테이블입니다.',
    'landuse_included': '토지 이용계획 정보를 저장하는 공간 데이터 테이블입니다.',
    'old_apt_deal_trade_raw': '이전 버전의 아파트 매매 거래 데이터 백업 테이블입니다.',
    'old_apt_deal_rent_raw': '이전 버전의 아파트 전월세 거래 데이터 백업 테이블입니다.',
    'old_apt_deal_all': '이전 버전의 통합 거래 데이터 백업 테이블입니다.'
};

function parseColumnsFile(filePath: string): ColumnInfo[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
        const parts = line.split('\t');
        return {
            schema: parts[0],
            table: parts[1], 
            position: parseInt(parts[2]),
            column: parts[3],
            dataType: parts[4],
            nullable: parts[5],
            defaultValue: parts[6] || undefined
        };
    });
}

function generateTableDocument(tableName: string, columns: ColumnInfo[]): string {
    const tableDescription = TABLE_DESCRIPTIONS[tableName] || `${tableName} 테이블`;
    
    let document = `# ${tableName} 테이블\n\n`;
    document += `${tableDescription}\n\n`;
    document += `## 컬럼 정보\n\n`;
    
    // 컬럼을 position 순으로 정렬
    const sortedColumns = columns.sort((a, b) => a.position - b.position);
    
    for (const col of sortedColumns) {
        const description = COLUMN_DESCRIPTIONS[col.column] || `${col.column} 컬럼`;
        const nullable = col.nullable === 'YES' ? '(NULL 허용)' : '(NOT NULL)';
        const defaultInfo = col.defaultValue ? ` 기본값: ${col.defaultValue}` : '';
        
        document += `**${col.column}** (${col.dataType}): ${description} ${nullable}${defaultInfo}\n\n`;
    }
    
    return document;
}

function generateSchemaDocument(columns: ColumnInfo[]): string {
    // 스키마별로 그룹화
    const schemaGroups = new Map<string, Map<string, ColumnInfo[]>>();
    
    for (const col of columns) {
        if (!schemaGroups.has(col.schema)) {
            schemaGroups.set(col.schema, new Map());
        }
        
        const tableMap = schemaGroups.get(col.schema)!;
        if (!tableMap.has(col.table)) {
            tableMap.set(col.table, []);
        }
        
        tableMap.get(col.table)!.push(col);
    }
    
    let fullDocument = `# OpenImjang 데이터베이스 스키마 문서\n\n`;
    fullDocument += `OpenImjang 부동산 임장 분석 플랫폼의 데이터베이스 스키마에 대한 상세 설명입니다.\n\n`;
    
    for (const [schema, tables] of schemaGroups) {
        fullDocument += `## ${schema} 스키마\n\n`;
        
        for (const [tableName, tableCols] of tables) {
            const tableDoc = generateTableDocument(tableName, tableCols);
            fullDocument += tableDoc + '\n';
        }
    }
    
    return fullDocument;
}

async function main() {
    try {
        console.log('🔍 컬럼 정보 파일 읽기 중...');
        const columnsPath = path.join(process.cwd(), '..', '..', 'docs', 'db_schema_report', 'columns.tsv');
        
        if (!fs.existsSync(columnsPath)) {
            throw new Error(`컬럼 파일을 찾을 수 없습니다: ${columnsPath}`);
        }
        
        const columns = parseColumnsFile(columnsPath);
        console.log(`✅ ${columns.length}개의 컬럼 정보를 로드했습니다.`);
        
        // 전체 스키마 문서 생성
        console.log('📝 자연어 스키마 문서 생성 중...');
        const schemaDocument = generateSchemaDocument(columns);
        
        // 출력 디렉토리 생성
        const outputDir = path.join(process.cwd(), '..', '..', 'docs', 'generated_schema_docs');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 전체 문서 저장
        const fullDocPath = path.join(outputDir, 'complete_schema_guide.md');
        fs.writeFileSync(fullDocPath, schemaDocument, 'utf-8');
        console.log(`✅ 전체 스키마 문서 생성: ${fullDocPath}`);
        
        // 테이블별 개별 문서도 생성 (임베딩 청킹용)
        const tableGroups = new Map<string, ColumnInfo[]>();
        for (const col of columns) {
            const key = `${col.schema}.${col.table}`;
            if (!tableGroups.has(key)) {
                tableGroups.set(key, []);
            }
            tableGroups.get(key)!.push(col);
        }
        
        for (const [tableKey, tableCols] of tableGroups) {
            const [schema, table] = tableKey.split('.');
            const tableDoc = generateTableDocument(table, tableCols);
            const filePath = path.join(outputDir, `${schema}_${table}.md`);
            fs.writeFileSync(filePath, tableDoc, 'utf-8');
        }
        
        console.log(`✅ ${tableGroups.size}개의 테이블별 문서를 생성했습니다.`);
        console.log(`📁 출력 디렉토리: ${outputDir}`);
        
        // 주요 테이블들 통계
        const oiTables = Array.from(tableGroups.keys()).filter(key => key.startsWith('oi.'));
        console.log('\n📊 생성된 oi 스키마 테이블 문서:');
        oiTables.forEach(table => console.log(`   - ${table}`));
        
    } catch (error) {
        console.error('❌ 스키마 문서 생성 중 오류:', error);
        process.exit(1);
    }
}

// ES 모듈에서는 import.meta.main을 사용 (또는 직접 실행)
main();