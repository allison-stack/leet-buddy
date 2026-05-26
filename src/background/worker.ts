import { getState, persistTimers, persistCache, buildProviderConfigs, chat, recordTokens, tokensToday } from './state';
import type { ContentToWorker, WorkerToContent } from '@/shared/messages';
import type { ProblemRecord } from '@/shared/types';
import { TIMER_TICK_MS } from '@/shared/constants';
import { scheduleDailyAlarm, fireDailyReminder } from './alarms';
import { getProblems, getDailyLog, upsertProblem } from '@/shared/storage';
import { dueReviews, isoToday } from './scheduler';
import { initialSm2State, updateSm2 } from '@/shared/sm2';
import { approachEvalPrompt, hintPrompt } from '@/llm/prompts';
import { stripCodeBlocks } from '@/llm/output-filter';
import { codeHash } from './hint-cache';

console.log('[leet-buddy] worker boot');

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('timer-tick', { periodInMinutes: TIMER_TICK_MS / 60_000 });
  await scheduleDailyAlarm();
});

chrome.runtime.onMessage.addListener((msg: ContentToWorker, sender, sendResponse) => {
  (async () => {
    const state = await getState();
    const tabId = sender.tab?.id ?? ('tabId' in msg ? msg.tabId : undefined);
    const now = Date.now();

    switch (msg.type) {
      case 'GET_POPUP_STATE': {
        const problems = await getProblems();
        const log = await getDailyLog();
        const due = dueReviews(problems, now);
        const today = isoToday(now);
        const entry = log[today];
        const streak = computeStreak(log, now);
        sendResponse({
          ok: true,
          payload: {
            todaysProblem: entry ? { slug: entry.slug, title: problems[entry.slug]?.title ?? entry.slug,
                                     difficulty: problems[entry.slug]?.difficulty ?? 'medium' } : null,
            todaysProblemCompleted: !!entry?.completed,
            reviewsDue: due.length,
            streakDays: streak,
            tokensUsedToday: await tokensToday(now),
          },
        });
        return;
      }
      case 'TIMER_START':
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        state.timers.start(tabId, msg.slug, msg.difficulty, durationFor(msg.difficulty), now);
        break;
      case 'TIMER_PAUSE':
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        state.timers.pause(tabId, now); break;
      case 'TIMER_RESUME':
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        state.timers.resume(tabId, now); break;
      case 'TIMER_RESET':
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        state.timers.reset(tabId, now); break;
      case 'GET_TIMER_STATE':
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        break;
      case 'MARK_SOLVED': {
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        const all = await getProblems();
        const existing = all[msg.slug];
        const rec = existing ?? {
          slug: msg.slug, title: msg.title, difficulty: msg.difficulty,
          firstSolvedAt: now, sm2: initialSm2State(now),
          hintTierUsedMax: 0,
          attempts: 0,
        } as ProblemRecord;
        rec.attempts += 1;
        rec.hintTierUsedMax = Math.max(rec.hintTierUsedMax, msg.hintTierUsed) as ProblemRecord['hintTierUsedMax'];
        state.timers.markSolved(tabId, now);
        await upsertProblem(rec);
        await persistTimers(state);
        sendResponse({ ok: true });
        return;
      }
      case 'RATE_SOLVE': {
        const all = await getProblems();
        const rec = all[msg.slug];
        if (!rec) { sendResponse({ ok: false, error: 'unknown problem' }); return; }
        rec.sm2 = updateSm2(rec.sm2, msg.quality, now);
        await upsertProblem(rec);
        sendResponse({ ok: true });
        return;
      }
      case 'SKIP_PROBLEM': {
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        state.timers.markSolved(tabId, now);
        await persistTimers(state);
        sendResponse({ ok: true });
        return;
      }
      case 'REQUEST_APPROACH_EVAL': {
        if (!state.limiter.tryAcquire(now)) {
          sendResponse({ ok: false, error: 'rate limited' });
          return;
        }
        try {
          const { primary, fallback } = await buildProviderConfigs();
          const { system, user } = approachEvalPrompt(msg.payload);
          const res = await chat({ systemPrompt: system, userPrompt: user, primary, fallback, maxTokens: 250 });
          await recordTokens((res.tokensIn ?? 0) + (res.tokensOut ?? 0), now);
          const cleaned = stripCodeBlocks(res.text);
          sendResponse({ ok: true, payload: parseApproachReply(cleaned) });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'REQUEST_HINT': {
        if (!state.limiter.tryAcquire(now)) {
          sendResponse({ ok: false, error: 'rate limited — try again later or raise cap in settings' });
          return;
        }
        try {
          const ch = codeHash(msg.payload.userCode);
          const cached = state.cache.get(msg.payload.slug, msg.payload.tier, ch);
          if (cached) {
            sendResponse({ ok: true, payload: { text: cached } });
            return;
          }

          const { primary, fallback } = await buildProviderConfigs();
          const { system, user } = hintPrompt(msg.payload);
          const res = await chat({ systemPrompt: system, userPrompt: user, primary, fallback,
            maxTokens: msg.payload.tier === 4 ? 600 : 250 });
          await recordTokens((res.tokensIn ?? 0) + (res.tokensOut ?? 0), now);
          const cleaned = stripCodeBlocks(res.text);
          state.cache.set(msg.payload.slug, msg.payload.tier, ch, cleaned);
          await persistCache(state);
          sendResponse({ ok: true, payload: { text: cleaned } });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      default: break; // other message types handled in later tasks
    }
    await persistTimers(state);
    if (tabId !== undefined) {
      sendResponse({ ok: true, snapshot: state.timers.snapshot(tabId, now) });
    }
  })();
  return true; // async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-reminder') {
    await fireDailyReminder();
    return;
  }
  if (alarm.name !== 'timer-tick') return;
  const state = await getState();
  const now = Date.now();

  for (const [tabId] of state.timers.toJSON()) {
    const snap = state.timers.snapshot(tabId, now);
    if (!snap) continue;
    const msg: WorkerToContent = { type: 'TIMER_TICK', tabId, remainingSeconds: snap.remainingSeconds, status: snap.status };
    chrome.tabs.sendMessage(tabId, msg).catch(() => { /* tab closed */ });
    if (snap.status === 'fired') {
      const fired: WorkerToContent = { type: 'TIMER_FIRED', tabId, askForApproach: false /* refined in Task 22 */ };
      chrome.tabs.sendMessage(tabId, fired).catch(() => {});
    }
  }
  await persistTimers(state);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  state.timers.clear(tabId);
  await persistTimers(state);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && 'settings' in changes) await scheduleDailyAlarm();
});

function durationFor(difficulty: 'easy' | 'medium' | 'hard'): number {
  return { easy: 180, medium: 300, hard: 600 }[difficulty];
}

function parseApproachReply(text: string): { verdict: 'validate' | 'redirect' | 'clarify'; message: string } {
  const verdictMatch = text.match(/VERDICT:\s*(validate|redirect|clarify)/i);
  const messageMatch = text.match(/MESSAGE:\s*([\s\S]+?)(?:\n\n|$)/);
  return {
    verdict: (verdictMatch?.[1]?.toLowerCase() as 'validate' | 'redirect' | 'clarify') ?? 'clarify',
    message: messageMatch?.[1]?.trim() ?? text.trim(),
  };
}

function computeStreak(log: Record<string, { completed: boolean }>, now: number): number {
  let streak = 0;
  const d = new Date(now);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (log[key]?.completed) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
