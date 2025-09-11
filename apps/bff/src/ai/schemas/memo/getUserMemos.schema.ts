// apps/bff/src/ai/schemas/memo/getUserMemos.schema.ts
import { z } from 'zod';

export const getUserMemosInput = z.object({
    userId: z.string().describe('사용자 ID - Firebase Auth 사용자의 고유 식별자'),
    aptId: z.string().optional().describe('특정 아파트 ID로 필터링 (선택사항)')
});

export type GetUserMemosInput = z.infer<typeof getUserMemosInput>;

// OpenAI Function Calling 스키마
export const getUserMemosSchema = {
    name: 'getUserMemos',
    description: `사용자가 작성한 임장 메모를 조회합니다. 
    
사용자의 부동산 임장(현장 답사) 기록과 평가를 가져와서 AI가 분석에 참고할 수 있도록 합니다.
메모에는 아파트별 장단점, 투자가치 평가, 실제 방문 후기 등이 포함되어 있습니다.

사용 시기:
- 사용자가 특정 아파트에 대해 물어볼 때 기존 메모 확인
- 아파트 추천 시 사용자의 과거 선호도 참고
- 투자 분석 시 사용자의 실제 경험담 활용`,
    parameters: {
        type: 'object',
        properties: {
            userId: {
                type: 'string',
                description: 'Firebase Auth 사용자의 고유 식별자 (uid)'
            },
            aptId: {
                type: 'string',
                description: '특정 아파트 ID로 필터링 (선택사항) - 해당 아파트 관련 메모만 조회'
            }
        },
        required: ['userId']
    }
};