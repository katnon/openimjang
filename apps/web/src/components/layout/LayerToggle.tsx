import { useState } from "react";

type LayerToggleProps = {
    onMapTypeChange?: (mapType: 'ROADMAP' | 'SATELLITE') => void;
    currentMapType?: 'ROADMAP' | 'SATELLITE';
};

export default function LayerToggle({ 
    onMapTypeChange,
    currentMapType = 'ROADMAP' 
}: LayerToggleProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleMapTypeChange = (mapType: 'ROADMAP' | 'SATELLITE') => {
        onMapTypeChange?.(mapType);
        setIsOpen(false);
    };

    return (
        <div className="absolute top-44 right-4 z-10">
            <div className="relative">
                <button 
                    className="bg-white shadow-lg rounded-lg p-3 border border-gray-200 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M12 22V12" stroke="currentColor" strokeWidth="2"/>
                        <path d="M22 7L12 12L2 7" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                </button>
                
                {isOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white shadow-lg rounded-lg border border-gray-200">
                        <div className="p-2">
                            <div className="text-sm font-medium text-gray-700 mb-2">지도 유형</div>
                            <button
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                    currentMapType === 'ROADMAP' 
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                        : 'hover:bg-gray-50'
                                }`}
                                onClick={() => handleMapTypeChange('ROADMAP')}
                            >
                                일반 지도
                            </button>
                            <button
                                className={`w-full text-left px-3 py-2 rounded-md text-sm mt-1 transition-colors ${
                                    currentMapType === 'SATELLITE' 
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                        : 'hover:bg-gray-50'
                                }`}
                                onClick={() => handleMapTypeChange('SATELLITE')}
                            >
                                위성 지도
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}