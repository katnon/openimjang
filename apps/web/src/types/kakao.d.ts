// apps/web/src/types/kakao.d.ts
export { };

declare global {
    interface Window {
        kakao: any;
    }

    namespace kakao.maps {
        class LatLng {
            constructor(lat: number, lng: number);
            getLat(): number;
            getLng(): number;
        }

        class Map {
            constructor(container: HTMLElement, options: any);
            getCenter(): LatLng;
            getBounds(): Bounds;
            panTo(latlng: LatLng): void;
            getLevel(): number;
            setLevel(level: number): void;
            setCenter(latlng: LatLng): void;
            addOverlayMapTypeId?(id: any): void; // optional
            removeOverlayMapTypeId?(id: any): void; // optional
        }

        class Marker {
            constructor(options: any);
            setMap(map: Map | null): void;
            setPosition(latlng: LatLng): void;
            setImage(image: any): void;
        }

        class MarkerImage {
            constructor(src: string, size: Size, options?: any);
        }

        class Size {
            constructor(width: number, height: number);
        }

        class Point {
            constructor(x: number, y: number);
        }

        class CustomOverlay {
            constructor(options: any);
            setMap(map: Map | null): void;
            setVisible(visible: boolean): void;
            setPosition(latlng: LatLng): void;
            setContent(content: string | HTMLElement): void;
        }

        interface Bounds {
            getSouthWest(): LatLng;
            getNorthEast(): LatLng;
        }

        // ✅ 실제 존재하지 않는 Tileset 관련 제거하고 대안 추가
        namespace MapTypeId {
            const ROADMAP: string;
            const SKYVIEW: string;
            const HYBRID: string;
        }

        namespace event {
            function addListener(target: any, type: string, handler: Function): void;
            function removeListener(target: any, type: string, handler: Function): void;
        }

        function load(callback: () => void): void;
    }
}