interface ConvertDongCodeParams {
  fromType: 'legal' | 'admin';
  fromCode: string;
  referenceDate?: string;
}

/**
 * 행정동↔법정동 코드 변환 함수
 */
export async function convertDongCode(args: ConvertDongCodeParams): Promise<any> {
  const { 
    fromType, 
    fromCode, 
    referenceDate = new Date().toISOString().split('T')[0] 
  } = args;

  try {
    console.log('🔄 동 코드 변환 요청:', { fromType, fromCode, referenceDate });

    if (!fromCode || fromCode.length !== 10) {
      return {
        success: false,
        error: '동 코드는 10자리여야 합니다. (예: 1168010100)'
      };
    }

    if (!['legal', 'admin'].includes(fromType)) {
      return {
        success: false,
        error: 'fromType은 "legal" 또는 "admin" 이어야 합니다.'
      };
    }

    // 현재는 간단한 매핑 로직 (실제로는 행안부 코드 DB 필요)
    const toType = fromType === 'legal' ? 'admin' : 'legal';
    const mockMapping = await getMockCodeMapping(fromCode, fromType, toType);

    if (!mockMapping) {
      return {
        success: false,
        error: `${fromType} 코드 ${fromCode}에 대응하는 ${toType} 코드를 찾을 수 없습니다.`,
        note: '일부 행정구역은 법정동과 행정동이 1:1 대응되지 않을 수 있습니다.'
      };
    }

    return {
      success: true,
      conversion: {
        from: {
          type: fromType,
          code: fromCode,
          name: mockMapping.fromName
        },
        to: {
          type: toType,
          code: mockMapping.toCode,
          name: mockMapping.toName
        }
      },
      metadata: {
        referenceDate,
        note: `${referenceDate} 기준 코드 매핑`,
        disclaimer: '행정구역 개편에 따라 코드가 변경될 수 있습니다.'
      },
      dataSchema: {
        legal: '법정동 = 「지방자치법」상 법정 행정구역',
        admin: '행정동 = 실제 행정업무를 담당하는 구역',
        note: '하나의 법정동이 여러 행정동으로 나뉘거나, 여러 법정동이 하나의 행정동으로 합쳐질 수 있음'
      }
    };

  } catch (error: any) {
    console.error('❌ convertDongCode 오류:', error);
    return {
      success: false,
      error: error.message || '동 코드 변환 중 오류가 발생했습니다.',
      suggestions: [
        '올바른 10자리 동 코드를 입력해보세요',
        'fromType을 "legal" 또는 "admin"으로 설정해보세요',
        '최신 행정구역 코드를 사용하고 있는지 확인해보세요'
      ]
    };
  }
}

/**
 * 임시 코드 매핑 함수 (실제로는 DB 테이블 필요)
 */
async function getMockCodeMapping(
  fromCode: string, 
  fromType: string, 
  toType: string
): Promise<{ fromName: string; toCode: string; toName: string } | null> {
  
  // 실제로는 행정안전부 행정코드 DB에서 조회해야 함
  const mockMappings: { [key: string]: any } = {
    '1168010100': {
      legal: { code: '1168010100', name: '서울특별시 강남구 역삼동' },
      admin: { code: '1168010200', name: '서울특별시 강남구 역삼1동' }
    },
    '1168010200': {
      admin: { code: '1168010200', name: '서울특별시 강남구 역삼1동' },
      legal: { code: '1168010100', name: '서울특별시 강남구 역삼동' }
    }
  };

  const mapping = mockMappings[fromCode];
  if (!mapping) return null;

  const fromInfo = mapping[fromType];
  const toInfo = mapping[toType];

  if (!fromInfo || !toInfo) return null;

  return {
    fromName: fromInfo.name,
    toCode: toInfo.code,
    toName: toInfo.name
  };
}