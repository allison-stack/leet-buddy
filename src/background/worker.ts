import { getState, persistTimers, buildProviderConfigs, chat } from './state';
import type { ContentToWorker, WorkerToContent } from '@/shared/messages';
import { TIMER_TICK_MS } from '@/shared/constants';

console.log('[leet-buddy] worker boot');

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('timer-tick', { periodInMinutes: TIMER_TICK_MS / 60_000 });
});

chrome.runtime.onMessage.addListener((msg: ContentToWorker, sender, sendResponse) => {
  (async () => {
    const state = await getState();
    const tabId = sender.tab?.id ?? ('tabId' in msg ? msg.tabId : undefined);
    if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
    const now = Date.now();

    switch (msg.type) {
      case 'TIMER_START':
        state.timers.start(tabId, msg.slug, msg.difficulty, durationFor(msg.difficulty), now);
        break;
      case 'TIMER_PAUSE': state.timers.pause(tabId, now); break;
      case 'TIMER_RESUME': state.timers.resume(tabId, now); break;
      case 'TIMER_RESET': state.timers.reset(tabId, now); break;
      case 'GET_TIMER_STATE': break;
      case 'MARK_SOLVED': state.timers.markSolved(tabId, now); break;
      case 'REQUEST_APPROACH_EVAL': {
        if (!state.limiter.tryAcquire(now)) {
          sendResponse({ ok: false, error: 'rate limited' });
          return;
        }
        try {
          const { approachEvalPrompt } = await import('@/llm/prompts');
          const { stripCodeBlocks } = await import('@/llm/output-filter');
          const { primary, fallback } = await buildProviderConfigs();
          const { system, user } = approachEvalPrompt(msg.payload);
          const res = await chat({ systemPrompt: system, userPrompt: user, primary, fallback, maxTokens: 250 });
          const cleaned = stripCodeBlocks(res.text);
          sendResponse({ ok: true, payload: parseApproachReply(cleaned) });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      default: break; // other message types handled in later tasks
    }
    await persistTimers(state);
    sendResponse({ ok: true, snapshot: state.timers.snapshot(tabId, now) });
  })();
  return true; // async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
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
