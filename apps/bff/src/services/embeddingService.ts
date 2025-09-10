// apps/bff/src/services/embeddingService.ts - 임베딩 파이프라인 서비스
import { vectorService, DocumentToIndex } from './vectorService';

/**
 * 임베딩 및 인덱싱 서비스
 */
export class EmbeddingService {
    private static instance: EmbeddingService;

    static getInstance(): EmbeddingService {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }

    /**
     * 사용자 임장 메모를 벡터화하여 인덱싱
     */
    async indexUserMemo(memoData: {
        id: string;
        userId: string;
        title: string;
        content: string;
        apartmentId?: string;
        apartmentName?: string;
        location?: string;
        createdAt: Date;
        updatedAt: Date;
    }): Promise<void> {
        try {
            console.log('🔄 사용자 메모 인덱싱 시작:', memoData.id);

            // 메모 내용을 검색에 최적화된 형태로 구성
            const searchableContent = this.createSearchableContent(memoData);
            
            const document: DocumentToIndex = {
                id: `memo_${memoData.userId}_${memoData.id}`,
                content: searchableContent,
                metadata: {
                    source: `임장 메모: ${memoData.title}`,
                    type: 'user_memo',
                    userId: memoData.userId,
                    apartmentId: memoData.apartmentId,
                    timestamp: memoData.updatedAt.toISOString()
                }
            };

            await vectorService.indexDocument(document);
            console.log('✅ 사용자 메모 인덱싱 완료:', memoData.id);

        } catch (error) {
            console.error('❌ 사용자 메모 인덱싱 오류:', error);
            throw new Error(`메모 인덱싱 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 사용자 메모 업데이트 시 재인덱싱
     */
    async reindexUserMemo(memoData: {
        id: string;
        userId: string;
        title: string;
        content: string;
        apartmentId?: string;
        apartmentName?: string;
        location?: string;
        createdAt: Date;
        updatedAt: Date;
    }): Promise<void> {
        try {
            console.log('🔄 사용자 메모 재인덱싱:', memoData.id);
            
            // 기존 인덱스 삭제 후 새로 생성
            const documentId = `memo_${memoData.userId}_${memoData.id}`;
            await vectorService.deleteDocument(documentId);
            await this.indexUserMemo(memoData);
            
        } catch (error) {
            console.error('❌ 사용자 메모 재인덱싱 오류:', error);
            throw new Error(`메모 재인덱싱 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 사용자 메모 삭제 시 인덱스에서 제거
     */
    async deleteUserMemo(userId: string, memoId: string): Promise<void> {
        try {
            const documentId = `memo_${userId}_${memoId}`;
            await vectorService.deleteDocument(documentId);
            console.log('✅ 사용자 메모 인덱스 삭제 완료:', documentId);
        } catch (error) {
            console.error('❌ 사용자 메모 인덱스 삭제 오류:', error);
            throw new Error(`메모 인덱스 삭제 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 사용자 계정 삭제 시 모든 메모 인덱스 삭제
     */
    async deleteAllUserMemos(userId: string): Promise<void> {
        try {
            await vectorService.deleteUserDocuments(userId);
            console.log('✅ 사용자 모든 메모 인덱스 삭제 완료:', userId);
        } catch (error) {
            console.error('❌ 사용자 메모 전체 삭제 오류:', error);
            throw new Error(`사용자 메모 전체 삭제 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 부동산 도메인 지식 인덱싱 (관리자 전용)
     */
    async indexDomainKnowledge(knowledgeData: {
        id: string;
        title: string;
        content: string;
        category: '투자전략' | '임장체크리스트' | '시장분석' | '법률정보' | '세무정보';
        source: string;
        createdAt: Date;
    }): Promise<void> {
        try {
            console.log('🔄 도메인 지식 인덱싱:', knowledgeData.id);

            const document: DocumentToIndex = {
                id: `knowledge_${knowledgeData.id}`,
                content: `${knowledgeData.title}\n\n${knowledgeData.content}`,
                metadata: {
                    source: knowledgeData.source,
                    type: 'domain_knowledge',
                    timestamp: knowledgeData.createdAt.toISOString()
                }
            };

            await vectorService.indexDocument(document);
            console.log('✅ 도메인 지식 인덱싱 완료:', knowledgeData.id);

        } catch (error) {
            console.error('❌ 도메인 지식 인덱싱 오류:', error);
            throw new Error(`도메인 지식 인덱싱 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 시장 데이터 인덱싱 (배치 작업용)
     */
    async indexMarketData(marketData: {
        id: string;
        region: string;
        dataType: '실거래가' | '전세가율' | '공급물량' | '정책변화';
        content: string;
        source: string;
        publishedAt: Date;
    }): Promise<void> {
        try {
            console.log('🔄 시장 데이터 인덱싱:', marketData.id);

            const document: DocumentToIndex = {
                id: `market_${marketData.id}`,
                content: `[${marketData.region}] ${marketData.dataType}: ${marketData.content}`,
                metadata: {
                    source: marketData.source,
                    type: 'market_data',
                    timestamp: marketData.publishedAt.toISOString()
                }
            };

            await vectorService.indexDocument(document);
            console.log('✅ 시장 데이터 인덱싱 완료:', marketData.id);

        } catch (error) {
            console.error('❌ 시장 데이터 인덱싱 오류:', error);
            throw new Error(`시장 데이터 인덱싱 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 아파트 정보 인덱싱 (부동산 기본 정보)
     */
    async indexApartmentInfo(apartmentData: {
        id: number;
        name: string;
        address: string;
        buildYear?: number;
        totalHouseholds?: number;
        parkingSpaces?: number;
        facilities?: string[];
        transportation?: string[];
    }): Promise<void> {
        try {
            console.log('🔄 아파트 정보 인덱싱:', apartmentData.id);

            const content = this.createApartmentSearchContent(apartmentData);

            const document: DocumentToIndex = {
                id: `apartment_${apartmentData.id}`,
                content,
                metadata: {
                    source: `아파트 정보: ${apartmentData.name}`,
                    type: 'apartment_data',
                    apartmentId: apartmentData.id.toString(),
                    timestamp: new Date().toISOString()
                }
            };

            await vectorService.indexDocument(document);
            console.log('✅ 아파트 정보 인덱싱 완료:', apartmentData.id);

        } catch (error) {
            console.error('❌ 아파트 정보 인덱싱 오류:', error);
            throw new Error(`아파트 정보 인덱싱 중 오류가 발생했습니다: ${error}`);
        }
    }

    /**
     * 메모 내용을 검색에 최적화된 형태로 구성
     */
    private createSearchableContent(memoData: {
        title: string;
        content: string;
        apartmentName?: string;
        location?: string;
    }): string {
        const parts: string[] = [];

        // 제목
        parts.push(`제목: ${memoData.title}`);

        // 아파트 정보
        if (memoData.apartmentName) {
            parts.push(`아파트: ${memoData.apartmentName}`);
        }

        if (memoData.location) {
            parts.push(`위치: ${memoData.location}`);
        }

        // 메모 내용
        parts.push(`내용: ${memoData.content}`);

        return parts.join('\n');
    }

    /**
     * 아파트 정보를 검색에 최적화된 형태로 구성
     */
    private createApartmentSearchContent(apartmentData: {
        name: string;
        address: string;
        buildYear?: number;
        totalHouseholds?: number;
        parkingSpaces?: number;
        facilities?: string[];
        transportation?: string[];
    }): string {
        const parts: string[] = [];

        parts.push(`아파트명: ${apartmentData.name}`);
        parts.push(`주소: ${apartmentData.address}`);

        if (apartmentData.buildYear) {
            parts.push(`준공연도: ${apartmentData.buildYear}년`);
        }

        if (apartmentData.totalHouseholds) {
            parts.push(`총 세대수: ${apartmentData.totalHouseholds}세대`);
        }

        if (apartmentData.parkingSpaces) {
            parts.push(`주차대수: ${apartmentData.parkingSpaces}대`);
        }

        if (apartmentData.facilities && apartmentData.facilities.length > 0) {
            parts.push(`편의시설: ${apartmentData.facilities.join(', ')}`);
        }

        if (apartmentData.transportation && apartmentData.transportation.length > 0) {
            parts.push(`교통정보: ${apartmentData.transportation.join(', ')}`);
        }

        return parts.join('\n');
    }
}

// 싱글톤 인스턴스 export
export const embeddingService = EmbeddingService.getInstance();