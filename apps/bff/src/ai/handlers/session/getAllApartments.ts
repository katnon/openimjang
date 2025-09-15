// apps/bff/src/ai/handlers/session/getAllApartments.ts

import { ConversationSession } from '../../../services/conversationSession';

/**
 * 현재 세션에서 언급되거나 저장된 모든 아파트 정보를 조회합니다.
 */
export function getAllApartments(args: {}, session?: ConversationSession) {
  try {
    console.log('🏢 세션 아파트 목록 조회 중...');
    
    if (!session) {
      console.warn('⚠️ 세션이 제공되지 않음 - 빈 배열 반환');
      return [];
    }

    const apartments = session.getAllApartments();
    
    console.log(`✅ 세션 아파트 ${apartments.length}개 조회 완료`);
    
    if (apartments.length === 0) {
      return {
        message: "현재 세션에 저장된 아파트 정보가 없습니다.",
        apartments: []
      };
    }
    
    return {
      message: `총 ${apartments.length}개의 아파트 정보가 세션에 저장되어 있습니다.`,
      apartments: apartments.map(apt => ({
        id: apt.id,
        name: apt.name,
        address: apt.address,
        region: apt.region,
        addedAt: apt.addedAt,
        lastMentioned: apt.lastMentioned,
        metadata: apt.metadata
      }))
    };
    
  } catch (error: any) {
    console.error('❌ getAllApartments 오류:', error);
    return {
      error: '아파트 목록 조회 중 오류가 발생했습니다.',
      message: error.message || '알 수 없는 오류'
    };
  }
}