export function loadKakao(appKey: string) {
    return new Promise<void>((resolve, reject) => {
        if ((window as any).kakao?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
        s.async = true;
        s.onload = () => (window as any).kakao.maps.load(() => resolve());
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
// 지도 sdk는 프론트에만 로드 하기 