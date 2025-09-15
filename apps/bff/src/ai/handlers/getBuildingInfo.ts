import { orchestrateSelect } from './utils/sqlOrchestrator';

interface GetBuildingInfoParams {
  aptId?: number;
  apartmentName?: string;
  region?: string; // 지역 정보도 받을 수 있음
}

/**
 * 특정 아파트의 건물 정보를 조회합니다.
 */
export async function getBuildingInfo(args: GetBuildingInfoParams): Promise<any> {
  const { aptId, apartmentName, region } = args;
  
  if (!aptId && !apartmentName) {
    return {
      success: false,
      error: '아파트 ID 또는 아파트명이 필요합니다.',
      dataSchema: {
        type: '건물 유형 (recap: 요약, title: 등기원부)',
        dongnm: '동명',
        bldnm: '건물명',
        platarea: '대지면적',
        archarea: '건축면적',
        grndflrcnt: '지상층수',
        hhldcnt: '세대수',
        note: '아파트 단지의 건물 상세 정보'
      }
    };
  }

  try {
    console.log('🏢 건물 정보 조회 (RAG 오케스트레이션):', { aptId, apartmentName });

    // aptId가 있으면 ID 기준, 없으면 아파트명 기준으로 질문 생성
    let question: string;
    if (aptId) {
      question = [
        `아파트 ID ${aptId}의 건물 정보를 상세히 조회해줘.`,
        `건물 유형(type), 동명, 건물명, 대지면적, 건축면적, 지상층수, 세대수, 건물 구조 등 모든 정보를 포함해.`,
        `건물 유형에 따라 정렬하고, recap 유형과 title 유형을 구분해서 반환해.`,
        `스키마/컬럼은 RAG 문서에 맞춰 자동 선택.`,
      ].join(' ');
    } else {
      question = [
        `"${apartmentName}" 아파트의 건물 정보를 상세히 조회해줘.`,
        region ? `지역은 ${region}이야.` : '',
        `먼저 apt_info 테이블에서 해당 아파트의 ID를 찾고, 그 ID로 apt_building_info 테이블에서 건물 정보를 조회해.`,
        `건물 유형(type), 동명, 건물명, 대지면적, 건축면적, 지상층수, 세대수, 건물 구조 등 모든 정보를 포함해.`,
        `건물 유형에 따라 정렬하고, recap 유형과 title 유형을 구분해서 반환해.`,
      ].filter(Boolean).join(' ');
    }

    const hints: string[] = [
      'oi.apt_building_info(apt_id, type, dongnm, bldnm, platplc, platarea, archarea, totarea, grndflrcnt, ugrndflrcnt, mainpurpscdnm, strctcdnm, roofcdnm, hhldcnt, mainbldcnt, atchbldcnt, totpkngcnt, useaprday, ...)',
      'oi.apt_info(id, apt_nm, jibun_address, lat, lon, ...)', // 아파트명으로 검색할 때 필요
    ];
    if (apartmentName) {
      hints.push(`apartment name (hint): ${apartmentName}`);
    }
    if (region) {
      hints.push(`region (hint): ${region}`);
    }

    const { success, sql, rows, rowCount, error } = await orchestrateSelect({
      question,
      forceSchemaHints: hints,
      requireColumns: ['type', 'dongnm'],
      safety: { maxRows: 100, readOnly: true },
    });

    if (!success) {
      return {
        success: false,
        error: error || '건물 정보 조회에 실패했습니다.',
        dataSchema: {
          type: '건물 유형 (recap: 요약, title: 등기원부)',
          dongnm: '동명',
          bldnm: '건물명',
          platarea: '대지면적',
          archarea: '건축면적',
          grndflrcnt: '지상층수',
          hhldcnt: '세대수',
          note: '아파트 단지의 건물 상세 정보'
        }
      };
    }

    if (!rows || rows.length === 0) {
      return {
        success: true,
        message: '해당 아파트의 건물 정보를 찾을 수 없습니다.',
        searchConditions: { aptId },
        recapInfo: null,
        titleInfos: [],
        totalCount: 0,
        sql, // 디버깅용
        dataSchema: {
          type: '건물 유형 (recap: 요약, title: 등기원부)',
          dongnm: '동명',
          bldnm: '건물명',
          platarea: '대지면적',
          archarea: '건축면적',
          grndflrcnt: '지상층수',
          hhldcnt: '세대수',
          note: '아파트 단지의 건물 상세 정보'
        }
      };
    }

    // 결과 포맷팅 및 분류
    const recapInfo = rows.find((info: any) => info.type === 'recap') || null;
    const titleInfos = rows.filter((info: any) => info.type === 'title');

    // 결과 표준화
    const formattedRows = rows.map((info: any) => ({
      id: info.id,
      type: info.type,
      dongnm: info.dongnm,
      bldnm: info.bldnm,
      platplc: info.platplc, // 대지위치
      platarea: info.platarea, // 대지면적
      archarea: info.archarea, // 건축면적
      totarea: info.totarea, // 전체면적
      grndflrcnt: info.grndflrcnt, // 지상층수
      ugrndflrcnt: info.ugrndflrcnt, // 지하층수
      mainpurpscdnm: info.mainpurpscdnm, // 주용도
      strctcdnm: info.strctcdnm, // 구조
      roofcdnm: info.roofcdnm, // 지붕
      hhldcnt: info.hhldcnt, // 세대수
      mainbldcnt: info.mainbldcnt, // 주건물수
      atchbldcnt: info.atchbldcnt, // 부속건물수
      totpkngcnt: info.totpkngcnt, // 주차수
      useaprday: info.useaprday, // 사용승인일
      created_at: info.created_at,
      // 원본 데이터 보존
      _raw: info
    }));

    return {
      success: true,
      searchConditions: { aptId },
      recapInfo,
      titleInfos,
      buildings: formattedRows, // 전체 건물 데이터
      totalCount: formattedRows.length,
      sql, // 생성된 SQL 쿼리 (디버깅용)
      dataSchema: {
        type: '건물 유형 (recap: 요약, title: 등기원부)',
        dongnm: '동명',
        bldnm: '건물명',
        platarea: '대지면적',
        archarea: '건축면적',
        grndflrcnt: '지상층수',
        hhldcnt: '세대수',
        note: 'AI가 자연어로 생성한 건물 정보 결과'
      }
    };

  } catch (error: any) {
    console.error('❌ getBuildingInfo 오케스트레이션 오류:', error);
    return {
      success: false,
      error: error.message || '건물 정보 조회 중 오류가 발생했습니다.'
    };
  }
}