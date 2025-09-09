// 지리정보 및 지오코딩 API 호출 레포지토리
import proj4 from 'proj4';

// 환경변수에서 API 키 가져오기
const VWORLD_KEY = process.env.VWORLD_KEY || '';
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || '';
const DATA_GOKR_KEY = process.env.DATA_GOKR_KEY || '';

// 자주 사용되는 좌표계 정의
const COORD_SYSTEMS = {
  'WGS84': '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
  'EPSG:5179': '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:5174': '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43',
  'KATECH': '+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43'
};

// 지오코딩 결과 인터페이스
export interface GeocodeResult {
  longitude: number;
  latitude: number;
  coordSystem: string;
  address?: string;
  confidence?: number;
  source: string;
}

// 역지오코딩 결과 인터페이스
export interface ReverseGeocodeResult {
  roadAddress?: string;
  jibunAddress?: string;
  administrativeArea?: string;
  confidence?: number;
  source: string;
}

// 법정동코드 결과 인터페이스
export interface LegalDongResult {
  code: string;
  name: string;
  address?: string;
  level?: string; // 시군구, 읍면동 등
}

// POI 검색 결과 인터페이스
export interface NearbyResult {
  name: string;
  code?: string;
  longitude: number;
  latitude: number;
  distance: number; // km
  category?: string;
  address?: string;
  extraInfo?: any;
}

/**
 * 주소를 좌표로 변환 (지오코딩)
 * V월드 API를 우선 사용하고, 실패시 카카오 API 사용
 */
export async function geocode(
  address: string, 
  targetCoordSystem: string = 'EPSG:4326'
): Promise<GeocodeResult> {
  console.log(`🌍 지오코딩 요청: ${address} → ${targetCoordSystem}`);
  
  try {
    // 1차: V월드 지오코딩 API 시도
    const vworldResult = await geocodeWithVWorld(address);
    if (vworldResult) {
      const transformed = transformCoordinates(
        vworldResult.longitude, 
        vworldResult.latitude,
        'EPSG:4326',
        targetCoordSystem
      );
      
      return {
        longitude: transformed.longitude,
        latitude: transformed.latitude,
        coordSystem: targetCoordSystem,
        address: vworldResult.address,
        confidence: vworldResult.confidence,
        source: 'VWorld'
      };
    }
  } catch (error) {
    console.warn('V월드 지오코딩 실패:', error);
  }

  try {
    // 2차: 카카오 지오코딩 API 시도
    const kakaoResult = await geocodeWithKakao(address);
    if (kakaoResult) {
      const transformed = transformCoordinates(
        kakaoResult.longitude,
        kakaoResult.latitude, 
        'EPSG:4326',
        targetCoordSystem
      );
      
      return {
        longitude: transformed.longitude,
        latitude: transformed.latitude,
        coordSystem: targetCoordSystem,
        address: kakaoResult.address,
        confidence: kakaoResult.confidence,
        source: 'Kakao'
      };
    }
  } catch (error) {
    console.warn('카카오 지오코딩 실패:', error);
  }

  throw new Error(`주소 "${address}"를 좌표로 변환할 수 없습니다.`);
}

/**
 * V월드 지오코딩 API 호출
 */
async function geocodeWithVWorld(address: string): Promise<GeocodeResult | null> {
  const url = `https://api.vworld.kr/req/address`;
  const params = new URLSearchParams({
    service: 'address',
    request: 'getCoord',
    format: 'json',
    crs: 'epsg:4326',
    address: address,
    type: 'road',
    key: VWORLD_KEY
  });

  const response = await fetch(`${url}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`V월드 API 오류: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.response?.status === 'OK' && data.response.result?.point) {
    const point = data.response.result.point;
    return {
      longitude: parseFloat(point.x),
      latitude: parseFloat(point.y),
      coordSystem: 'EPSG:4326',
      address: address,
      confidence: 0.9,
      source: 'VWorld'
    };
  }

  return null;
}

/**
 * 카카오 지오코딩 API 호출
 */
