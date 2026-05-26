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
