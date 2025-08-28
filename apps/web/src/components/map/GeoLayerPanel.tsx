import React from 'react'
import type { GeoLayer } from '@/hooks/useGeoOverlay'

export default function GeoLayerPanel({
    layers,
    onToggle,
    onHideAll,
    onClose,
}: {
    layers: GeoLayer[]
    onToggle: (id: string) => void
    onHideAll: () => void
    onClose?: () => void
}) {
    return (
        <div className="absolute left-4 top-32 z-10 bg-white rounded-lg shadow-xl border border-gray-200 w-72">
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Geo 레이어</div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
                )}
            </div>
            <div className="p-3 space-y-2">
                {layers.map(l => (
                    <div key={l.id} className="flex items-center justify-between">
                        <div className="text-sm text-gray-800">{l.name}</div>
                        <button
                            onClick={() => onToggle(l.id)}
                            className={`px-2 py-1 text-xs rounded ${l.visible ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            {l.visible ? '켜짐' : '꺼짐'}
                        </button>
                    </div>
                ))}
                <button onClick={onHideAll} className="w-full mt-2 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">
                    모두 끄기
                </button>
            </div>
        </div>
    )
}