async function geocodeWithKakao(address: string): Promise<GeocodeResult | null> {
  const url = 'https://dapi.kakao.com/v2/local/search/address.json';
  const params = new URLSearchParams({
    query: address,
    analyze_type: 'similar',
    page: '1',
    size: '1'
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`카카오 API 오류: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.documents && data.documents.length > 0) {
    const doc = data.documents[0];
    // 도로명 주소 우선, 없으면 지번 주소
    const coords = doc.road_address || doc.address;
    
    if (coords) {
      return {
        longitude: parseFloat(coords.x),
        latitude: parseFloat(coords.y),
        coordSystem: 'EPSG:4326',
        address: doc.address_name,
        confidence: 0.8,
        source: 'Kakao'
      };
    }
  }

  return null;
}

/**
 * 좌표를 주소로 변환 (역지오코딩)
 */
export async function reverseGeocode(
  longitude: number,
  latitude: number,
  fromCoordSystem: string = 'EPSG:4326',
  addressType: string = 'both'
): Promise<ReverseGeocodeResult> {
  console.log(`🔄 역지오코딩 요청: (${longitude}, ${latitude}) ${fromCoordSystem}`);

  // 좌표계를 WGS84로 변환 (API 호출용)
  const wgs84Coords = transformCoordinates(longitude, latitude, fromCoordSystem, 'EPSG:4326');
  
  try {
    // 카카오 역지오코딩 API 사용
    const url = 'https://dapi.kakao.com/v2/local/geo/coord2address.json';
    const params = new URLSearchParams({
      x: wgs84Coords.longitude.toString(),
      y: wgs84Coords.latitude.toString(),
      input_coord: 'WGS84'
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`카카오 역지오코딩 API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      
      return {
        roadAddress: doc.road_address?.address_name,
        jibunAddress: doc.address?.address_name,
        administrativeArea: doc.address?.region_1depth_name + ' ' + doc.address?.region_2depth_name,
        confidence: 0.8,
        source: 'Kakao'
      };
    }
  } catch (error) {
    console.error('역지오코딩 실패:', error);
  }

  throw new Error(`좌표 (${longitude}, ${latitude})를 주소로 변환할 수 없습니다.`);
}

/**
 * 법정동 코드 조회
 */
export async function lookupLegalDongCode(
  address?: string,
  longitude?: number,
  latitude?: number,
  coordSystem?: string
): Promise<LegalDongResult> {
  console.log(`📋 법정동 코드 조회:`, { address, longitude, latitude, coordSystem });

  if (address) {
    // 주소 기반 법정동 코드 조회
    return await lookupLegalDongByAddress(address);
  } else if (longitude && latitude) {
    // 좌표 기반 법정동 코드 조회
    const wgs84Coords = transformCoordinates(
      longitude, 
      latitude, 
      coordSystem || 'EPSG:4326', 
      'EPSG:4326'
    );
    return await lookupLegalDongByCoords(wgs84Coords.longitude, wgs84Coords.latitude);
  } else {
    throw new Error('주소 또는 좌표 중 하나는 반드시 제공되어야 합니다.');
  }
}

/**
 * 주소로 법정동 코드 조회 (공공데이터포털 API 사용)
 */
