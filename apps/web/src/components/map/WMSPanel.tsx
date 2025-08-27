import type { SimpleWMSLayer } from '@/hooks/useWMSOverlay';

interface WMSPanelProps {
  layers: SimpleWMSLayer[];
  activeTilesets: Set<string>;
  onToggleLayer: (layerId: string) => void;
  onHideAll: () => void;
  onClose: () => void;
  onTestEnvironment?: () => void;
  onTestConnection?: () => void;
  onRefreshLayers?: () => void; // ✅ 새로고침 기능 추가
}

export default function WMSPanel({
  layers,
  activeTilesets,
  onToggleLayer,
  onHideAll,
  onClose,
  onTestEnvironment,
  onTestConnection,
  onRefreshLayers
}: WMSPanelProps) {

  return (
    <div className="absolute right-4 top-32 z-10 bg-white rounded-lg shadow-xl border border-gray-200 w-80">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">VWorld WMS 레이어</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {onTestEnvironment && (
            <button
              onClick={onTestEnvironment}
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
            >
              🔐 환경변수
            </button>
          )}
          {onTestConnection && (
            <button
              onClick={onTestConnection}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              🔗 연결테스트
            </button>
          )}
          {onRefreshLayers && (
            <button
              onClick={onRefreshLayers}
              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
            >
              🔄 새로고침
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-600">
          활성 레이어: {activeTilesets.size}개
        </div>
      </div>

      {/* 레이어 목록 */}
      <div className="p-4">
        <div className="space-y-3">
          {layers.map(layer => (
            <div key={layer.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{layer.displayName}</div>
                <div className="text-xs text-gray-600">{layer.description}</div>
                <div className="text-xs text-gray-500 font-mono">{layer.name}</div>
              </div>
              <button
                onClick={() => onToggleLayer(layer.id)}
                className={`px-3 py-1 text-xs rounded transition-colors ${layer.visible
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }`}
              >
                {layer.visible ? '켜짐' : '꺼짐'}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onHideAll}
          className="w-full mt-3 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
        >
          모든 레이어 끄기
        </button>
      </div>
    </div>
  );
}
