import { describe, it, expect } from 'vitest';
import { initialSm2State, updateSm2 } from '@/shared/sm2';

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;

describe('sm2', () => {
  it('initial state has ease 2.5, reps 0, interval 0, dueAt today', () => {
    const s = initialSm2State(NOW);
    expect(s.ease).toBe(2.5);
    expect(s.reps).toBe(0);
    expect(s.interval).toBe(0);
    expect(s.dueAt).toBe(NOW);
  });

  it('q=1 (Again) resets reps to 0 and schedules tomorrow', () => {
    const start = { ease: 2.5, interval: 6, reps: 2, dueAt: NOW, lastQuality: 4 as const };
    const next = updateSm2(start, 1, NOW);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });

  it('first successful rep schedules 1 day out', () => {
    const start = initialSm2State(NOW);
    const next = updateSm2(start, 4, NOW);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.dueAt).toBe(NOW + DAY_MS);
  });

  it('second successful rep schedules 6 days out', () => {
    let s = updateSm2(initialSm2State(NOW), 4, NOW);
    s = updateSm2(s, 4, NOW);
    expect(s.reps).toBe(2);
    expect(s.interval).toBe(6);
    expect(s.dueAt).toBe(NOW + 6 * DAY_MS);
  });

  it('third+ successful rep multiplies prev interval by ease', () => {
    let s = updateSm2(initialSm2State(NOW), 4, NOW);
    s = updateSm2(s, 4, NOW);
    const s3 = updateSm2(s, 4, NOW);
    expect(s3.reps).toBe(3);
    expect(s3.interval).toBe(Math.round(6 * s.ease));
  });

  it('ease decreases on q=3, increases on q=5, floors at 1.3', () => {
    let s = initialSm2State(NOW);
    for (let i = 0; i < 20; i++) s = updateSm2(s, 3, NOW);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    let t = initialSm2State(NOW);
    t = updateSm2(t, 5, NOW);
    expect(t.ease).toBeGreaterThan(2.5);
  });
});