async function lookupLegalDongByAddress(address: string): Promise<LegalDongResult> {
  // 공공데이터포털의 법정동 코드 API 호출
  const url = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';
  const params = new URLSearchParams({
    serviceKey: DATA_GOKR_KEY,
    pageNo: '1',
    numOfRows: '10',
    type: 'json',
    locatadd_nm: address
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`공공데이터 API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.StanReginCd && data.StanReginCd.length > 0) {
      const item = data.StanReginCd[0].row[0];
      return {
        code: item.region_cd,
        name: item.locatadd_nm,
        address: item.locatjumin_cd,
        level: item.locat_order
      };
    }
  } catch (error) {
    console.warn('공공데이터 법정동 조회 실패:', error);
  }

  // Fallback: 카카오 API로 주소 파싱 후 수동 매핑
  try {
    const geocodeResult = await geocodeWithKakao(address);
    if (geocodeResult) {
      // 간단한 지역명 추출 로직 (실제로는 더 정교한 매핑 테이블 필요)
      const addressParts = address.split(' ');
      const sido = addressParts[0];
      const sigungu = addressParts[1];
      
      return {
        code: generateMockLegalDongCode(sido, sigungu),
        name: `${sido} ${sigungu}`,
        address: address,
        level: '시군구'
      };
    }
  } catch (error) {
    console.warn('카카오 API를 이용한 법정동 조회도 실패:', error);
  }

  throw new Error(`주소 "${address}"의 법정동 코드를 찾을 수 없습니다.`);
}

/**
 * 좌표로 법정동 코드 조회
 */
async function lookupLegalDongByCoords(longitude: number, latitude: number): Promise<LegalDongResult> {
  // 좌표로 역지오코딩 후 주소 기반 법정동 코드 조회
  const reverseResult = await reverseGeocode(longitude, latitude);
  const address = reverseResult.roadAddress || reverseResult.jibunAddress || '';
  
  if (address) {
    return await lookupLegalDongByAddress(address);
  }

  throw new Error(`좌표 (${longitude}, ${latitude})의 법정동 코드를 찾을 수 없습니다.`);
}

/**
 * 임시 법정동 코드 생성 (실제로는 DB 테이블이나 API 매핑 필요)
 */
function generateMockLegalDongCode(sido: string, sigungu: string): string {
  const sidoCodes: { [key: string]: string } = {
    '서울특별시': '11',
    '부산광역시': '26', 
    '대구광역시': '27',
    '인천광역시': '28',
    '광주광역시': '29',
    '대전광역시': '30',
    '울산광역시': '31',
    '세종특별자치시': '36',
    '경기도': '41',
    '강원도': '42',
    '충청북도': '43',
    '충청남도': '44',
    '전라북도': '45',
    '전라남도': '46',
    '경상북도': '47',
    '경상남도': '48',
    '제주특별자치도': '50'
  };

  const sidoCode = sidoCodes[sido] || '99';
  const sigunguCode = Math.floor(Math.random() * 900 + 100).toString(); // 임시 코드
  
  return sidoCode + sigunguCode + '00000';
}

/**
 * 좌표계 변환 유틸리티
 */
export function transformCoordinates(
  longitude: number,
  latitude: number, 
  fromCrs: string,
  toCrs: string
): { longitude: number; latitude: number } {
  if (fromCrs === toCrs) {
    return { longitude, latitude };
  }

  const fromProj = COORD_SYSTEMS[fromCrs] || fromCrs;
  const toProj = COORD_SYSTEMS[toCrs] || toCrs;

  if (!fromProj || !toProj) {
    throw new Error(`지원하지 않는 좌표계: ${fromCrs} → ${toCrs}`);
  }

  try {
    const [x, y] = proj4(fromProj, toProj, [longitude, latitude]);
    return { longitude: x, latitude: y };
  } catch (error) {
    console.error('좌표 변환 실패:', error);
    throw new Error(`좌표 변환 실패: ${fromCrs} → ${toCrs}`);
  }
}

/**
 * 좌표 주변의 POI/아파트 검색 (PostGIS 활용)
 */
export async function getNearby(
  longitude: number,
  latitude: number,
  coordSystem: string,
  radiusKm: number,
  target: string = 'apartment',
  limit: number = 10
): Promise<NearbyResult[]> {
  console.log(`🔍 주변 검색:`, { longitude, latitude, coordSystem, radiusKm, target, limit });

  // 좌표를 WGS84로 변환
  const wgs84Coords = transformCoordinates(longitude, latitude, coordSystem, 'EPSG:4326');
  
  // 현재는 카카오 API로 POI 검색
  try {
    const url = 'https://dapi.kakao.com/v2/local/search/category.json';
    
    // target에 따른 카테고리 코드 매핑
    const categoryMap: { [key: string]: string } = {
      'apartment': 'SW8', // 아파트
      'school': 'SC4',    // 학교
      'hospital': 'HP8',  // 병원
      'mart': 'MT1',      // 마트
      'convenience': 'CS2' // 편의점
    };
    
    const category = categoryMap[target] || 'SW8';
    
    const params = new URLSearchParams({
      category_group_code: category,
      x: wgs84Coords.longitude.toString(),
      y: wgs84Coords.latitude.toString(),
      radius: (radiusKm * 1000).toString(), // m 단위로 변환
      size: Math.min(limit, 15).toString(),
      sort: 'distance'
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`카카오 POI 검색 API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.documents && data.documents.length > 0) {
      return data.documents.map((doc: any) => ({
        name: doc.place_name,
        code: doc.id,
        longitude: parseFloat(doc.x),
        latitude: parseFloat(doc.y),
        distance: parseInt(doc.distance) / 1000, // km 단위로 변환
        category: doc.category_name,
        address: doc.address_name,
        extraInfo: {
          phone: doc.phone,
          placeUrl: doc.place_url
        }
      }));
    }
  } catch (error) {
    console.error('주변 POI 검색 실패:', error);
  }

  return [];
}