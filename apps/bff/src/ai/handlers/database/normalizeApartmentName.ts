import { db } from '../../../lib/db';
import levenshtein from 'js-levenshtein';

export interface NormalizedApt {
  aptId: number;
  aptName: string;
  score: number; // 유사도 점수 (낮을수록 유사)
  region?: string; // 지역 정보
  fullAddress?: string; // 전체 주소
}

/**
 * 사용자 입력 아파트명 + 지역명을 fuzzy 매칭해서 apt_info의 aptId 반환
 * @param inputName 사용자 입력 (예: "신당 현대아파트", "현대아파트", "래미안")
 * @param region 지역 키워드 (선택, 예: "중구", "신당동", "강남구")
 * @returns 유사도 순으로 정렬된 후보 목록 (최대 5개)
 */
export async function normalizeApartmentName(
  inputName: string,
  region?: string
): Promise<NormalizedApt[] | null> {
  if (!inputName?.trim()) return null;

  console.log('🔍 아파트명 정규화 시작:', { inputName, region });

  try {
    let candidates: any[] = [];

    // 1️⃣ 지역 힌트가 있는 경우 지역 기반 검색
    if (region && region.trim()) {
      console.log('📍 지역 기반 검색:', region);
      
      candidates = await db
        .selectFrom('oi.apt_info as apt')
        .select(['id', 'apt_nm', 'jibun_address'])
        .where((eb) => eb.and([
          eb('apt_nm', 'ilike', `%${inputName}%`),
          eb('jibun_address', 'ilike', `%${region}%`)
        ]))
        .limit(20)
        .execute();

      console.log('📍 지역 기반 검색 결과:', candidates.length + '개');
    }

    // 2️⃣ 지역 기반 검색 실패 또는 지역 정보 없음 → 전체에서 부분 일치 검색
    if (candidates.length === 0) {
      console.log('🔍 전체 범위 부분 일치 검색');
      
      candidates = await db
        .selectFrom('oi.apt_info as apt')
        .select(['id', 'apt_nm', 'jibun_address'])
        .where('apt_nm', 'ilike', `%${inputName}%`)
        .limit(50)
        .execute();

      console.log('🔍 전체 검색 결과:', candidates.length + '개');
    }

    if (candidates.length === 0) {
      console.log('❌ 후보 없음');
      return null;
    }

    // 3️⃣ Levenshtein 거리 기반 유사도 계산
    const scored = candidates.map((c) => {
      // 입력된 이름을 정리 (공백, 특수문자 제거)
      const cleanInput = cleanApartmentName(inputName);
      const cleanCandidate = cleanApartmentName(c.apt_nm);
      
      // Levenshtein 거리 계산
      const distance = levenshtein(cleanInput, cleanCandidate);
      
      // 길이 차이도 고려한 정규화 점수
      const maxLength = Math.max(cleanInput.length, cleanCandidate.length);
      const normalizedScore = distance / maxLength;

      // 주소에서 지역 정보 추출 (간단하게)
      const addressParts = (c.jibun_address || '').split(' ');
      const regionInfo = addressParts.slice(0, 3).join(' '); // 시도 + 시군구 + 읍면동

      return {
        aptId: c.id,
        aptName: c.apt_nm,
        score: normalizedScore,
        region: regionInfo.trim(),
        fullAddress: c.jibun_address
      };
    });

    // 4️⃣ 유사도 높은 순 정렬 (점수가 낮을수록 유사)
    scored.sort((a, b) => a.score - b.score);

    // 5️⃣ 상위 5개만 반환
    const topResults = scored.slice(0, 5);
    
    console.log('✅ 정규화 결과:', topResults.map(r => ({
      aptId: r.aptId,
      aptName: r.aptName,
      score: r.score.toFixed(3),
      region: r.region
    })));

    return topResults;

  } catch (error: any) {
    console.error('❌ normalizeApartmentName 오류:', error);
    return null;
  }
}

/**
 * 아파트명 정리 함수 (공백, 특수문자 제거)
 */
function cleanApartmentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_\.]/g, '') // 공백, 하이픈, 언더스코어, 점 제거
    .replace(/아파트|아파트단지|단지/g, '') // '아파트' 키워드 제거
    .replace(/[동]/g, '') // '동' 제거
    .trim();
}

/**
 * 최적 매치 1개만 반환하는 헬퍼 함수
 */
