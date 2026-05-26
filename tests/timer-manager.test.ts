import { describe, it, expect } from 'vitest';
import { TimerManager } from '@/background/timer-manager';

describe('TimerManager', () => {
  it('starts a timer for a tab with given duration', () => {
    const tm = new TimerManager();
    tm.start(1, 'two-sum', 'easy', 180, 1000);
    const s = tm.snapshot(1, 1000)!;
    expect(s.status).toBe('running');
    expect(s.remainingSeconds).toBe(180);
    expect(s.slug).toBe('two-sum');
  });

  it('counts down with elapsed time', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    expect(tm.snapshot(1, 60_000)!.remainingSeconds).toBe(120);
    expect(tm.snapshot(1, 180_000)!.status).toBe('fired');
  });

  it('pause freezes the countdown; resume keeps the remaining time', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.pause(1, 60_000);                                // 120s left
    expect(tm.snapshot(1, 120_000)!.remainingSeconds).toBe(120);
    tm.resume(1, 120_000);
    expect(tm.snapshot(1, 180_000)!.remainingSeconds).toBe(60);
  });

  it('reset returns to initial duration and running', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'medium', 300, 0);
    tm.reset(1, 100_000);
    const s = tm.snapshot(1, 100_000)!;
    expect(s.remainingSeconds).toBe(300);
    expect(s.status).toBe('running');
  });

  it('markSolved transitions to solved and freezes remaining', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.markSolved(1, 30_000);
    const s = tm.snapshot(1, 999_999)!;
    expect(s.status).toBe('solved');
    expect(s.remainingSeconds).toBe(150);
  });

  it('serializes to plain JSON and rehydrates', () => {
    const tm = new TimerManager();
    tm.start(1, 'x', 'easy', 180, 0);
    tm.pause(1, 30_000);
    const json = tm.toJSON();
    const tm2 = TimerManager.fromJSON(json);
    const s = tm2.snapshot(1, 90_000)!;
    expect(s.status).toBe('paused');
    expect(s.remainingSeconds).toBe(150);
  });
});
