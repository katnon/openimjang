import React, { useState, useEffect } from "react";

type BuildingLandInfoProps = {
    aptId: number;
    aptName: string;
    lat: number;
    lon: number;
    jibunAddress: string;
};

type PNUData = {
    pnu: string | null;
    error?: string;
};

type LanduseZone = {
    code: string;
    name: string;
    status: number;
    displayText: string;
};

type LanduseData = {
    landuse_zones: LanduseZone[];
    error?: string;
};

type BuildingInfo = {
    id: number;
    type: "recap" | "title";
    dongnm?: string;
    bldnm?: string;
    platplc?: string;
    platarea?: number;
    archarea?: number;
    totarea?: number;
    grndflrcnt?: number;
    ugrndflrcnt?: number;
    mainpurpscdnm?: string;
    strctcdnm?: string;
    roofcdnm?: string;
    hhldcnt?: number;
    mainbldcnt?: number;
    atchbldcnt?: number;
    totpkngcnt?: number;
    useaprday?: string;
    created_at?: string;
};

type BuildingInfoData = {
    recap_info: BuildingInfo | null;
    title_infos: BuildingInfo[];
    total_count: number;
    error?: string;
};

export default function BuildingLandInfo({ aptId, aptName, lat, lon, jibunAddress }: BuildingLandInfoProps) {
    const [pnuData, setPnuData] = useState<PNUData | null>(null);
    const [landuseData, setLanduseData] = useState<LanduseData | null>(null);
    const [buildingData, setBuildingData] = useState<BuildingInfoData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLanduseLoading, setIsLanduseLoading] = useState(true);
    const [isBuildingLoading, setIsBuildingLoading] = useState(true);
    const [selectedBuildingType, setSelectedBuildingType] = useState<"recap" | "title">("recap");
    const [selectedTitleBuilding, setSelectedTitleBuilding] = useState<BuildingInfo | null>(null);

    // PNU 조회
    useEffect(() => {
        const fetchPNU = async () => {
            setIsLoading(true);
            try {
                console.log(`🏢 PNU 조회: aptId=${aptId}, 좌표=(${lat}, ${lon})`);
                
                const res = await fetch(`/api/search/pnu/${aptId}`);
                const data = await res.json();
                
                if (res.ok) {
                    setPnuData(data);
                    console.log(`🏢 PNU 조회 결과:`, data);
                } else {
                    setPnuData({ pnu: null, error: data.error || "PNU 조회 실패" });
                }
            } catch (err) {
                console.error("❌ PNU 조회 오류:", err);
                setPnuData({ pnu: null, error: "네트워크 오류" });
            }
            setIsLoading(false);
        };

        fetchPNU();
    }, [aptId, lat, lon]);

    // 토지이용계획 조회
    useEffect(() => {
        const fetchLanduse = async () => {
            setIsLanduseLoading(true);
            try {
                console.log(`🏛️ 토지이용계획 조회: aptId=${aptId}, 좌표=(${lat}, ${lon})`);
                
                const res = await fetch(`/api/search/landuse/${aptId}`);
                const data = await res.json();
                
                if (res.ok) {
                    setLanduseData(data);
                    console.log(`🏛️ 토지이용계획 조회 결과:`, data);
                } else {
                    setLanduseData({ landuse_zones: [], error: data.error || "토지이용계획 조회 실패" });
                }
            } catch (err) {
                console.error("❌ 토지이용계획 조회 오류:", err);
                setLanduseData({ landuse_zones: [], error: "네트워크 오류" });
            }
            setIsLanduseLoading(false);
        };

        fetchLanduse();
    }, [aptId, lat, lon]);

    // 건물 정보 조회
    useEffect(() => {
        const fetchBuildingInfo = async () => {
            setIsBuildingLoading(true);
            try {
                console.log(`🏗️ 건물 정보 조회: aptId=${aptId}`);
                
                const res = await fetch(`/api/search/building-info/${aptId}`);
                const data = await res.json();
                
                if (res.ok) {
                    setBuildingData(data);
                    console.log(`🏗️ 건물 정보 조회 결과:`, data);
                    // 첫 번째 표제부를 기본 선택
                    if (data.title_infos && data.title_infos.length > 0) {
                        setSelectedTitleBuilding(data.title_infos[0]);
                    }
                } else {
                    setBuildingData({ recap_info: null, title_infos: [], total_count: 0, error: data.error || "건물 정보 조회 실패" });
                }
            } catch (err) {
                console.error("❌ 건물 정보 조회 오류:", err);
                setBuildingData({ recap_info: null, title_infos: [], total_count: 0, error: "네트워크 오류" });
            }
            setIsBuildingLoading(false);
        };

        fetchBuildingInfo();
    }, [aptId]);

    return (
        <div className="p-4 h-full overflow-auto">
            <div className="space-y-6">


                {/* 토지이용계획 정보 섹션 */}
                <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        🏛️ 토지이용계획 (용도지역지구)
                    </h3>
                    
                    {isLanduseLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                            <span>토지이용계획 조회 중...</span>
                        </div>
                    ) : landuseData?.landuse_zones && landuseData.landuse_zones.length > 0 ? (
                        <div className="space-y-1">
                            {landuseData.landuse_zones.map((zone, index) => (
                                <div key={index} className="text-sm text-gray-700">
                                    {zone.name} ({zone.status === 1 ? '포함' : zone.status === 2 ? '저촉' : zone.status === 3 ? '접함' : '포함'})
                                </div>
                            ))}
                            <div className="text-xs text-gray-500 mt-3">
                                📍 서울시 토지이용계획정보를 기반으로 조회된 용도지역지구 정보입니다.
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-yellow-700">
                            ⚠️ {landuseData?.error || "토지이용계획 정보를 찾을 수 없습니다"}
                        </div>
                    )}
                </div>

                {/* 건물 정보 섹션 */}
                <div className="bg-orange-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        🏗️ 건물 정보 (건축물대장)
                    </h3>
                    
                    {isBuildingLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                            <span>건물 정보 조회 중...</span>
                        </div>
                    ) : buildingData && (buildingData.recap_info || buildingData.title_infos.length > 0) ? (
                        <div className="space-y-4">
                            {/* 드롭다운 선택 영역 */}
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        표제부 유형 선택
                                    </label>
                                    <select
                                        value={selectedBuildingType}
                                        onChange={(e) => {
                                            setSelectedBuildingType(e.target.value as "recap" | "title");
                                            if (e.target.value === "title" && buildingData.title_infos.length > 0) {
                                                setSelectedTitleBuilding(buildingData.title_infos[0]);
                                            }
                                        }}
                                        className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        {buildingData.recap_info && (
                                            <option value="recap">총괄표제부</option>
                                        )}
                                        {buildingData.title_infos.length > 0 && (
                                            <option value="title">표제부</option>
                                        )}
                                    </select>
                                </div>
                                
                                {/* 표제부일 때 건물별 선택 드롭다운 */}
                                {selectedBuildingType === "title" && buildingData.title_infos.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            건물 선택
                                        </label>
                                        <select
                                            value={selectedTitleBuilding?.id || ""}
                                            onChange={(e) => {
                                                const building = buildingData.title_infos.find(b => b.id === parseInt(e.target.value));
                                                setSelectedTitleBuilding(building || null);
                                            }}
                                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {buildingData.title_infos.map((building, index) => {
                                                const dongName = building.dongnm && building.dongnm.trim() ? building.dongnm.trim() : null;
                                                const bldName = building.bldnm && building.bldnm.trim() ? building.bldnm.trim() : null;
                                                
                                                let displayName = "";
                                                if (dongName && dongName !== " ") {
                                                    displayName = dongName;
                                                } else if (bldName && bldName !== " ") {
                                                    displayName = bldName;
                                                } else {
                                                    displayName = `건물 ${index + 1}`;
                                                }
                                                
                                                return (
                                                    <option key={building.id} value={building.id}>
                                                        {displayName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* 선택된 건물 정보 표시 */}
                            <div className="bg-white rounded border p-3">
                                {selectedBuildingType === "recap" && buildingData.recap_info ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="font-semibold text-gray-800 mb-2">총괄표제부</div>
                                        {buildingData.recap_info.bldnm && (
                                            <div><span className="text-gray-600">건물명:</span> {buildingData.recap_info.bldnm}</div>
                                        )}
                                        {buildingData.recap_info.platplc && (
                                            <div><span className="text-gray-600">대지위치:</span> {buildingData.recap_info.platplc}</div>
                                        )}
                                        {buildingData.recap_info.platarea && (
                                            <div><span className="text-gray-600">대지면적:</span> {buildingData.recap_info.platarea}㎡</div>
                                        )}
                                        {buildingData.recap_info.totarea && (
                                            <div><span className="text-gray-600">연면적:</span> {buildingData.recap_info.totarea}㎡</div>
                                        )}
                                        {buildingData.recap_info.mainpurpscdnm && (
                                            <div><span className="text-gray-600">주용도:</span> {buildingData.recap_info.mainpurpscdnm}</div>
                                        )}
                                        {buildingData.recap_info.hhldcnt && (
                                            <div><span className="text-gray-600">세대수:</span> {buildingData.recap_info.hhldcnt}세대</div>
                                        )}
                                        {buildingData.recap_info.mainbldcnt && (
                                            <div><span className="text-gray-600">주건축물수:</span> {buildingData.recap_info.mainbldcnt}개</div>
                                        )}
                                        {buildingData.recap_info.totpkngcnt && (
                                            <div><span className="text-gray-600">총주차수:</span> {buildingData.recap_info.totpkngcnt}대</div>
                                        )}
                                        {buildingData.recap_info.useaprday && (
                                            <div><span className="text-gray-600">사용승인일:</span> {buildingData.recap_info.useaprday}</div>
                                        )}
                                    </div>
                                ) : selectedTitleBuilding ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="font-semibold text-gray-800 mb-2">
                                            {(() => {
                                                const dongName = selectedTitleBuilding.dongnm && selectedTitleBuilding.dongnm.trim() ? selectedTitleBuilding.dongnm.trim() : null;
                                                const bldName = selectedTitleBuilding.bldnm && selectedTitleBuilding.bldnm.trim() ? selectedTitleBuilding.bldnm.trim() : null;
                                                
                                                if (dongName && dongName !== " ") {
                                                    return `표제부 - ${dongName}`;
                                                } else if (bldName && bldName !== " ") {
                                                    return `표제부 - ${bldName}`;
                                                } else {
                                                    return `표제부`;
                                                }
                                            })()}
                                        </div>
                                        {selectedTitleBuilding.dongnm && (
                                            <div><span className="text-gray-600">동명칭:</span> {selectedTitleBuilding.dongnm}</div>
                                        )}
                                        {selectedTitleBuilding.bldnm && (
                                            <div><span className="text-gray-600">건물명:</span> {selectedTitleBuilding.bldnm}</div>
                                        )}
                                        {selectedTitleBuilding.platplc && (
                                            <div><span className="text-gray-600">대지위치:</span> {selectedTitleBuilding.platplc}</div>
                                        )}
                                        {selectedTitleBuilding.platarea && (
                                            <div><span className="text-gray-600">대지면적:</span> {selectedTitleBuilding.platarea}㎡</div>
                                        )}
                                        {selectedTitleBuilding.archarea && (
                                            <div><span className="text-gray-600">건축면적:</span> {selectedTitleBuilding.archarea}㎡</div>
                                        )}
                                        {selectedTitleBuilding.totarea && (
                                            <div><span className="text-gray-600">연면적:</span> {selectedTitleBuilding.totarea}㎡</div>
                                        )}
                                        {selectedTitleBuilding.grndflrcnt && (
                                            <div><span className="text-gray-600">지상층수:</span> {selectedTitleBuilding.grndflrcnt}층</div>
                                        )}
                                        {selectedTitleBuilding.ugrndflrcnt && (
                                            <div><span className="text-gray-600">지하층수:</span> {selectedTitleBuilding.ugrndflrcnt}층</div>
                                        )}
                                        {selectedTitleBuilding.mainpurpscdnm && (
                                            <div><span className="text-gray-600">주용도:</span> {selectedTitleBuilding.mainpurpscdnm}</div>
                                        )}
                                        {selectedTitleBuilding.strctcdnm && (
                                            <div><span className="text-gray-600">구조:</span> {selectedTitleBuilding.strctcdnm}</div>
                                        )}
                                        {selectedTitleBuilding.roofcdnm && (
                                            <div><span className="text-gray-600">지붕구조:</span> {selectedTitleBuilding.roofcdnm}</div>
                                        )}
                                        {selectedTitleBuilding.useaprday && (
                                            <div><span className="text-gray-600">사용승인일:</span> {selectedTitleBuilding.useaprday}</div>
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            <div className="text-xs text-gray-500">
                                🏗️ 건축물대장 정보를 기반으로 한 건물 상세 정보입니다.
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-yellow-700">
                            ⚠️ {buildingData?.error || "건물 정보를 찾을 수 없습니다"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}