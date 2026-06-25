import { getSettings, getProblems, getDailyLog, setDailyLog } from '@/shared/storage';
import { BLIND_75 } from './lists/blind-75';
import { NEETCODE_150 } from './lists/neetcode-150';
import { LC_75 } from './lists/lc-75';
import { getDailySlug } from './lists/lc-daily';
import { pickDaily, isoToday } from './scheduler';
import type { DailySource } from '@/shared/types';

const ALARM_NAME = 'daily-reminder';

export async function scheduleDailyAlarm(): Promise<void> {
  const settings = await getSettings();
  if (!settings.dailyReminder.enabled) {
    chrome.alarms.clear(ALARM_NAME);
    return;
  }
  const [hh, mm] = settings.dailyReminder.time.split(':').map(Number) as [number, number];
  const next = nextOccurrence(hh, mm, Date.now());
  await chrome.alarms.create(ALARM_NAME, { when: next, periodInMinutes: 24 * 60 });
}

export function nextOccurrence(hh: number, mm: number, now: number): number {
  const d = new Date(now);
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export async function listForSource(source: DailySource): Promise<string[]> {
  switch (source) {
    case 'blind-75': return BLIND_75;
    case 'neetcode-150': return NEETCODE_150;
    case 'lc-75': return LC_75;
    case 'lc-daily': {
      const s = await getDailySlug();
      return s ? [s] : [];
    }
    case 'company':
      // v1 limitation: scraping LC's company-tag pages requires the user's Premium session
      // and is fragile. v1 returns an empty list; the Options page surfaces this so the user
      // picks another source.
      return [];
  }
}

export async function fireDailyReminder(now: number = Date.now()): Promise<void> {
  const settings = await getSettings();
  const problems = await getProblems();
  const log = await getDailyLog();
  const list = await listForSource(settings.dailySource);
  const today = isoToday(now);

  const slug = pickDaily({ today, problems, log, list, now });
  if (!slug) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('public/icons/128.png'),
      title: 'Leet Buddy',
      message: 'No problem available today — check your list source in settings.',
    });
    return;
  }

  log[today] = { slug, source: settings.dailySource, completed: false };
  await setDailyLog(log);

  const meta = problems[slug];
  chrome.notifications.create('leet-buddy-daily', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/icons/128.png'),
    title: "Leet Buddy — today's problem",
    message: meta ? `${meta.title} (${meta.difficulty})` : slug,
    buttons: [{ title: 'Open' }],
  });
}

chrome.notifications.onButtonClicked.addListener(async (id) => {
  if (id !== 'leet-buddy-daily') return;
  const log = await getDailyLog();
  const today = isoToday(Date.now());
  const slug = log[today]?.slug;
  if (slug) chrome.tabs.create({ url: `https://leetcode.com/problems/${slug}/` });
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (id !== 'leet-buddy-daily') return;
  const log = await getDailyLog();
  const today = isoToday(Date.now());
  const slug = log[today]?.slug;
  if (slug) chrome.tabs.create({ url: `https://leetcode.com/problems/${slug}/` });
});
