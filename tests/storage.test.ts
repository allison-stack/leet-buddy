import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, setSettings, getProblems, upsertProblem, defaultSettings, appendInterviewSession, getInterviewSessions } from '@/shared/storage';
import { INTERVIEW_HISTORY_MAX } from '@/shared/constants';
import type { InterviewSessionRecord } from '@/shared/types';

const syncStore = new Map<string, unknown>();
const localStore = new Map<string, unknown>();

beforeEach(() => {
  syncStore.clear();
  localStore.clear();
  const mockArea = (store: Map<string, unknown>) => ({
    get: (k: string) => Promise.resolve(store.has(k) ? { [k]: store.get(k) } : {}),
    set: (obj: Record<string, unknown>) => {
      Object.entries(obj).forEach(([k, v]) => store.set(k, v));
      return Promise.resolve();
    },
  });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { sync: mockArea(syncStore), local: mockArea(localStore) },
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

describe('interview sessions', () => {
  const record = (slug: string): InterviewSessionRecord => ({
    slug, date: '2026-07-16', durationMs: 60_000, solveStatus: 'solved',
    transcript: [], debrief: { categories: [], missedQuestions: [], processMisses: [], spokenSummary: 's' },
  });

  it('appends and reads back', async () => {
    await appendInterviewSession(record('two-sum'));
    await appendInterviewSession(record('three-sum'));
    const list = await getInterviewSessions();
    expect(list.map(r => r.slug)).toEqual(['two-sum', 'three-sum']);
  });

  it('keeps only the most recent INTERVIEW_HISTORY_MAX', async () => {
    for (let i = 0; i < INTERVIEW_HISTORY_MAX + 5; i++) await appendInterviewSession(record(`p${i}`));
    const list = await getInterviewSessions();
    expect(list).toHaveLength(INTERVIEW_HISTORY_MAX);
    expect(list[0]?.slug).toBe('p5');
  });
});
