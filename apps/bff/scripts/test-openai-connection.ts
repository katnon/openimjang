// OpenAI API 연결 테스트
import OpenAI from 'openai';

async function testOpenAIConnection() {
  console.log('🔑 OpenAI API 키 테스트 시작...');
  console.log(`📏 API Key Length: ${process.env.OPENAI_API_KEY?.length || 0}`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY 환경변수가 없습니다');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    console.log('📞 OpenAI API 호출 중...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ 
        role: 'user', 
        content: 'Hello! Just testing API connection. Reply with "API_TEST_OK".' 
      }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API 연결 성공!');
    console.log('💬 응답:', response.choices[0].message.content);
    console.log('📊 사용된 토큰:', response.usage);
    
  } catch (error: any) {
    console.log('❌ OpenAI API 연결 실패:', error.message);
    console.log('🔍 에러 세부사항:', error.status, error.type);
  }
}

testOpenAIConnection();