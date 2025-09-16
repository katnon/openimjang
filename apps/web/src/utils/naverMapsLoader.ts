/**
 * 네이버 Maps API 동적 로더
 * 환경변수에서 클라이언트 ID를 읽어와서 동적으로 스크립트를 로드합니다.
 */

interface NaverMapsLoaderOptions {
    clientId?: string; // 로드뷰는 무료이므로 불필요
    submodules?: string[];
}

class NaverMapsLoader {
    private static instance: NaverMapsLoader;
    private isLoaded = false;
    private isLoading = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() {}

    static getInstance(): NaverMapsLoader {
        if (!NaverMapsLoader.instance) {
            NaverMapsLoader.instance = new NaverMapsLoader();
        }
        return NaverMapsLoader.instance;
    }

    /**
     * 네이버 Maps API 로드
     */
    async load(options: NaverMapsLoaderOptions = {}): Promise<void> {
        // 이미 로드된 경우 (Panorama 객체까지 확인)
        if (this.isLoaded && this.isPanoramaAvailable()) {
            console.log('✅ 네이버 Maps API 이미 로드됨 (Panorama 사용 가능)');
            return Promise.resolve();
        }

        // 현재 로딩 중인 경우
        if (this.isLoading && this.loadPromise) {
            return this.loadPromise;
        }

        // 새로운 로딩 시작
        this.isLoading = true;
        this.loadPromise = this.createLoadPromise(options);

        try {
            await this.loadPromise;
            this.isLoaded = true;
            console.log('✅ 네이버 Maps API 로드 완료');
        } catch (error) {
            console.error('❌ 네이버 Maps API 로드 실패:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    private createLoadPromise(options: NaverMapsLoaderOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            // 네이버 로드뷰 API 여러 URL 시도 방식
            const fallbackUrls = [
                // 1차: submodules=panorama 방식
                `https://openapi.map.naver.com/openapi/v3/maps.js?submodules=panorama`,
                // 2차: 기본 API + 추가 panorama 모듈
                `https://openapi.map.naver.com/openapi/v3/maps.js`,
                // 3차: oapi 도메인으로 시도
                `https://oapi.map.naver.com/openapi/v3/maps.js?submodules=panorama`,
                // 4차: 기본 oapi 도메인
                `https://oapi.map.naver.com/openapi/v3/maps.js`
            ];

            let currentUrlIndex = 0;
            const tryNextUrl = () => {
                if (currentUrlIndex >= fallbackUrls.length) {
                    reject(new Error('모든 네이버 Maps API URL 시도 실패'));
                    return;
                }

                const scriptUrl = fallbackUrls[currentUrlIndex];
                console.log(`🔍 네이버 Maps API URL 시도 (${currentUrlIndex + 1}/${fallbackUrls.length}):`, scriptUrl);

                this.loadScriptWithUrl(scriptUrl, resolve, reject, () => {
                    currentUrlIndex++;
                    console.log(`⚠️ URL ${currentUrlIndex} 실패, 다음 URL 시도...`);
                    tryNextUrl();
                });
            };

            tryNextUrl();
        });
    }

    private loadScriptWithUrl(scriptUrl: string, resolve: Function, reject: Function, onFailure: Function): void {
            // 기존 스크립트 확인 (더 범용적으로 체크)
            const existingScript = document.querySelector(`script[src*="map.naver.com"]`);
            if (existingScript) {
                console.log('🔍 기존 네이버 Maps 스크립트 발견');
                // 이미 스크립트가 있으면 로드 완료 대기
                if (window.naver && window.naver.maps && window.naver.maps.Panorama) {
                    console.log('✅ 기존 스크립트에서 Panorama 사용 가능');
                    resolve();
                } else {
                    console.log('⚠️ 기존 스크립트에 Panorama 없음, 다시 로드 시도');
                    existingScript.remove(); // 기존 스크립트 제거 후 새로 로드
                    this.createNewScript(scriptUrl, resolve, reject, onFailure);
                }
                return;
            }

            this.createNewScript(scriptUrl, resolve, reject, onFailure);
    }

