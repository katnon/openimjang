import React from 'react';

interface ApartmentBlockProps {
  aptName: string;
  isLoading?: boolean;
  hasFullData?: boolean;
  onClick?: (aptName: string) => void;
  onRemove?: (aptName: string) => void;
  className?: string;
}

export default function ApartmentBlock({ 
  aptName, 
  isLoading = false, 
  hasFullData = false,
  onClick, 
  onRemove, 
  className = '' 
}: ApartmentBlockProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && onClick) {
      onClick(aptName);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove(aptName);
    }
  };

  // 블록 스타일 결정
  const getBlockStyle = () => {
    if (isLoading) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse';
    }
    if (hasFullData) {
      return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium 
        rounded-full border-2 transition-all duration-200 cursor-pointer
        select-none max-w-xs
        ${getBlockStyle()}
        ${className}
      `}
      onClick={handleClick}
      title={hasFullData ? `${aptName} (전체 데이터 로드됨)` : `${aptName} (클릭하여 데이터 로드)`}
    >
      {/* 아파트 아이콘 */}
      <span className="text-xs">
        {isLoading ? '🔄' : hasFullData ? '🏢' : '🏠'}
      </span>
      
      {/* 아파트명 */}
      <span className="truncate">
        @{aptName}
      </span>
      
      {/* 상태 표시 */}
      {isLoading && (
        <span className="text-xs opacity-70">
          로딩중...
        </span>
      )}
      
      {hasFullData && (
        <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">
          ✓
        </span>
      )}
      
      {/* 제거 버튼 (옵션) */}
      {onRemove && !isLoading && (
        <button
          type="button"
          onClick={handleRemove}
          className="text-xs opacity-50 hover:opacity-100 ml-1 p-0.5 rounded-full hover:bg-white/50"
          title={`${aptName} 제거`}
        >
          ×
        </button>
      )}
    </span>
  );
}

/**
 * @아파트명 텍스트를 블록으로 변환하는 유틸리티 함수
 */
export function parseApartmentBlocks(
  text: string,
  apartmentData: Record<string, { isLoading?: boolean; hasFullData?: boolean }> = {}
): Array<{ type: 'text' | 'apartment'; content: string }> {
  const parts: Array<{ type: 'text' | 'apartment'; content: string }> = [];
  const regex = /@([가-힣\w]+)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // 이전 텍스트 부분 추가
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // 아파트명 부분 추가
    parts.push({
      type: 'apartment',
      content: match[1] // @ 제외한 아파트명
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // 마지막 텍스트 부분 추가
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return parts;
}

/**
 * 블록이 포함된 텍스트를 렌더링하는 컴포넌트
 */
interface ApartmentTextProps {
  text: string;
  apartmentData?: Record<string, { isLoading?: boolean; hasFullData?: boolean }>;
  onApartmentClick?: (aptName: string) => void;
  onApartmentRemove?: (aptName: string) => void;
  className?: string;
}

export function ApartmentText({ 
  text, 
  apartmentData = {}, 
  onApartmentClick, 
  onApartmentRemove,
  className = ''
}: ApartmentTextProps) {
  const parts = parseApartmentBlocks(text, apartmentData);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'apartment') {
          const data = apartmentData[part.content] || {};
          return (
            <ApartmentBlock
              key={index}
              aptName={part.content}
              isLoading={data.isLoading}
              hasFullData={data.hasFullData}
              onClick={onApartmentClick}
              onRemove={onApartmentRemove}
              className="mx-1"
            />
          );
        }
        
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}