import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, setSettings, getProblems, upsertProblem, defaultSettings } from '@/shared/storage';

const syncStore = new Map<string, unknown>();
const localStore = new Map<string, unknown>();

beforeEach(() => {
  syncStore.clear();
  localStore.clear();
  // @ts-expect-error mocking chrome
  globalThis.chrome = {
    storage: {
      sync: {
        get: (k: string) => Promise.resolve(syncStore.has(k) ? { [k]: syncStore.get(k) } : {}),
        set: (obj: Record<string, unknown>) => { Object.entries(obj).forEach(([k, v]) => syncStore.set(k, v)); return Promise.resolve(); },
      },
      local: {
        get: (k: string) => Promise.resolve(localStore.has(k) ? { [k]: localStore.get(k) } : {}),
        set: (obj: Record<string, unknown>) => { Object.entries(obj).forEach(([k, v]) => localStore.set(k, v)); return Promise.resolve(); },
      },
    },
  };
});

describe('storage', () => {
  it('returns defaultSettings when nothing is stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(defaultSettings);
  });

  it('persists and reads settings', async () => {
    await setSettings({ ...defaultSettings, apiKey: 'gsk_xxx' });
    const s = await getSettings();
    expect(s.apiKey).toBe('gsk_xxx');
  });

  it('upserts a problem record', async () => {
    await upsertProblem({
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      firstSolvedAt: 1000,
      sm2: { ease: 2.5, interval: 1, reps: 1, dueAt: 86_400_000, lastQuality: 4 },
      hintTierUsedMax: 0,
      attempts: 1,
    });
    const problems = await getProblems();
    expect(problems['two-sum']?.title).toBe('Two Sum');
  });
});
