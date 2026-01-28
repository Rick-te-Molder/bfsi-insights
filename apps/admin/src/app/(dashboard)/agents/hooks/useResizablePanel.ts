'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function calculateConstrainedHeight(newHeight: number, minHeight: number, maxOffset: number) {
  return Math.max(minHeight, Math.min(newHeight, window.innerHeight - maxOffset));
}

function setDraggingCursor(isDragging: boolean) {
  document.body.style.cursor = isDragging ? 'row-resize' : '';
  document.body.style.userSelect = isDragging ? 'none' : '';
}

function createMouseMoveHandler(
  isDragging: React.MutableRefObject<boolean>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHeight: (height: number) => void,
  minHeight: number,
  maxOffset: number,
) {
  return (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = e.clientY - containerRect.top;
    setHeight(calculateConstrainedHeight(newHeight, minHeight, maxOffset));
  };
}

function createMouseUpHandler(isDragging: React.MutableRefObject<boolean>) {
  return () => {
    isDragging.current = false;
    setDraggingCursor(false);
  };
}

function setupMouseListeners(
  isDragging: React.MutableRefObject<boolean>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  setHeight: (height: number) => void,
  minHeight: number,
  maxOffset: number,
) {
  const handleMouseMove = createMouseMoveHandler(
    isDragging,
    containerRef,
    setHeight,
    minHeight,
    maxOffset,
  );
  const handleMouseUp = createMouseUpHandler(isDragging);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}

export function useResizablePanel(initialHeight = 400, minHeight = 150, maxOffset = 300) {
  const [height, setHeight] = useState(initialHeight);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDraggingCursor(true);
  }, []);

  useEffect(() => {
    return setupMouseListeners(isDragging, containerRef, setHeight, minHeight, maxOffset);
  }, [minHeight, maxOffset]);

  return { height, containerRef, handleMouseDown };
}
