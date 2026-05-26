import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_W = 240;
const MAX_W = 600;
const MIN_H = 80;

export function clampWidth(w: number): number {
  return Math.min(MAX_W, Math.max(MIN_W, w));
}

export function clampHeight(h: number, maxH: number): number {
  return Math.min(maxH, Math.max(MIN_H, h));
}

export function computeDragPos(
  startPos: { x: number; y: number },
  startMouse: { x: number; y: number },
  currentMouse: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: startPos.x + (currentMouse.x - startMouse.x),
    y: startPos.y + (currentMouse.y - startMouse.y),
  };
}

export function computeResizeSize(
  startSize: { width: number; height: number },
  startMouse: { x: number; y: number },
  currentMouse: { x: number; y: number },
  maxH: number
): { width: number; height: number } {
  return {
    width: clampWidth(startSize.width + (currentMouse.x - startMouse.x)),
    height: clampHeight(startSize.height + (currentMouse.y - startMouse.y), maxH),
  };
}

interface DragResizeState {
  pos: { x: number; y: number } | null;
  size: { width: number; height?: number };
}

const DEFAULT_STATE: DragResizeState = { pos: null, size: { width: 320 } };

export function useDragResize(slug: string | null) {
  const [state, setState] = useState<DragResizeState>(DEFAULT_STATE);

  useEffect(() => {
    setState(DEFAULT_STATE);
  }, [slug]);

  const dragRef = useRef<{
    startPos: { x: number; y: number };
    startMouse: { x: number; y: number };
  } | null>(null);

  const resizeRef = useRef<{
    startSize: { width: number; height: number };
    startMouse: { x: number; y: number };
  } | null>(null);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const root = (e.currentTarget as HTMLElement).closest('.lb-root') as HTMLElement | null;
    const rect = root?.getBoundingClientRect();
    const startPos = rect ? { x: rect.left, y: rect.top } : { x: 0, y: 0 };
    dragRef.current = { startPos, startMouse: { x: e.clientX, y: e.clientY } };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setState(s => ({
        ...s,
        pos: computeDragPos(dragRef.current!.startPos, dragRef.current!.startMouse, { x: ev.clientX, y: ev.clientY }),
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const root = (e.currentTarget as HTMLElement).closest('.lb-root') as HTMLElement | null;
    const rect = root?.getBoundingClientRect();
    const startSize = {
      width: rect?.width ?? 320,
      height: rect?.height ?? 200,
    };
    resizeRef.current = { startSize, startMouse: { x: e.clientX, y: e.clientY } };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const maxH = window.innerHeight * 0.9;
      setState(s => ({
        ...s,
        size: computeResizeSize(resizeRef.current!.startSize, resizeRef.current!.startMouse, { x: ev.clientX, y: ev.clientY }, maxH),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return {
    pos: state.pos,
    size: state.size,
    dragHandleProps: {
      onMouseDown: onDragMouseDown,
    } as React.HTMLAttributes<HTMLElement>,
    resizeGripProps: {
      onMouseDown: onResizeMouseDown,
    } as React.HTMLAttributes<HTMLElement>,
  };
}
