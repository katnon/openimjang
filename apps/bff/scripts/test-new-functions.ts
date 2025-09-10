// 새로운 RAG + Function Calling 함수들 개별 테스트
import "dotenv/config";
import { generateSelectQuery } from '../src/ai/handlers/database/generateSelectQuery';
import { executeQuery } from '../src/ai/handlers/database/executeQuery';
import { displayOnMap } from '../src/ai/handlers/visualization/displayOnMap';

async function testFunctions() {
  console.log('🧪 새로운 함수들 개별 테스트 시작...\n');
  
  // 1) generateSelectQuery 테스트
  console.log('1️⃣ generateSelectQuery 테스트');
  try {
    const sqlResult = await generateSelectQuery({ 
      question: 'apt_deal_trade_raw 테이블에서 dealamount 컬럼의 평균값을 구해줘' 
    });
    
    console.log('SQL 생성 결과:', {
      success: sqlResult.success,
      sql: sqlResult.sql?.slice(0, 100) + '...',
      schemasUsed: sqlResult.schemasUsed?.length
    });
    
    // 2) executeQuery 테스트 (SQL이 생성되었다면)
    if (sqlResult.success && sqlResult.sql) {
      console.log('\n2️⃣ executeQuery 테스트');
      const execResult = await executeQuery({
        sql: sqlResult.sql,
        explanation: sqlResult.explanation || 'Test query'
      });
      
      console.log('SQL 실행 결과:', {
        success: execResult.success,
        rowCount: execResult.rowCount,
        executionTime: execResult.executionTime,
        hasData: !!execResult.rows?.length
      });
    }
    
  } catch (error) {
    console.error('❌ Database 함수 테스트 오류:', error);
  }
  
  // 3) displayOnMap 테스트  
  console.log('\n3️⃣ displayOnMap 테스트');
  try {
    const mapResult = await displayOnMap({
      location: '마곡엠밸리7단지',
      coordinates: { lat: 37.5665, lon: 126.9780 },
      analysisData: {
        title: '평균 매매가',
        value: '5.34억원',
        description: '최근 1년 거래 기준'
      }
    });
    
    console.log('지도 시각화 결과:', {
      success: mapResult.success,
      hasMapData: !!mapResult.mapData,
      message: mapResult.message
    });
    
  } catch (error) {
    console.error('❌ Visualization 함수 테스트 오류:', error);
  }
}

testFunctions().then(() => {
  console.log('\n✅ 함수 테스트 완료');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 전체 테스트 실패:', error);
  process.exit(1);
});