//Cesium 뷰어 생성
const viewer = new Cesium.Viewer('world-container');

//맵프라임 위젯 설정
viewer.extend(MapPrime3DExtension, {
    terrain: 'https://mapprime.synology.me:15289/seoul/data/terrain/1m_v1.1/',
    tileset: 'https://mapprime.synology.me:15289/seoul/data/all_ktx2/tileset.json',
    controls: [],
    imageries: [{
        "title": "Imagery",
        "credit": "Arcgis",
        "type": "TMS",
        "epsg": "EPSG:3857",
        "url": "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "format": "jpeg",
        "maximumLevel": 18,
        "current": true
    }, {
        "title": "일반",
        "credit": "바로e맵",
        "type": "TMS",
        "epsg": "EPSG:5179",
        "url": "https://map.ngii.go.kr/openapi/Gettile.do?apikey=04trYP9_xwLAfALjwZ-B8g&layer=korean_map&style=korean&tilematrixset=korean&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={csZ}&TileCol={x}&TileRow={y}",
        "format": "png",
        "maximumLevel": 19,
        "current": false
    }],
    credit: '<i>MapPrime</i>',
    initialCamera: {
        longitude: 127.035,
        latitude: 37.519,
        height: 400,
        heading: 340,
        pitch: -50,
        roll: 0
    }
});
