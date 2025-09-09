/**
 * OpenAPI 3.0 문서 생성기 - AI Tools용 자동 문서화
 */

import { tools } from '../ai/tools';
import { ToolSchema } from '../ai/tools/types';

// OpenAPI 3.0 기본 구조
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

/**
 * JSON Schema를 OpenAPI 3.0 스키마로 변환
 */
function convertJsonSchemaToOpenAPI(jsonSchema: any): any {
  const openApiSchema = { ...jsonSchema };
  
  // additionalProperties와 strict 제거 (OpenAPI에서 사용하지 않음)
  delete openApiSchema.additionalProperties;
  delete openApiSchema.strict;
  
  // properties 재귀적으로 처리
  if (openApiSchema.properties) {
    const convertedProperties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(openApiSchema.properties)) {
      convertedProperties[key] = convertJsonSchemaToOpenAPI(value);
    }
    
    openApiSchema.properties = convertedProperties;
  }
  
  return openApiSchema;
}

/**
 * AI Tool 스키마를 OpenAPI Path 객체로 변환
 */
function createPathFromTool(tool: ToolSchema): any {
  const requestBodySchema = convertJsonSchemaToOpenAPI(tool.parameters);
  
  return {
    post: {
      tags: ['AI Tools'],
      summary: tool.description,
      description: `${tool.description}\n\n**함수명:** \`${tool.name}\``,
      operationId: tool.name,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: requestBodySchema,
            examples: {
              default: {
                summary: '기본 예제',
                value: generateExampleFromSchema(requestBodySchema)
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: '성공 응답',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  function: {
                    type: 'string',
                    example: tool.name
                  },
                  result: {
                    type: 'object',
                    description: '함수별 결과 데이터'
                  },
                  requestId: {
                    type: 'string',
                    example: 'req_1234567890_abcdef'
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-09-09T12:00:00.000Z'
                  }
                }
              },
              examples: {
                success: {
                  summary: '성공 응답 예제',
                  value: {
                    success: true,
                    function: tool.name,
                    result: generateExampleResult(tool.name),
                    requestId: 'req_1234567890_abcdef',
                    timestamp: '2024-09-09T12:00:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': {
          description: '잘못된 요청 (파라미터 검증 실패)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: '파라미터 검증 실패'
                  },
                  validationDetails: {
                    type: 'array',
                    items: {
                      type: 'string'
                    },
                    example: ['/apartmentName: 필수 필드입니다']
                  },
                  requestId: {
                    type: 'string',
                    example: 'req_1234567890_abcdef'
                  }
                }
              }
            }
          }
        },
        '404': {
          description: '알 수 없는 함수',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: '알 수 없는 함수입니다: invalidFunction'
                  },
                  availableFunctions: {
                    type: 'array',
                    items: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        },
        '429': {
          description: '레이트 리밋 초과',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
                  },
                  retryAfter: {
                    type: 'number',
                    example: 60
                  }
                }
              }
            }
          }
        },
        '500': {
          description: '서버 내부 오류',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  error: {
                    type: 'string',
                    example: 'AI 함수 실행 중 오류가 발생했습니다.'
                  },
                  requestId: {
                    type: 'string',
                    example: 'req_1234567890_abcdef'
                  }
                }
              }
            }
          }
        }
      },
      security: [],  // 레이트 리밋만 적용, 인증 불필요
    }
  };
}

/**
 * 스키마에서 예제 데이터 생성
 */
function generateExampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const example: any = {};
  
  if (schema.properties) {
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      if (prop.example !== undefined) {
        example[key] = prop.example;
      } else if (prop.enum && prop.enum.length > 0) {
        example[key] = prop.enum[0];
      } else if (prop.type === 'string') {
        example[key] = prop.description ? `예시 ${prop.description}` : `예시 ${key}`;
      } else if (prop.type === 'number') {
        example[key] = 123;
      } else if (prop.type === 'boolean') {
        example[key] = true;
      } else if (prop.type === 'array') {
        example[key] = [];
      } else if (prop.type === 'object') {
        example[key] = generateExampleFromSchema(prop);
      }
    }
  }

  return example;
}

/**
 * 함수별 예제 결과 생성
 */
