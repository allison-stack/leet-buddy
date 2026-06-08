import { describe, it, expect } from 'vitest';
import { ChallengeManager, type ChallengeSupabase, type SelectChain, type UpdateChain } from '@/background/challenger/challenge-manager';
import type { Challenge } from '@/shared/types';

const meId     = '00000000-0000-0000-0000-000000000001';
const senderId = '00000000-0000-0000-0000-000000000002';

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    sender_id: senderId,
    recipient_id: meId,
    problem_slug: 'two-sum',
    problem_title: 'Two Sum',
    sender_time_ms: 300000,
    sender_lc_runtime_pct: null,
    sender_lc_memory_pct: null,
    accepted_at: null,
    recipient_time_ms: null,
    recipient_lc_runtime_pct: null,
    recipient_lc_memory_pct: null,
    state: 'pending',
    created_at: '2026-06-07T00:00:00Z',
    expires_at: '2026-06-08T00:00:00Z',
    completed_at: null,
    winner_id: null,
    ...overrides,
  };
}

interface StubConfig {
  rows?: Challenge[];
  rowSets?: Challenge[][];
  insertId?: string;
}

function makeStub(config: StubConfig = {}) {
  const updates: Array<{ patch: object; filters: Record<string, unknown> }> = [];
  const inserts: object[] = [];
  let callIdx = 0;

  function makeSelectChain(rows: Challenge[]): SelectChain {
    const chain: SelectChain = {
      eq: () => chain, or: () => chain, in: () => chain,
      is: () => chain,  lt: () => chain, gte: () => chain,
      order: () => chain, limit: () => chain,
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return chain;
  }

  function makeUpdateChain(patch: object): UpdateChain {
    const filters: Record<string, unknown> = {};
    const chain: UpdateChain = {
      eq: (col, val) => { filters[col] = val; return chain; },
      or: () => chain, is: () => chain, lt: () => chain,
      then: (resolve) => {
        updates.push({ patch, filters: { ...filters } });
        resolve({ error: null });
      },
    };
    return chain;
  }

  const stub: ChallengeSupabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: meId } } } }) },
    from: (_table) => ({
      select: (_cols) => {
        const rows = config.rowSets ? (config.rowSets[callIdx++] ?? []) : (config.rows ?? []);
        return makeSelectChain(rows);
      },
      insert: (row) => {
        inserts.push(row);
        return {
          select: (_cols) => ({
            single: async () => ({ data: { id: config.insertId ?? 'new-id' }, error: null }),
          }),
        };
      },
      update: (patch) => makeUpdateChain(patch),
    }),
  };

  return { stub, updates, inserts };
}

describe('ChallengeManager.submitResult', () => {
  it('recipient wins when recipient time is less than sender time', async () => {
    const { stub, updates } = makeStub({ rows: [makeChallenge({ sender_time_ms: 300000, accepted_at: '2026-06-07T01:00:00Z' })] });
    const cm = new ChallengeManager(stub);
    const result = await cm.submitResult('c1', 200000);
    expect(result.winner_id).toBe(meId);
    expect(updates[0]?.patch).toMatchObject({ winner_id: meId, state: 'completed' });
  });

  it('sender wins when recipient time is greater than sender time', async () => {
    const { stub } = makeStub({ rows: [makeChallenge({ sender_time_ms: 100000, accepted_at: '2026-06-07T01:00:00Z' })] });
    const cm = new ChallengeManager(stub);
    const result = await cm.submitResult('c1', 200000);
    expect(result.winner_id).toBe(senderId);
  });

  it('recipient wins on exact tie', async () => {
    const { stub } = makeStub({ rows: [makeChallenge({ sender_time_ms: 200000, accepted_at: '2026-06-07T01:00:00Z' })] });
    const cm = new ChallengeManager(stub);
    const result = await cm.submitResult('c1', 200000);
    expect(result.winner_id).toBe(meId);
  });
});

describe('ChallengeManager.getStreakCount', () => {
  it('counts consecutive wins from newest first', async () => {
    const { stub } = makeStub({
      rows: [
        makeChallenge({ winner_id: meId, completed_at: '2026-06-07T03:00:00Z' }),
        makeChallenge({ winner_id: meId, completed_at: '2026-06-07T02:00:00Z' }),
        makeChallenge({ winner_id: senderId, completed_at: '2026-06-07T01:00:00Z' }),
        makeChallenge({ winner_id: meId, completed_at: '2026-06-07T00:00:00Z' }),
      ],
    });
    const cm = new ChallengeManager(stub);
    expect(await cm.getStreakCount(meId)).toBe(2);
  });

  it('returns 0 when most recent result is a loss', async () => {
    const { stub } = makeStub({ rows: [makeChallenge({ winner_id: senderId })] });
    const cm = new ChallengeManager(stub);
    expect(await cm.getStreakCount(meId)).toBe(0);
  });

  it('returns 0 when no completed challenges', async () => {
    const { stub } = makeStub({ rows: [] });
    const cm = new ChallengeManager(stub);
    expect(await cm.getStreakCount(meId)).toBe(0);
  });
});

describe('ChallengeManager.getForSlug', () => {
  it('returns the first pending challenge for the slug', async () => {
    const challenge = makeChallenge({ problem_slug: 'two-sum' });
    const { stub } = makeStub({ rows: [challenge] });
    const cm = new ChallengeManager(stub);
    const result = await cm.getForSlug('two-sum');
    expect(result?.id).toBe('c1');
  });

  it('returns null when no rows', async () => {
    const { stub } = makeStub({ rows: [] });
    const cm = new ChallengeManager(stub);
    expect(await cm.getForSlug('two-sum')).toBeNull();
  });
});

describe('ChallengeManager.accept', () => {
  it('updates accepted_at for the given challenge id', async () => {
    const { stub, updates } = makeStub();
    const cm = new ChallengeManager(stub);
    await cm.accept('c1');
    expect(updates[0]?.filters['id']).toBe('c1');
    expect((updates[0]?.patch as { accepted_at: string }).accepted_at).toBeTruthy();
  });
});

describe('ChallengeManager.cancel', () => {
  it('sets state to cancelled', async () => {
    const { stub, updates } = makeStub();
    const cm = new ChallengeManager(stub);
    await cm.cancel('c1');
    expect((updates[0]?.patch as { state: string }).state).toBe('cancelled');
    expect(updates[0]?.filters['id']).toBe('c1');
  });
});

describe('ChallengeManager.create', () => {
  it('inserts a row and returns its id', async () => {
    const { stub, inserts } = makeStub({ insertId: 'new-challenge-id' });
    const cm = new ChallengeManager(stub);
    const id = await cm.create({
      friendId: senderId,
      problemSlug: 'two-sum',
      problemTitle: 'Two Sum',
      timeMs: 180000,
    });
    expect(id).toBe('new-challenge-id');
    expect((inserts[0] as { sender_id: string }).sender_id).toBe(meId);
    expect((inserts[0] as { recipient_id: string }).recipient_id).toBe(senderId);
  });
});

describe('ChallengeManager.listInbox', () => {
  it('separates pending and recent rows', async () => {
    const pending = [makeChallenge({ state: 'pending' })];
    const recent  = [makeChallenge({ id: 'c2', state: 'completed', winner_id: meId, completed_at: '2026-06-07T01:00:00Z' })];
    const { stub } = makeStub({ rowSets: [pending, recent] });
    const cm = new ChallengeManager(stub);
    const inbox = await cm.listInbox();
    expect(inbox.pending).toHaveLength(1);
    expect(inbox.recent).toHaveLength(1);
  });
});