export async function findBestApartmentMatch(
  inputName: string,
  region?: string,
  threshold: number = 0.3 // 유사도 임계값 (0.3 이하만 유효한 매치로 인정)
): Promise<NormalizedApt | null> {
  const results = await normalizeApartmentName(inputName, region);
  
  if (!results || results.length === 0) return null;
  
  const best = results[0];
  
  // 유사도가 임계값보다 나쁘면 매치 실패
  if (best.score > threshold) {
    console.log('⚠️ 유사도 부족:', { score: best.score, threshold });
    return null;
  }
  
  return best;
}

/**
 * 후보들을 분석해서 스마트한 질문을 생성
 */
export function generateSmartQuestion(candidates: NormalizedApt[], originalInput: string): string {
  if (candidates.length === 0) return '검색 결과가 없습니다.';
  
  if (candidates.length === 1) {
    return `"${candidates[0].aptName}" (${candidates[0].region})으로 검색하겠습니다.`;
  }

  // 1️⃣ 같은 아파트명의 여러 지역 케이스
  const regions = [...new Set(candidates.map(c => extractMainRegion(c.region)))];
  const apartmentNames = [...new Set(candidates.map(c => extractBaseName(c.aptName)))];
  
  if (apartmentNames.length === 1 && regions.length > 1) {
    // "현대아파트"가 여러 지역에 있는 경우
    const regionChoices = regions
      .map((region, idx) => `(${idx + 1}) ${region}`)
      .join('\n');
    
    return `"${apartmentNames[0]}"이(가) 여러 지역에 있습니다. 어느 지역의 ${apartmentNames[0]}을(를) 찾으시나요?\n\n${regionChoices}`;
  }

  // 2️⃣ 같은 아파트의 여러 단지 케이스  
  if (apartmentNames.length === 1 && regions.length === 1) {
    const complexNumbers = candidates
      .map(c => extractComplexNumber(c.aptName))
      .filter(num => num !== null);
    
    if (complexNumbers.length > 1) {
      const complexChoices = candidates
        .map((c, idx) => `(${idx + 1}) ${c.aptName}`)
        .join('\n');
      
      return `"${apartmentNames[0]}"의 여러 단지가 있습니다. 몇 단지를 찾으시나요?\n\n${complexChoices}`;
    }
  }

  // 3️⃣ 일반적인 여러 후보 케이스 (기존 방식)
  const choiceText = candidates
    .map((c, idx) => `(${idx + 1}) ${c.aptName} (${c.region})`)
    .join('\n');
    
  return `여러 아파트가 검색되었습니다. 어떤 아파트를 원하시나요?\n\n${choiceText}`;
}

/**
 * 주소에서 주요 지역명 추출 (시/구 단위)
 */
function extractMainRegion(fullAddress: string): string {
  const parts = fullAddress.split(' ');
  // "서울특별시 중구 신당동" -> "중구"
  // "서울특별시 강서구 마곡동" -> "강서구"
  if (parts.length >= 2 && parts[1].includes('구')) {
    return parts[1];
  }
  // "경기도 성남시 분당구" -> "성남시"
  if (parts.length >= 2 && parts[1].includes('시')) {
    return parts[1];
  }
  return parts.slice(0, 2).join(' ');
}

/**
 * 아파트명에서 기본 이름 추출 (단지 번호 제거)
 */
function extractBaseName(aptName: string): string {
  // "마곡엠밸리6단지" -> "마곡엠밸리"
  // "현대아파트1단지" -> "현대아파트"
  return aptName
    .replace(/\d+단지$/g, '')
    .replace(/\d+차$/g, '')
    .replace(/\([^)]*\)$/g, '') // 괄호 내용 제거
    .trim();
}

/**
 * 아파트명에서 단지/차수 번호 추출
 */
function extractComplexNumber(aptName: string): number | null {
  // "마곡엠밸리6단지" -> 6
  // "현대아파트1단지" -> 1
  // "래미안2차" -> 2
  const match = aptName.match(/(\d+)(?:단지|차)$/);
  return match ? parseInt(match[1]) : null;
}

/**
 * 기존 formatApartmentChoices는 하위 호환성을 위해 유지
 */
export function formatApartmentChoices(candidates: NormalizedApt[]): string {
  return generateSmartQuestion(candidates, '');
}