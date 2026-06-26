import { describe, it, expect } from 'vitest';
import { TimerManager } from '@/background/timer-manager';

describe('TimerManager', () => {
  it('starts a timer for a tab with given threshold', () => {
    const tm = new TimerManager();
    tm.start(1, 'two-sum', 'easy', 180, 1000);
    const s = tm.snapshot(1, 1000)!;
    expect(s.status).toBe('running');
    expect(s.elapsedSeconds).toBe(0);
    expect(s.thresholdSeconds).toBe(180);
    expect(s.slug).toBe('two-sum');
  });

  it('counts up and fires at threshold', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    expect(tm.snapshot(1, 60_000)!.elapsedSeconds).toBe(60);
    expect(tm.snapshot(1, 60_000)!.status).toBe('running');
    expect(tm.snapshot(1, 180_000)!.elapsedSeconds).toBe(180);
    expect(tm.snapshot(1, 180_000)!.status).toBe('fired');
  });

  it('pause freezes elapsed time; resume continues', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.pause(1, 60_000);                                // 60s elapsed
    expect(tm.snapshot(1, 120_000)!.elapsedSeconds).toBe(60);
    tm.resume(1, 120_000);
    expect(tm.snapshot(1, 180_000)!.elapsedSeconds).toBe(120);
  });

  it('reset returns to zero elapsed and running', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'medium', 300, 0);
    tm.reset(1, 100_000);
    const s = tm.snapshot(1, 100_000)!;
    expect(s.elapsedSeconds).toBe(0);
    expect(s.status).toBe('running');
  });

  it('markSolved transitions to solved and freezes elapsed', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.markSolved(1, 30_000);
    const s = tm.snapshot(1, 999_999)!;
    expect(s.status).toBe('solved');
    expect(s.elapsedSeconds).toBe(30);
  });

  it('consumeFiredEvent returns true once per fired transition', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    expect(tm.consumeFiredEvent(1)).toBe(true);
    expect(tm.consumeFiredEvent(1)).toBe(false);
    tm.reset(1, 1000);
    expect(tm.consumeFiredEvent(1)).toBe(true);
    expect(tm.consumeFiredEvent(1)).toBe(false);
  });

  it('consumeFiredEvent returns false for unknown tab', () => {
    const tm = new TimerManager();
    expect(tm.consumeFiredEvent(42)).toBe(false);
  });

  it('serializes to plain JSON and rehydrates', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.pause(1, 30_000);
    const json = tm.toJSON();
    const tm2 = TimerManager.fromJSON(json);
    const s = tm2.snapshot(1, 90_000)!;
    expect(s.status).toBe('paused');
    expect(s.elapsedSeconds).toBe(30);
  });
});
