import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import * as iconv from 'iconv-lite';

// DB 연결 설정
const url = process.env.DATABASE_URL;
if (!url) {
    console.error('❌ DATABASE_URL is missing');
    process.exit(1);
}

const sql = postgres(url, {
    max: 5,
    prepare: false,
    idle_timeout: 10,
    connect_timeout: 10,
});

interface LegalDongRecord {
    code: string;
    sido: string;
    sigungu: string;
    eupmyeondong: string;
    ri: string;
}

/**
 * 행정구역명을 파싱해서 시도/시군구/읍면동/리로 분리
 */
function parseAdminArea(adminAreaName: string, lowestAreaName: string): {
    sido: string;
    sigungu: string;
    eupmyeondong: string;
    ri: string;
} {
    const parts = adminAreaName.split(' ').filter(x => x.trim());

    let sido = '';
    let sigungu = '';
    let eupmyeondong = '';
    let ri = '';

    // 첫 번째 부분: 시도
    if (parts.length >= 1) {
        const firstPart = parts[0];
        if (firstPart.includes('도') || firstPart.includes('시') ||
            firstPart.includes('특별') || firstPart.includes('광역') ||
            firstPart.includes('자치')) {
            sido = firstPart;
        }
    }

    // 두 번째 부분: 시군구
    if (parts.length >= 2) {
        const secondPart = parts[1];
        if (secondPart.includes('시') || secondPart.includes('군') || secondPart.includes('구')) {
            sigungu = secondPart;
        }
    }

    // 세 번째 부분: 읍면동 (~~가 포함)
    if (parts.length >= 3) {
        const thirdPart = parts[2];
        if (thirdPart.includes('읍') || thirdPart.includes('면') ||
            thirdPart.includes('동') || thirdPart.includes('가')) {
            eupmyeondong = thirdPart;
        }
    }

    // 네 번째 부분: 리
    if (parts.length >= 4) {
        const fourthPart = parts[3];
        if (fourthPart.includes('리')) {
            ri = fourthPart;
        }
    }

    // 최하위행정구역명 처리
    if (lowestAreaName && lowestAreaName.trim()) {
        const lowest = lowestAreaName.trim();
        if (lowest.includes('리')) {
            ri = lowest;
        } else if (lowest.includes('동') || lowest.includes('읍') ||
            lowest.includes('면') || lowest.includes('가')) {
            // ~~가로 끝나는 동도 포함
            if (!eupmyeondong) {
                eupmyeondong = lowest;
            }
        }
    }

    return { sido, sigungu, eupmyeondong, ri };
}

/**
 * CSV 파일을 파싱해서 전국 법정동 데이터 추출
 */
