import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RaceTimer } from '@/background/challenger/race-timer';

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  (globalThis as unknown as { chrome: object }).chrome = {
    storage: {
      local: {
        get: async (keys: string[]) => Object.fromEntries(keys.map(k => [k, store[k]])),
        set: async (items: Record<string, unknown>) => { Object.assign(store, items); },
        remove: async (keys: string[]) => { keys.forEach(k => delete store[k]); },
      },
    },
  };
});

describe('RaceTimer', () => {
  it('start persists acceptedAt to storage', async () => {
    const rt = new RaceTimer();
    await rt.start(42, 'challenge-id', 1000000);
    const entry = await rt.get(42);
    expect(entry).toEqual({ challengeId: 'challenge-id', acceptedAt: 1000000 });
  });

  it('get returns null when no entry', async () => {
    const rt = new RaceTimer();
    expect(await rt.get(42)).toBeNull();
  });

  it('stop removes the entry', async () => {
    const rt = new RaceTimer();
    await rt.start(42, 'challenge-id', 1000000);
    await rt.stop(42);
    expect(await rt.get(42)).toBeNull();
  });

  it('start overwrites an existing entry', async () => {
    const rt = new RaceTimer();
    await rt.start(42, 'old-id', 1000000);
    await rt.start(42, 'new-id', 2000000);
    const entry = await rt.get(42);
    expect(entry?.challengeId).toBe('new-id');
  });
});
