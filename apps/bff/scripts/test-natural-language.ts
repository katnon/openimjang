// 자연어 질문 테스트 - 개선된 RAG + Function Calling 시스템 검증
import "dotenv/config";
import { generateSelectQuery } from '../src/ai/handlers/database/generateSelectQuery';
import { executeQuery } from '../src/ai/handlers/database/executeQuery';
import { displayOnMap } from '../src/ai/handlers/visualization/displayOnMap';

async function testNaturalLanguageQueries() {
  console.log('🎯 자연어 질문 → SQL 변환 테스트 시작\n');
  
  // 자연어 테스트 케이스들
  const naturalLanguageTests = [
    {
      category: '매매가 질문',
      question: '마곡엠밸리 최근 3개월 평균 매매가 알려줘',
      expectedTable: 'oi.apt_deal_trade_raw',
      expectedColumns: ['AVG(dealamount)', 'aptnm', 'MAKE_DATE']
    },
    {
      category: '거래량 질문',
      question: '래미안 2024년 전체 거래량은?',
      expectedTable: 'oi.apt_deal_trade_raw',
      expectedColumns: ['COUNT', 'aptnm', 'dealyear']
    },
    {
      category: '전월세 질문',
      question: '힐스테이트 전세 보증금 평균',
      expectedTable: 'oi.apt_deal_rent_raw',
      expectedColumns: ['AVG(deposit)', 'aptnm', 'monthlyrent']
    },
    {
      category: '최고가 질문',
      question: '디에이치 최근 1년 최고가 매매 거래',
      expectedTable: 'oi.apt_deal_trade_raw', 
      expectedColumns: ['MAX(dealamount)', 'aptnm', 'INTERVAL']
    },
    {
      category: '기간 지정 질문',
      question: '푸르지오 작년 전세 평균값',
      expectedTable: 'oi.apt_deal_rent_raw',
      expectedColumns: ['AVG', 'aptnm', 'dealyear']
    }
  ];

  const results = [];

  for (let i = 0; i < naturalLanguageTests.length; i++) {
    const test = naturalLanguageTests[i];
    console.log(`${i + 1}️⃣ ${test.category}: "${test.question}"`);
    
    try {
      // 1) SQL 생성 테스트
      const startTime = Date.now();
      const sqlResult = await generateSelectQuery({ question: test.question });
      const generationTime = Date.now() - startTime;

      console.log(`   📝 SQL 생성 (${generationTime}ms):`, {
        success: sqlResult.success,
        sql: sqlResult.sql ? sqlResult.sql.slice(0, 120) + '...' : 'null',
        schemasUsed: sqlResult.schemasUsed?.length || 0
      });

      // 2) SQL 내용 검증
      if (sqlResult.success && sqlResult.sql) {
        const sqlLower = sqlResult.sql.toLowerCase();
        const hasExpectedTable = sqlLower.includes(test.expectedTable.toLowerCase());
        const hasExpectedColumns = test.expectedColumns.every(col => 
          sqlLower.includes(col.toLowerCase())
        );
        
        console.log(`   ✅ 검증:`, {
          스키마테이블: hasExpectedTable ? '✓' : '✗',
          예상컬럼: hasExpectedColumns ? '✓' : '✗'
        });

        // 3) SQL 실행 테스트
        try {
          const execStartTime = Date.now();
          const execResult = await executeQuery({
            sql: sqlResult.sql,
            explanation: `자연어 질문: ${test.question}`
          });
          const executionTime = Date.now() - execStartTime;

          console.log(`   🔄 SQL 실행 (${executionTime}ms):`, {
            success: execResult.success,
            rowCount: execResult.rowCount,
            hasData: !!execResult.rows?.length,
            error: execResult.error ? execResult.error.slice(0, 80) + '...' : undefined
          });

          // 결과 저장
          results.push({
            question: test.question,
            category: test.category,
            sqlGenerated: !!sqlResult.sql,
            sqlExecuted: execResult.success,
            hasData: !!execResult.rows?.length,
            generationTime,
            executionTime: execResult.success ? executionTime : null
          });

        } catch (execError: any) {
          console.log(`   ❌ SQL 실행 오류:`, execError.message?.slice(0, 80));
          results.push({
            question: test.question,
            category: test.category,
            sqlGenerated: true,
            sqlExecuted: false,
            hasData: false,
            generationTime,
            executionTime: null
          });
        }
      } else {
        console.log(`   ❌ SQL 생성 실패:`, sqlResult.error?.slice(0, 80));
        results.push({
          question: test.question,
          category: test.category,
          sqlGenerated: false,
          sqlExecuted: false,
          hasData: false,
          generationTime,
          executionTime: null
        });
      }

    } catch (error: any) {
      console.error(`   ❌ 전체 테스트 오류:`, error.message?.slice(0, 80));
      results.push({
        question: test.question,
        category: test.category,
        sqlGenerated: false,
        sqlExecuted: false,
        hasData: false,
        generationTime: 0,
        executionTime: null
      });
    }

    console.log(); // 줄바꿈
  }

  // 4) 전체 결과 요약
  console.log('📊 테스트 결과 요약:');
  console.log('━'.repeat(80));

  const totalTests = results.length;
  const sqlGenerated = results.filter(r => r.sqlGenerated).length;
  const sqlExecuted = results.filter(r => r.sqlExecuted).length;
  const hasData = results.filter(r => r.hasData).length;
  
  console.log(`총 테스트: ${totalTests}개`);
  console.log(`SQL 생성 성공: ${sqlGenerated}/${totalTests} (${Math.round(sqlGenerated/totalTests*100)}%)`);
  console.log(`SQL 실행 성공: ${sqlExecuted}/${totalTests} (${Math.round(sqlExecuted/totalTests*100)}%)`);
  console.log(`데이터 반환: ${hasData}/${totalTests} (${Math.round(hasData/totalTests*100)}%)`);
  
  const avgGenerationTime = Math.round(
    results.reduce((sum, r) => sum + r.generationTime, 0) / totalTests
  );
  console.log(`평균 SQL 생성 시간: ${avgGenerationTime}ms`);

  // 5) 기존 기술적 질문 하위 호환성 테스트
  console.log('\n🔧 기존 기술적 질문 하위 호환성 테스트');
  try {
    const technicalResult = await generateSelectQuery({ 
      question: 'oi.apt_deal_trade_raw 테이블에서 dealamount 컬럼의 평균값을 구해줘' 
    });
    
    console.log('기술적 질문 결과:', {
      success: technicalResult.success,
      sql: technicalResult.sql ? technicalResult.sql.slice(0, 100) + '...' : 'null'
    });
  } catch (error: any) {
    console.error('❌ 하위 호환성 테스트 실패:', error.message?.slice(0, 80));
  }

  return results;
}