function generateExampleResult(functionName: string): any {
  // 함수별 맞춤 예제 결과
  const examples: Record<string, any> = {
    'searchRealEstateDeals': {
      deals: [
        {
          aptName: '래미안강남힐스',
          dealAmount: 180000,
          dealType: '매매',
          area: 84.5,
          floor: 12,
          dealDate: '2024-08-15'
        }
      ],
      totalCount: 1
    },
    'geocodeAddress': {
      coordinates: {
        latitude: 37.4979,
        longitude: 127.0276
      },
      confidence: 0.9,
      source: 'VWorld'
    },
    'getPriceTrends': {
      trends: [
        {
          period: '2024-08',
          avgPrice: 175000,
          changeRate: 2.5
        }
      ],
      summary: '전월 대비 2.5% 상승'
    }
  };

  return examples[functionName] || {
    message: `${functionName} 함수의 결과 데이터`,
    data: {}
  };
}

/**
 * 전체 OpenAPI 문서 생성
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, any> = {};

  // 각 AI Tool에 대한 path 생성
  for (const tool of tools) {
    const path = `/api/ai/tools/${tool.function.name}`;
    paths[path] = createPathFromTool(tool.function);
  }

  // 모니터링 API 추가
  paths['/api/ai/health'] = {
    get: {
      tags: ['Monitoring'],
      summary: '시스템 헬스 체크',
      responses: {
        '200': {
          description: '시스템 상태 정보',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  status: { type: 'string', example: 'healthy' },
                  uptime: { type: 'string', example: '2.5h' },
                  memory: { type: 'string', example: '128MB' },
                  activeRequests: { type: 'number', example: 5 },
                  totalRequests: { type: 'number', example: 1234 },
                  cacheHitRate: { type: 'string', example: '85.2%' }
                }
              }
            }
          }
        }
      }
    }
  };

  paths['/api/ai/metrics/system'] = {
    get: {
      tags: ['Monitoring'],
      summary: '시스템 메트릭 조회',
      responses: {
        '200': {
          description: '시스템 메트릭 데이터'
        }
      }
    }
  };

  paths['/api/ai/cache/stats'] = {
    get: {
      tags: ['Cache Management'],
      summary: '캐시 통계 조회',
      responses: {
        '200': {
          description: '캐시 히트율 및 통계 정보'
        }
      }
    }
  };

  return {
    openapi: '3.0.0',
    info: {
      title: 'OpenImjang AI Tools API',
      version: '1.0.0',
      description: `
# OpenImjang AI Tools API

AI 기반 부동산 분석 도구를 위한 RESTful API입니다.

## 주요 기능
- **🏠 부동산 함수군 (12개)**: 실거래 검색, 가격 동향, 통계 분석 등
- **🗺️ 지리정보 함수군 (8개)**: 지오코딩, 좌표 변환, 법정동 조회 등  
- **⚡ 성능 최적화**: 캐시, 레이트 리밋, 모니터링 시스템
- **📊 실시간 분석**: PostGIS 기반 공간 쿼리 및 외부 API 통합

## 인증
현재 모든 API는 인증 없이 사용 가능하며, IP 기반 레이트 리밋이 적용됩니다.

## 레이트 리밋  
- **기본**: 30 요청/분 (IP 기준)
- **함수별 차등**: 고비용 함수 10회/분, 저비용 함수 50회/분
- **개발환경**: 1000 요청/분

## 캐시 정책
- **지리정보**: 24시간 캐시
- **가격 정보**: 1시간 캐시  
- **검색 결과**: 5분 캐시
      `.trim(),
      contact: {
        name: 'OpenImjang Team',
        url: 'https://github.com/katnon/openimjang'
      }
    },
    servers: [
      {
        url: 'http://localhost:8787',
        description: '개발 서버'
      },
      {
        url: 'https://api.openimjang.com',
        description: '프로덕션 서버'
      }
    ],
    paths,
    components: {
      schemas: {
        // 공통 응답 스키마
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            function: {
              type: 'string',
              description: '호출된 함수명'
            },
            result: {
              type: 'object',
              description: '함수별 결과 데이터'
            },
            requestId: {
              type: 'string',
              description: '요청 추적 ID'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '응답 생성 시간'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: '에러 메시지'
            },
            requestId: {
              type: 'string',
              description: '요청 추적 ID'
            }
          }
        }
      }
    }
  };
}

/**
 * OpenAPI JSON 응답 생성
 */
export function getOpenAPIJson() {
  return generateOpenAPISpec();
}