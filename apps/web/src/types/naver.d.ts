/**
 * 네이버 Maps API 타입 정의
 * 로드뷰(스트리트뷰) 동기화 기능을 위한 최소 타입 정의
 */

declare namespace naver {
    namespace maps {
        // 기본 좌표 클래스
        class LatLng {
            constructor(lat: number, lng: number);
            lat(): number;
            lng(): number;
        }

        // 파노라마(로드뷰) 클래스
        class Panorama {
            constructor(mapDiv: HTMLElement | string, panoramaOptions?: PanoramaOptions);

            getPosition(): LatLng;
            setPosition(position: LatLng): void;

            getPov(): Pov;
            setPov(pov: Pov): void;

            getZoom(): number;
            setZoom(zoom: number): void;
        }

        // 파노라마 옵션 인터페이스
        interface PanoramaOptions {
            position?: LatLng;
            pov?: Pov;
            zoom?: number;
            logoControl?: boolean;
            logoControlOptions?: LogoControlOptions;
            zoomControl?: boolean;
            zoomControlOptions?: ZoomControlOptions;
        }

        // 시점(Point of View) 인터페이스
        interface Pov {
            pan: number;   // 수평 회전각 (-180 ~ 180도)
            tilt: number;  // 수직 기울기 (-90 ~ 90도)
            fov: number;   // 시야각 (10 ~ 120도)
        }

        // 로고 컨트롤 옵션
        interface LogoControlOptions {
            position?: ControlPosition;
        }

        // 줌 컨트롤 옵션
        interface ZoomControlOptions {
            position?: ControlPosition;
        }

        // 컨트롤 위치 열거형
        enum ControlPosition {
            TOP_LEFT,
            TOP_CENTER,
            TOP_RIGHT,
            LEFT_CENTER,
            CENTER,
            RIGHT_CENTER,
            BOTTOM_LEFT,
            BOTTOM_CENTER,
            BOTTOM_RIGHT
        }

        // 이벤트 네임스페이스
        namespace Event {
            function addListener(
                target: any,
                eventName: string,
                listener: (...args: any[]) => void
            ): void;

            function removeListener(
                target: any,
                eventName: string,
                listener: (...args: any[]) => void
            ): void;
        }

        // 파노라마 이벤트 타입
        type PanoramaEventType =
            | 'pano_changed'    // 파노라마 위치 변경
            | 'pov_changed'     // 시점 변경
            | 'zoom_changed'    // 줌 레벨 변경
            | 'visible_changed' // 가시성 변경
            | 'links_changed';  // 연결된 링크 변경
    }
}

// 글로벌 네이버 객체
declare global {
    interface Window {
        naver: typeof naver;
    }

    const naver: typeof naver;
}

export = naver;
export as namespace naver;