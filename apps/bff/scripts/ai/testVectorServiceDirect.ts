// 벡터 서비스 직접 호출 테스트
import "dotenv/config";
import { vectorService } from '../../src/services/vectorService';

async function testVectorService() {
    console.log('🧪 벡터 서비스 직접 테스트 시작...');
    
    const queries = [
        "apt_deal_trade_raw 테이블 컬럼",
        "아파트 매매 거래 데이터",
        "oi 스키마의 apt_deal_trade_raw"
    ];
    
    for (const query of queries) {
        console.log(`\n🔍 질의: "${query}"`);
        try {
            const results = await vectorService.search(query, { topK: 3 });
            console.log(`📊 결과: ${results.length}개 문서 찾음`);
            
            results.forEach((doc, idx) => {
                console.log(`  [${idx + 1}] Score: ${doc.metadata.score.toFixed(4)}`);
                console.log(`      Schema: ${doc.metadata.schema_name}, Table: ${doc.metadata.table_name}`);
                console.log(`      Content: ${doc.content.slice(0, 100)}...`);
            });
            
        } catch (error) {
            console.error(`❌ 오류:`, error);
        }
    }
}

testVectorService().then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
}).catch((error) => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
});