import { describe, it, expect } from 'vitest';
import { TimerManager } from '@/background/timer-manager';

describe('TimerManager snapshot elapsedMs', () => {
  it('reports elapsed time since start', () => {
    const tm = new TimerManager();
    tm.start(1, 'two-sum', 'easy', 1800, 1000);
    const snap = tm.snapshot(1, 61000);
    expect(snap?.elapsedMs).toBe(60000);
  });

  it('excludes paused time from elapsed', () => {
    const tm = new TimerManager();
    tm.start(1, 'two-sum', 'easy', 1800, 0);
    tm.pause(1, 10000);
    tm.resume(1, 20000);
    const snap = tm.snapshot(1, 50000);
    expect(snap?.elapsedMs).toBe(40000);
  });

  it('freezes elapsed when markSolved is called', () => {
    const tm = new TimerManager();
    tm.start(1, 'two-sum', 'easy', 1800, 0);
    tm.markSolved(1, 30000);
    const snap = tm.snapshot(1, 90000);
    expect(snap?.elapsedMs).toBe(30000);
  });
});
