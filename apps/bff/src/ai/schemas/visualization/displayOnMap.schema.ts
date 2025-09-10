// 지도 시각화 함수 스키마
export const displayOnMapSchema = {
  name: "displayOnMap",
  description: "부동산 분석 결과를 지도에 마커로 시각화하여 표시합니다. 아파트 위치와 함께 가격, 통계 등의 분석 데이터를 지도상에 표시합니다.",
  parameters: {
    type: "object", 
    properties: {
      location: {
        type: "string",
        description: "표시할 아파트명 또는 주소"
      },
      coordinates: {
        type: "object",
        properties: {
          lat: {
            type: "number",
            description: "위도 (latitude)"
          },
          lon: {
            type: "number", 
            description: "경도 (longitude)"
          }
        },
        required: ["lat", "lon"],
        additionalProperties: false,
        description: "지도상 표시할 좌표"
      },
      analysisData: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "마커에 표시할 제목 (예: '평균 매매가')"
          },
          value: {
            type: "string", 
            description: "분석 결과 값 (예: '5.34억원', '평균 85㎡')"
          },
          description: {
            type: "string",
            description: "추가 설명 (선택사항)"
          }
        },
        required: ["title", "value"],
        additionalProperties: false,
        description: "지도에 표시할 분석 결과 데이터"
      }
    },
    required: ["location", "coordinates", "analysisData"],
    additionalProperties: false
  }
};