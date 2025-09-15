// 아파트 위치 명확화 서비스 - SmartApartmentResolver와 Clarify 시스템 통합
import { smartApartmentResolver } from '../../services/smartApartmentResolver';
import { defaultClarifyPolicy } from '../clarify/policy';
import { apartmentContextManager } from '../../services/apartmentContextManager';
import { ConversationSlots } from '../types/slots';
import type { ClarifyContext, ClarifyQuestion, ClarifyResponse } from '../clarify/types';

export interface ApartmentLocationClarifyResult {
  success: boolean;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  suggestions?: string[];
  apartmentInfo?: any;
  slotUpdates?: Partial<ConversationSlots>;
  error?: string;
}

export interface ClarificationResponseResult {
  success: boolean;
  slotUpdates: Partial<ConversationSlots>;
  needsMoreClarification: boolean;
  error?: string;
}

/**
 * 아파트 위치 명확화 통합 서비스
 */
export class ApartmentLocationClarifyService {
  
  /**
   * 아파트명으로 검색하고 다중위치 감지 시 명확화 질문 생성
   */
  async searchApartmentWithClarification(
    apartmentName: string,
    currentSlots: ConversationSlots = {}
  ): Promise<ApartmentLocationClarifyResult> {
    try {
      console.log('🔍 아파트 위치 명확화 검색 시작:', apartmentName);

      // 1. SmartApartmentResolver로 다중위치 감지 검색
      const searchResult = await smartApartmentResolver.searchApartmentWithMultiLocationDetection(apartmentName);

      // 2. 컨텍스트 매니저에 아파트 정보 추가
      if (searchResult.result) {
        apartmentContextManager.addApartment({
          name: apartmentName,
          source: 'vector_search',
          metadata: searchResult.result
        });
      }

      // 3. 명확화가 필요한 경우
      if (searchResult.requiresClarification && searchResult.clarificationData) {
        console.log('🤔 다중위치 감지 - 명확화 질문 생성');
        
        return {
          success: true,
          requiresClarification: true,
          clarificationQuestion: searchResult.clarificationData.question,
          suggestions: searchResult.clarificationData.suggestions,
          apartmentInfo: searchResult.result
        };
      }

      // 4. 명확화가 필요없는 경우 - 슬롯 업데이트
      console.log('✅ 단일 위치 확인 - 슬롯 업데이트');
      
      const slotUpdates: Partial<ConversationSlots> = {
        apartmentName: apartmentName,
        apartmentMetadata: searchResult.result
      };

      // 지역 정보가 있으면 추가
      if (searchResult.result?.region) {
        slotUpdates.region = searchResult.result.region;
      }

      // 좌표 정보가 있으면 추가
      if (searchResult.result?.lat && searchResult.result?.lon) {
        slotUpdates.coordinates = {
          lat: searchResult.result.lat,
          lng: searchResult.result.lon
        };
      }

      return {
        success: true,
        requiresClarification: false,
        apartmentInfo: searchResult.result,
        slotUpdates
      };

    } catch (error: any) {
      console.error('❌ 아파트 위치 명확화 검색 실패:', error);
      return {
        success: false,
        requiresClarification: false,
        error: error.message
      };
    }
  }

  /**
   * 사용자의 명확화 응답 처리
   */
  async processClarificationResponse(
    userResponse: string,
    apartmentName: string,
    suggestions: string[],
    currentSlots: ConversationSlots = {}
  ): Promise<ClarificationResponseResult> {
    try {
      console.log('🔄 명확화 응답 처리:', { userResponse, apartmentName, suggestions });

      // Clarify 컨텍스트 생성
      const context: ClarifyContext = {
        currentSlots,
        reason: 'ambiguous',
        candidates: suggestions,
        metadata: {
          apartmentName,
          originalSuggestions: suggestions
        }
      };

      // Clarify 정책으로 응답 처리
      const clarifyResult = await defaultClarifyPolicy.processResponse('region', userResponse, context);

      if (!clarifyResult.success) {
        return {
          success: false,
          slotUpdates: {},
          needsMoreClarification: true,
          error: clarifyResult.error
        };
      }

      // 추가 명확화가 필요한 경우
      if (clarifyResult.needsMoreClarification) {
        return {
          success: true,
          slotUpdates: {},
          needsMoreClarification: true
        };
      }

      // 선택된 지역이 있는 경우
      if (clarifyResult.updatedSlots?.region) {
        const selectedRegion = clarifyResult.updatedSlots.region;
        console.log('✅ 지역 선택 완료:', selectedRegion);

        // 선택된 지역으로 아파트 재검색
        const specificSearchResult = await this.searchSpecificLocationApartment(apartmentName, selectedRegion);

        const slotUpdates: Partial<ConversationSlots> = {
          apartmentName,
          region: selectedRegion,
          ...clarifyResult.updatedSlots
        };

        // 재검색 결과가 있으면 메타데이터 업데이트
        if (specificSearchResult.apartmentInfo) {
          const apartmentInfo = specificSearchResult.apartmentInfo.apartment || specificSearchResult.apartmentInfo;
          slotUpdates.apartmentMetadata = apartmentInfo;
          
          if (apartmentInfo.lat && apartmentInfo.lon) {
            slotUpdates.coordinates = {
              lat: apartmentInfo.lat,
              lng: apartmentInfo.lon
            };
          }
        }

        // 컨텍스트 매니저 업데이트
        apartmentContextManager.addApartment({
          name: apartmentName,
          region: selectedRegion,
          source: 'mentioned',
          metadata: specificSearchResult.apartmentInfo
        });

        return {
          success: true,
          slotUpdates,
          needsMoreClarification: false
        };
      }

      return {
        success: true,
        slotUpdates: clarifyResult.updatedSlots || {},
        needsMoreClarification: false
      };

    } catch (error: any) {
      console.error('❌ 명확화 응답 처리 실패:', error);
      return {
        success: false,
        slotUpdates: {},
        needsMoreClarification: true,
        error: error.message
      };
    }
  }

  /**
   * 특정 지역의 아파트 정보 검색
   */
  private async searchSpecificLocationApartment(apartmentName: string, region: string) {
    try {
      console.log('🎯 특정 지역 아파트 재검색:', { apartmentName, region });
      
      // 지역 정보를 포함한 검색 쿼리 생성
      const searchQuery = `${apartmentName} ${region}`;
      const result = await smartApartmentResolver.resolveApartment(searchQuery);
      
      console.log('✅ 특정 지역 검색 완료:', !!result);
      
      return {
        success: !!result?.apartment,
        apartmentInfo: result?.apartment
      };
    } catch (error: any) {
      console.error('❌ 특정 지역 아파트 검색 실패:', error);
      return {
        success: false,
        apartmentInfo: null
      };
    }
  }

  /**
   * 컨텍스트에서 아파트 정보 조회
   */
  getApartmentFromContext(apartmentName?: string): any {
    if (!apartmentName) return null;
    
    const apartments = apartmentContextManager.findByName(apartmentName);
    return apartments.length > 0 ? apartments[0] : null;
  }

  /**
   * 현재 컨텍스트 디버그 정보
   */
  getContextDebugInfo() {
    return apartmentContextManager.getDebugInfo();
  }
}

/**
 * 싱글톤 인스턴스
 */
export const apartmentLocationClarifyService = new ApartmentLocationClarifyService();