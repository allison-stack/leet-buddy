import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notifier } from '@/background/challenger/notifier';
import type { Challenge } from '@/shared/types';

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1', sender_id: 's', recipient_id: 'r',
    problem_slug: 'two-sum', problem_title: 'Two Sum',
    sender_time_ms: 60000, sender_lc_runtime_pct: null,
    sender_lc_memory_pct: null, accepted_at: null,
    recipient_time_ms: null, recipient_lc_runtime_pct: null,
    recipient_lc_memory_pct: null, state: 'pending',
    created_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-02T00:00:00Z',
    completed_at: null, winner_id: null,
    ...overrides,
  };
}

function makeStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    get: vi.fn(async (keys: string[]) =>
      Object.fromEntries(keys.map(k => [k, store[k]])),
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
  };
}

let createNotif: ReturnType<typeof vi.fn>;
let setBadgeText: ReturnType<typeof vi.fn>;
let setBadgeBg: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createNotif = vi.fn();
  setBadgeText = vi.fn();
  setBadgeBg = vi.fn();
  (globalThis as unknown as { chrome: unknown }).chrome = {
    notifications: { create: createNotif },
    action: { setBadgeText, setBadgeBackgroundColor: setBadgeBg },
  };
});

describe('Notifier.tick', () => {
  it('fires incoming notification for new pending challenge', async () => {
    const notifier = new Notifier(makeStorage());
    await notifier.tick([makeChallenge()], [], 'me');
    expect(createNotif).toHaveBeenCalledOnce();
    expect(createNotif).toHaveBeenCalledWith(
      'challenger_c1',
      expect.objectContaining({ title: '⚔️ Challenge incoming', message: 'Two Sum' }),
    );
  });

  it('does not re-fire for already-notified challenge', async () => {
    const notifier = new Notifier(makeStorage({ notified_challenge_ids: ['c1'] }));
    await notifier.tick([makeChallenge()], [], 'me');
    expect(createNotif).not.toHaveBeenCalled();
  });

  it('fires result notification for completed challenge (winner)', async () => {
    const notifier = new Notifier(makeStorage());
    const c = makeChallenge({ state: 'completed', winner_id: 'me', recipient_time_ms: 90000 });
    await notifier.tick([], [c], 'me');
    expect(createNotif).toHaveBeenCalledWith(
      'challenger_result_c1',
      expect.objectContaining({ title: '🏆 You won!' }),
    );
  });

  it('fires result notification for completed challenge (loser)', async () => {
    const notifier = new Notifier(makeStorage());
    const c = makeChallenge({ state: 'completed', winner_id: 's', recipient_time_ms: 90000 });
    await notifier.tick([], [c], 'me');
    expect(createNotif).toHaveBeenCalledWith(
      'challenger_result_c1',
      expect.objectContaining({ title: '😔 You lost' }),
    );
  });

  it('fires expired notification', async () => {
    const notifier = new Notifier(makeStorage());
    const c = makeChallenge({ state: 'expired_forfeit' });
    await notifier.tick([], [c], 'me');
    expect(createNotif).toHaveBeenCalledWith(
      'challenger_result_c1',
      expect.objectContaining({ title: '⏰ Challenge expired' }),
    );
  });

  it('sets badge text to pending count', async () => {
    const notifier = new Notifier(makeStorage());
    await notifier.tick([makeChallenge(), makeChallenge({ id: 'c2' })], [], 'me');
    expect(setBadgeText).toHaveBeenCalledWith({ text: '2' });
  });

  it('clears badge when pending is empty', async () => {
    const notifier = new Notifier(makeStorage());
    await notifier.tick([], [], 'me');
    expect(setBadgeText).toHaveBeenCalledWith({ text: '' });
  });
});

describe('Notifier.getNavSlug', () => {
  it('returns slug from nav map', async () => {
    const notifier = new Notifier(makeStorage({ notif_nav_map: { 'challenger_c1': 'two-sum' } }));
    expect(await notifier.getNavSlug('challenger_c1')).toBe('two-sum');
  });

  it('returns null when notif id not found', async () => {
    const notifier = new Notifier(makeStorage());
    expect(await notifier.getNavSlug('challenger_unknown')).toBeNull();
  });
});
