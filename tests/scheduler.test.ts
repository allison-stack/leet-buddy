import { describe, it, expect } from 'vitest';
import { dueReviews, pickDaily } from '@/background/scheduler';
import type { ProblemRecord, DailyLog } from '@/shared/types';

const now = 2_000_000_000_000;
const oneDay = 86_400_000;

function rec(slug: string, dueAt: number): ProblemRecord {
  return {
    slug, title: slug, difficulty: 'easy', firstSolvedAt: 0,
    sm2: { ease: 2.5, interval: 1, reps: 1, dueAt, lastQuality: 4 },
    hintTierUsedMax: 0, attempts: 1,
  };
}

describe('dueReviews', () => {
  it('returns problems with dueAt <= now, oldest-due first', () => {
    const problems = {
      a: rec('a', now - 3 * oneDay),
      b: rec('b', now - oneDay),
      c: rec('c', now + oneDay),
    };
    const out = dueReviews(problems, now);
    expect(out.map(p => p.slug)).toEqual(['a', 'b']);
  });
});

describe('pickDaily', () => {
  it('picks oldest due review if any exist', () => {
    const problems = { a: rec('a', now - oneDay) };
    const log: DailyLog = {};
    const list = ['x', 'y', 'z'];
    const pick = pickDaily({ today: '2026-05-25', problems, log, list, now });
    expect(pick).toBe('a');
  });

  it('picks next uncompleted from list when no reviews due', () => {
    const log: DailyLog = {
      '2026-05-24': { slug: 'x', source: 'blind-75', completed: true },
    };
    const pick = pickDaily({ today: '2026-05-25', problems: {}, log, list: ['x', 'y', 'z'], now });
    expect(pick).toBe('y');
  });

  it("reuses today's already-picked problem instead of advancing", () => {
    const log: DailyLog = {
      '2026-05-25': { slug: 'q', source: 'blind-75', completed: false },
    };
    const pick = pickDaily({ today: '2026-05-25', problems: {}, log, list: ['x', 'y', 'z'], now });
    expect(pick).toBe('q');
  });
});
