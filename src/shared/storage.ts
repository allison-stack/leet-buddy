import type { Settings, ProblemRecord, DailyLog } from './types';

export const defaultSettings: Settings = {
  llm: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    keyStorage: 'sync',
  },
  dailyReminder: { enabled: true, time: '09:00' },
  dailySource: 'lc-daily',
  timerOverrides: { easy: 180, medium: 300, hard: 600 },
  substantiveCodeThreshold: 30,
  hourlyRequestCap: 20,
  timerSoundEnabled: true,
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) return structuredClone(defaultSettings);
  return { ...defaultSettings, ...(settings as Partial<Settings>) };
}

export async function setSettings(s: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings: s });
}

export async function getProblems(): Promise<Record<string, ProblemRecord>> {
  const { problems } = await chrome.storage.sync.get('problems');
  return (problems as Record<string, ProblemRecord>) ?? {};
}

export async function upsertProblem(p: ProblemRecord): Promise<void> {
  const all = await getProblems();
  all[p.slug] = p;
  await chrome.storage.sync.set({ problems: all });
}

export async function getDailyLog(): Promise<DailyLog> {
  const { daily_log } = await chrome.storage.sync.get('daily_log');
  return (daily_log as DailyLog) ?? {};
}

export async function setDailyLog(log: DailyLog): Promise<void> {
  // Prune entries older than 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const pruned: DailyLog = {};
  for (const [date, entry] of Object.entries(log)) {
    if (new Date(date + 'T00:00:00Z').getTime() >= cutoff) pruned[date] = entry;
  }
  await chrome.storage.sync.set({ daily_log: pruned });
}

export async function getLocal<T>(key: string): Promise<T | undefined> {
  const res = await chrome.storage.local.get(key);
  return res[key] as T | undefined;
}

export async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

const PANEL_MINIMIZED_KEY = 'panel_minimized';

export async function getPanelMinimized(slug: string): Promise<boolean> {
  const map = await getLocal<Record<string, boolean>>(PANEL_MINIMIZED_KEY);
  return map?.[slug] === true;
}

export async function setPanelMinimized(slug: string, value: boolean): Promise<void> {
  const map = (await getLocal<Record<string, boolean>>(PANEL_MINIMIZED_KEY)) ?? {};
  if (value) {
    map[slug] = true;
  } else {
    delete map[slug];
  }
  await setLocal(PANEL_MINIMIZED_KEY, map);
}
