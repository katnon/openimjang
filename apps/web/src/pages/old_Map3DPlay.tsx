import { useRef } from "react";
import MapPrime3DViewer, { type MapPrime3DViewerRef } from "@/components/MapPrime3DViewer";

export default function Map3DPlay() {
    const ref = useRef<MapPrime3DViewerRef>(null);

    const goKorea = () => ref.current?.flyTo({ lon: 126.9784, lat: 37.5667, height: 800 });




    // apps/web/src/pages/Map3DPlay.tsx
    const vworldKey = import.meta.env.VITE_VWORLD_KEY as string;
    const vworldDomain = (import.meta.env.VITE_VWORLD_DOMAIN as string) || window.location.hostname;

    // VWorld WMS 기본 URL (버전/서비스/요청 고정값 포함)
    // 필요한 경우 SRS/CRS, TILED, STYLES 등을 parameters에서 제어
    const vworldWmsBase = `https://api.vworld.kr/req/wms?service=WMS&request=GetMap&key=${encodeURIComponent(
        vworldKey
    )}&domain=${encodeURIComponent(vworldDomain)}`;

    const addVWorldCadastral = () =>
        ref.current?.addWms(
            "지적도",
            vworldWmsBase,
            "lp_ci", // VWorld 지적 레이어
            {
                // Cesium WMS 파라미터
                VERSION: "1.3.0",
                FORMAT: "image/png",
                TRANSPARENT: "true",
                CRS: "EPSG:3857", // 보통 웹지도 좌표
                WIDTH: "256",
                HEIGHT: "256",
                TILED: "true" // (서비스 설정에 따라 생략 가능)
            }
        );


    const skyline = () => ref.current?.startSkylineAt({ lon: 126.9784, lat: 37.5667, height: 30 });
    const shadow = () => ref.current?.startShadowAt({ lon: 126.9784, lat: 37.5667, height: 30 }, "winter");


    return (
        <div className="w-screen h-screen">
            <div className="absolute z-10 m-3 space-x-2">
                <button onClick={goKorea} className="px-3 py-1 rounded bg-black/70 text-white">서울로</button>
                <button onClick={addVWorldCadastral} className="px-3 py-1 rounded bg-black/70 text-white">지적 WMS</button>
                <button onClick={skyline} className="px-3 py-1 rounded bg-black/70 text-white">스카이라인</button>
                <button onClick={shadow} className="px-3 py-1 rounded bg-black/70 text-white">음영(동지)</button>
            </div>
            <MapPrime3DViewer
                ref={ref}
                terrain="https://mapprime.synology.me:15289/seoul/data/terrain/1m_v1.1/"
                tileset="https://mapprime.synology.me:15289/seoul/data/all_ktx2/tileset.json"
                controls={[]}
                imageries={[
                    {
                        title: "Imagery",
                        credit: "Arcgis",
                        type: "TMS",
                        epsg: "EPSG:3857",
                        url: "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        format: "jpeg",
                        maximumLevel: 18,
                        current: true,
                    },
                    {
                        title: "일반",
                        credit: "바로e맵",
                        type: "TMS",
                        epsg: "EPSG:5179", // 5179 혼용 시 좌표 오프셋 생기면 확인 필요
                        url: "https://map.ngii.go.kr/openapi/Gettile.do?apikey=04trYP9_xwLAfALjwZ-B8g&layer=korean_map&style=korean&tilematrixset=korean&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={csZ}&TileCol={x}&TileRow={y}",
                        format: "png",
                        maximumLevel: 19,
                        current: false,
                    },
                ]}
                credit="<i>MapPrime</i>"
                initialCamera={{ longitude: 127.035, latitude: 37.519, height: 400, heading: 340, pitch: -50, roll: 0 }}
            />
        </div>
    );
}
