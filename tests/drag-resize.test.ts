import { describe, it, expect } from 'vitest';
import {
  clampWidth,
  clampHeight,
  computeDragPos,
  computeResizeSize,
} from '@/content/hooks/useDragResize';

describe('clampWidth', () => {
  it('returns value unchanged when within bounds', () => {
    expect(clampWidth(320)).toBe(320);
  });
  it('clamps to minimum', () => {
    expect(clampWidth(100)).toBe(240);
  });
  it('clamps to maximum', () => {
    expect(clampWidth(800)).toBe(600);
  });
});

describe('clampHeight', () => {
  it('returns value unchanged when within bounds', () => {
    expect(clampHeight(200, 800)).toBe(200);
  });
  it('clamps to minimum', () => {
    expect(clampHeight(20, 800)).toBe(80);
  });
  it('clamps to maximum', () => {
    expect(clampHeight(900, 800)).toBe(800);
  });
});

describe('computeDragPos', () => {
  it('offsets position by mouse delta', () => {
    const result = computeDragPos(
      { x: 100, y: 200 },
      { x: 150, y: 250 },
      { x: 170, y: 260 }
    );
    expect(result).toEqual({ x: 120, y: 210 });
  });
  it('allows negative delta (moving left/up)', () => {
    const result = computeDragPos(
      { x: 100, y: 200 },
      { x: 150, y: 250 },
      { x: 130, y: 240 }
    );
    expect(result).toEqual({ x: 80, y: 190 });
  });
});

describe('computeResizeSize', () => {
  it('grows by mouse delta', () => {
    const result = computeResizeSize(
      { width: 320, height: 200 },
      { x: 400, y: 400 },
      { x: 450, y: 430 },
      800
    );
    expect(result).toEqual({ width: 370, height: 230 });
  });
  it('clamps width at minimum', () => {
    const result = computeResizeSize(
      { width: 320, height: 200 },
      { x: 400, y: 400 },
      { x: 200, y: 400 },
      800
    );
    expect(result.width).toBe(240);
  });
  it('clamps height at maximum', () => {
    const result = computeResizeSize(
      { width: 320, height: 700 },
      { x: 400, y: 400 },
      { x: 400, y: 500 },
      750
    );
    expect(result.height).toBe(750);
  });
});
