// API 설정
export const API_BASE_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:8787';

// API 엔드포인트를 위한 헬퍼 함수
export function getApiUrl(path: string): string {
    // path가 /로 시작하지 않으면 추가
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

// 모든 fetch 요청을 가로채서 BASE_URL 추가
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // input이 string이고 /api로 시작하면 BASE_URL 추가
    if (typeof input === 'string' && input.startsWith('/api')) {
        input = getApiUrl(input);
    }
    return originalFetch.call(this, input, init);
};