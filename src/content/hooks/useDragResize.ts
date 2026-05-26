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

function defaultState(): DragResizeState {
  return { pos: null, size: { width: 320 } };
}

export function useDragResize(slug: string | null) {
  const [state, setState] = useState<DragResizeState>(defaultState);

  const dragRef = useRef<{
    startPos: { x: number; y: number };
    startMouse: { x: number; y: number };
    panelWidth: number;
    panelHeight: number;
  } | null>(null);

  const resizeRef = useRef<{
    startSize: { width: number; height: number };
    startMouse: { x: number; y: number };
  } | null>(null);

  const dragCleanupRef = useRef<(() => void) | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    dragCleanupRef.current?.();
    resizeCleanupRef.current?.();
    setState(defaultState());
  }, [slug]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      resizeCleanupRef.current?.();
    };
  }, []);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const root = (e.currentTarget as HTMLElement).closest('.lb-root') as HTMLElement | null;
    const rect = root?.getBoundingClientRect();
    const startPos = rect ? { x: rect.left, y: rect.top } : { x: 0, y: 0 };
    dragRef.current = {
      startPos,
      startMouse: { x: e.clientX, y: e.clientY },
      panelWidth: rect?.width ?? 320,
      panelHeight: rect?.height ?? 200,
    };
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { startPos, startMouse, panelWidth, panelHeight } = dragRef.current;
      const raw = computeDragPos(startPos, startMouse, { x: ev.clientX, y: ev.clientY });
      const pos = {
        x: Math.max(0, Math.min(window.innerWidth - panelWidth, raw.x)),
        y: Math.max(0, Math.min(window.innerHeight - panelHeight, raw.y)),
      };
      setState(s => ({ ...s, pos }));
    };
    const onUp = () => {
      dragRef.current = null;
      dragCleanupRef.current = null;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    dragCleanupRef.current = onUp;
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
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startSize, startMouse } = resizeRef.current;
      const maxH = window.innerHeight * 0.9;
      setState(s => ({
        ...s,
        size: computeResizeSize(startSize, startMouse, { x: ev.clientX, y: ev.clientY }, maxH),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      resizeCleanupRef.current = null;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    resizeCleanupRef.current = onUp;
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
