import { useState, useRef, useCallback } from 'react';

export type ResizeDirection = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';

interface UseResizableProps {
    initialWidth: number;
    initialHeight: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    direction: ResizeDirection;
}

interface ResizeHandle {
    onMouseDown: (e: React.MouseEvent) => void;
    isDragging: boolean;
}

export function useResizable({
    initialWidth,
    initialHeight,
    minWidth = 200,
    minHeight = 150,
    maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1200,
    maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.9 : 800,
    direction
}: UseResizableProps) {
    const [width, setWidth] = useState(initialWidth);
    const [height, setHeight] = useState(initialHeight);
    const [isDragging, setIsDragging] = useState(false);
    
    const dragRef = useRef({
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0
    });

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsDragging(true);
        
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: width,
            startHeight: height
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;

            const deltaX = e.clientX - dragRef.current.startX;
            const deltaY = e.clientY - dragRef.current.startY;
            
            let newWidth = dragRef.current.startWidth;
            let newHeight = dragRef.current.startHeight;

            // 방향에 따른 크기 계산
            switch (direction) {
                case 'top-left':
                    newWidth = dragRef.current.startWidth - deltaX;
                    newHeight = dragRef.current.startHeight - deltaY;
                    break;
                case 'bottom-left':
                    newWidth = dragRef.current.startWidth - deltaX;
                    newHeight = dragRef.current.startHeight + deltaY;
                    break;
                case 'top-right':
                    newWidth = dragRef.current.startWidth + deltaX;
                    newHeight = dragRef.current.startHeight - deltaY;
                    break;
                case 'bottom-right':
                    newWidth = dragRef.current.startWidth + deltaX;
                    newHeight = dragRef.current.startHeight + deltaY;
                    break;
            }

            // 최소/최대 크기 제한 적용
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

            setWidth(newWidth);
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [width, height, direction, minWidth, minHeight, maxWidth, maxHeight]);

    const resizeHandle: ResizeHandle = {
        onMouseDown: handleMouseDown,
        isDragging
    };

    return {
        width,
        height,
        resizeHandle,
        setWidth,
        setHeight
    };
}