    private createNewScript(scriptUrl: string, resolve: Function, reject: Function, onFailure: Function): void {
            // 새 스크립트 엘리먼트 생성
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = scriptUrl;
            script.async = true;

            // 로드 이벤트 핸들러
            script.onload = () => {
                // 더 철저한 API 구조 검증
                console.log('🔍 네이버 Maps API 스크립트 로드됨, 구조 검증 중...');

                if (window.naver) {
                    console.log('✅ window.naver 존재');
                    if (window.naver.maps) {
                        console.log('✅ window.naver.maps 존재');

                        // Panorama 객체 존재 확인
                        if (window.naver.maps.Panorama) {
                            console.log('✅ window.naver.maps.Panorama 존재');
                            console.log('🔍 Panorama 타입:', typeof window.naver.maps.Panorama);

                            // LatLng 등 필수 객체들도 확인
                            if (window.naver.maps.LatLng) {
                                console.log('✅ window.naver.maps.LatLng 존재');
                                console.log(`✅ 네이버 로드뷰 API 로드 완료 - ${scriptUrl}`);

                                // 약간의 지연을 두어 API가 완전히 초기화되도록 함
                                setTimeout(() => {
                                    resolve();
                                }, 100);
                            } else {
                                console.warn('⚠️ LatLng 객체 없음, 다음 URL 시도');
                                onFailure();
                            }
                        } else {
                            console.warn('⚠️ Panorama 객체 없음, 다음 URL 시도');
                            console.log('🔍 사용 가능한 maps 객체들:', Object.keys(window.naver.maps));
                            onFailure();
                        }
                    } else {
                        console.warn('⚠️ window.naver.maps 없음, 다음 URL 시도');
                        onFailure();
                    }
                } else {
                    console.warn('⚠️ window.naver 없음, 다음 URL 시도');
                    onFailure();
                }
            };

            script.onerror = () => {
                console.warn(`⚠️ 스크립트 로드 실패: ${scriptUrl}, 다음 URL 시도`);
                onFailure();
            };

            // HTML head에 스크립트 추가
            document.head.appendChild(script);
    }

    /**
     * Panorama 객체 사용 가능 여부 확인
     */
    private isPanoramaAvailable(): boolean {
        try {
            return !!(
                window.naver &&
                window.naver.maps &&
                window.naver.maps.Panorama &&
                typeof window.naver.maps.Panorama === 'function' &&
                window.naver.maps.LatLng &&
                typeof window.naver.maps.LatLng === 'function'
            );
        } catch (error) {
            console.warn('⚠️ Panorama 사용 가능성 확인 중 오류:', error);
            return false;
        }
    }

    /**
     * 로드 상태 확인 (Panorama 포함)
     */
    isNaverMapsLoaded(): boolean {
        return this.isLoaded && this.isPanoramaAvailable();
    }

    /**
     * 로딩 중 상태 확인
     */
    isNaverMapsLoading(): boolean {
        return this.isLoading;
    }

    /**
     * API 상태 진단 정보 반환
     */
    getDiagnosticInfo(): object {
        return {
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            hasNaver: !!(window as any).naver,
            hasMaps: !!((window as any).naver?.maps),
            hasPanorama: !!((window as any).naver?.maps?.Panorama),
            hasLatLng: !!((window as any).naver?.maps?.LatLng),
            panoramaType: typeof ((window as any).naver?.maps?.Panorama),
            availableMapObjects: ((window as any).naver?.maps) ? Object.keys((window as any).naver.maps) : []
        };
    }
}

// 싱글톤 인스턴스 내보내기
export const naverMapsLoader = NaverMapsLoader.getInstance();

// 편의 함수들
export const loadNaverMaps = (options?: NaverMapsLoaderOptions) => naverMapsLoader.load(options);
export const isNaverMapsLoaded = () => naverMapsLoader.isNaverMapsLoaded();
export const isNaverMapsLoading = () => naverMapsLoader.isNaverMapsLoading();

export default naverMapsLoader;