async function testCompleteWorkflow() {
  console.log('\n🔗 완전한 워크플로우 테스트 (SQL → 실행 → 지도)');
  
  const testQuestion = '마곡엠밸리 최근 6개월 평균 매매가';
  console.log(`질문: ${testQuestion}`);

  try {
    // 1) SQL 생성
    const sqlResult = await generateSelectQuery({ question: testQuestion });
    if (!sqlResult.success || !sqlResult.sql) {
      console.log('❌ SQL 생성 실패');
      return;
    }

    // 2) SQL 실행
    const execResult = await executeQuery({
      sql: sqlResult.sql,
      explanation: sqlResult.explanation || testQuestion
    });
    
    if (!execResult.success || !execResult.rows?.length) {
      console.log('❌ SQL 실행 실패 또는 데이터 없음');
      return;
    }

    // 3) 지도 시각화 (가상 데이터)
    const avgPrice = execResult.rows[0]?.avg || '정보 없음';
    const mapResult = await displayOnMap({
      location: '마곡엠밸리',
      coordinates: { lat: 37.5665, lon: 126.9780 },
      analysisData: {
        title: '평균 매매가',
        value: typeof avgPrice === 'number' ? `${Math.round(avgPrice/10000*10)/10}억원` : avgPrice.toString(),
        description: '최근 6개월 거래 기준'
      }
    });

    console.log('🎯 완전한 워크플로우 성공!');
    console.log(`   SQL: ${sqlResult.sql.slice(0, 80)}...`);
    console.log(`   데이터: ${execResult.rowCount}개 행`);
    console.log(`   지도: ${mapResult.success ? '생성됨' : '실패'}`);

  } catch (error: any) {
    console.error('❌ 워크플로우 테스트 오류:', error.message?.slice(0, 100));
  }
}

// 메인 테스트 실행
async function main() {
  const results = await testNaturalLanguageQueries();
  await testCompleteWorkflow();
  
  console.log('\n✅ 자연어 질문 테스트 완료');
  return results;
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});