function parseLegalDongCSV(csvPath: string): LegalDongRecord[] {
    console.log(`📖 CSV 파일 읽는 중: ${csvPath}`);

    // 한글 깨짐 방지: 여러 인코딩 시도
    let csvContent: string = '';

    try {
        // 1. EUC-KR로 먼저 시도 (국토교통부 파일은 보통 EUC-KR)
        const buffer = readFileSync(csvPath);
        csvContent = iconv.decode(buffer, 'euc-kr');
        console.log('✅ EUC-KR 인코딩으로 파일 읽기 성공');

        // 한글이 제대로 읽혔는지 확인
        if (csvContent.includes('경상남도') || csvContent.includes('서울특별시')) {
            console.log('✅ 한글 인식 성공');
        } else {
            throw new Error('한글 인식 실패');
        }
    } catch (error) {
        try {
            // 2. CP949로 시도
            const buffer = readFileSync(csvPath);
            csvContent = iconv.decode(buffer, 'cp949');
            console.log('✅ CP949 인코딩으로 파일 읽기 성공');
        } catch (error2) {
            try {
                // 3. UTF-8로 재시도
                csvContent = readFileSync(csvPath, 'utf-8');
                console.log('✅ UTF-8 인코딩으로 파일 읽기 성공');
            } catch (error3) {
                console.error('❌ 파일 읽기 실패:', error3);
                throw error3;
            }
        }
    }

    const lines = csvContent.split('\n');

    // 첫 번째 줄이 헤더인지 확인 후 제거
    const dataLines = lines.filter(line => line.trim().length > 0);
    if (dataLines[0].includes('법정코드') || dataLines[0].includes('행정구역명')) {
        dataLines.shift(); // 헤더 제거
        console.log('📋 헤더 제거 완료');
    }

    const records: LegalDongRecord[] = [];
    let skippedCount = 0;

    console.log(`📊 총 ${dataLines.length.toLocaleString()}줄 처리 시작...`);

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];

        // CSV 파싱 (쉼표로 분리하되 따옴표 처리)
        const columns: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                columns.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        columns.push(current.trim()); // 마지막 컬럼

        // CSV 구조: 법정코드, 행정구역명, 최하위행정구역명, 생성일자, 변경전행정구역코드
        if (columns.length < 3) {
            skippedCount++;
            continue;
        }

        const [codeStr, adminAreaName, lowestAreaName] = columns;
        const code = codeStr.trim();

        // 법정코드가 10자리 숫자가 아니면 건너뛰기
        if (!/^\d{10}$/.test(code)) {
            skippedCount++;
            continue;
        }

        // 행정구역명이 비어있으면 건너뛰기
        if (!adminAreaName || !adminAreaName.trim()) {
            skippedCount++;
            continue;
        }

        // 행정구역 파싱
        const { sido, sigungu, eupmyeondong, ri } = parseAdminArea(
            adminAreaName.trim(),
            lowestAreaName.trim()
        );

        // 시도가 없으면 건너뛰기
        if (!sido) {
            skippedCount++;
            if (i < 10) { // 처음 몇 개만 디버그 출력
                console.log(`❌ 파싱 실패 (${i + 1}번째): "${adminAreaName}" -> sido: "${sido}"`);
            }
            continue;
        }

        records.push({
            code,
            sido,
            sigungu,
            eupmyeondong,
            ri
        });

        // 처음 몇 개는 디버그 출력
        if (i < 5) {
            console.log(`✅ 파싱 성공 (${i + 1}번째): "${adminAreaName}" -> ${sido} | ${sigungu} | ${eupmyeondong} | ${ri}`);
        }

        // 진행상황 표시
        if ((i + 1) % 10000 === 0) {
            console.log(`📝 ${(i + 1).toLocaleString()}/${dataLines.length.toLocaleString()} 줄 처리 완료 (파싱: ${records.length.toLocaleString()}개)`);
        }
    }

    console.log(`✅ 파싱 완료: ${records.length.toLocaleString()}개 (건너뜀: ${skippedCount.toLocaleString()}개)`);

    // 시도별 통계 출력
    const sidoStats = records.reduce((acc, record) => {
        acc[record.sido] = (acc[record.sido] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('📊 시도별 상위 10개:');
    Object.entries(sidoStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([sido, count]) => {
            console.log(`   ${sido}: ${count.toLocaleString()}개`);
        });

    return records;
}

/**
 * 법정동 데이터를 DB에 삽입
 */
async function insertLegalDongData(records: LegalDongRecord[]) {
    console.log('🔄 DB에 법정동 데이터 삽입 중...');

    try {
        // 기존 모든 데이터 삭제 (전체 재구축)
        await sql`DELETE FROM oi.legal_dong`;
        console.log('🗑️  기존 데이터 삭제 완료');

        // 배치 삽입
        const batchSize = 1000;
        let insertedCount = 0;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            await sql`
                INSERT INTO oi.legal_dong (
                    code, sido, sigungu, eupmyeondong, ri
                ) VALUES ${sql(batch.map(record => [
                record.code,
                record.sido,
                record.sigungu || null,
                record.eupmyeondong || null,
                record.ri || null
            ] as const))}
            `;

            insertedCount += batch.length;
            const progress = Math.round(insertedCount / records.length * 100);
            console.log(`📝 ${insertedCount.toLocaleString()}/${records.length.toLocaleString()} 삽입 완료 (${progress}%)`);
        }

        console.log(`✅ 총 ${insertedCount.toLocaleString()}개 법정동 데이터 삽입 완료`);

    } catch (error) {
        console.error('❌ DB 삽입 중 오류:', error);
        throw error;
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    const csvFileName = '국토교통부_행정구역법정동코드_20250807.CSV';
    const csvPath = join(process.cwd(), 'data', csvFileName);

    console.log('🚀 전국 법정동 데이터 로딩 시작');
    console.log(`📁 CSV 파일 경로: ${csvPath}`);

    try {
        // 1. CSV 파싱
        const records = parseLegalDongCSV(csvPath);

        if (records.length === 0) {
            console.log('⚠️  파싱된 데이터가 없습니다. CSV 파일 형식을 확인해주세요.');
            return;
        }

        // 2. DB 삽입
        await insertLegalDongData(records);

        // 3. 결과 확인
        const result = await sql`
            SELECT 
                COUNT(*) as total_count,
                COUNT(DISTINCT sido) as sido_count,
                COUNT(CASE WHEN sigungu IS NOT NULL THEN 1 END) as sigungu_count,
                COUNT(CASE WHEN eupmyeondong IS NOT NULL THEN 1 END) as dong_count,
                COUNT(CASE WHEN ri IS NOT NULL THEN 1 END) as ri_count
            FROM oi.legal_dong
        `;

        const stats = result[0];
        console.log(`🎉 작업 완료!`);
        console.log(`   총 데이터: ${stats.total_count.toLocaleString()}개`);
        console.log(`   시도 수: ${stats.sido_count}개`);
        console.log(`   시군구: ${stats.sigungu_count.toLocaleString()}개`);
        console.log(`   읍면동: ${stats.dong_count.toLocaleString()}개`);
        console.log(`   리: ${stats.ri_count.toLocaleString()}개`);

        // 서울 데이터 확인
        const seoulResult = await sql`
            SELECT COUNT(*) as seoul_count
            FROM oi.legal_dong 
            WHERE sido LIKE '%서울%'
        `;
        console.log(`   서울: ${seoulResult[0].seoul_count}개`);

    } catch (error) {
        console.error('❌ 작업 실패:', error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

// 스크립트 직접 실행 시
if (require.main === module) {
    main();
}

export { parseLegalDongCSV, insertLegalDongData };
