// SQL 쿼리 실행 핸들러
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 5,
  prepare: false,
  idle_timeout: 10
});

interface ExecuteQueryArgs {
  sql: string;
  explanation: string;
}

export async function executeQuery(args: ExecuteQueryArgs) {
  try {
    const { sql: query, explanation } = args;
    
    console.log('🔄 SQL 쿼리 실행 요청:', { 
      explanation,
      queryLength: query.length,
      queryStart: query.slice(0, 100) + '...'
    });
    
    // 1) 보안 검증: SELECT 문만 허용
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery.startsWith('select')) {
      return {
        success: false,
        error: '보안상 SELECT 쿼리만 실행할 수 있습니다.',
        rows: null,
        rowCount: 0
      };
    }
    
    // 2) 위험한 키워드 검사
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'create', 'alter', 'truncate'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => 
      normalizedQuery.includes(keyword.toLowerCase())
    );
    
    if (hasDangerousKeyword) {
      return {
        success: false,
        error: '데이터 변경 쿼리는 실행할 수 없습니다.',
        rows: null,
        rowCount: 0
      };
    }
    
    // 3) 쿼리 실행
    const startTime = Date.now();
    const result = await sql.unsafe(query);
    const executionTime = Date.now() - startTime;
    
    const rows = Array.isArray(result) ? result : [result];
    
    console.log('✅ SQL 실행 완료:', { 
      rowCount: rows.length,
      executionTime: `${executionTime}ms`,
      explanation
    });
    
    // 4) 결과가 너무 많으면 제한 (최대 100개 행)
    const limitedRows = rows.slice(0, 100);
    const wasLimited = rows.length > 100;
    
    return {
      success: true,
      rows: limitedRows,
      rowCount: rows.length,
      executionTime,
      wasLimited,
      limitMessage: wasLimited ? '결과가 100개 행으로 제한되었습니다.' : null,
      explanation
    };
    
  } catch (error: any) {
    console.error('❌ SQL 실행 오류:', error);
    
    // PostgreSQL 에러 메시지를 사용자 친화적으로 변환
    let errorMessage = error.message || 'SQL 실행 중 오류가 발생했습니다.';
    
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      errorMessage = '존재하지 않는 테이블이나 컬럼을 참조했습니다.';
    } else if (error.message?.includes('syntax error')) {
      errorMessage = 'SQL 구문 오류가 있습니다.';
    } else if (error.message?.includes('permission denied')) {
      errorMessage = '데이터베이스 접근 권한이 없습니다.';
    }
    
    return {
      success: false,
      error: errorMessage,
      rows: null,
      rowCount: 0,
      originalError: error.message
    };
  }
}