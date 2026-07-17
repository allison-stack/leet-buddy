import { getState, persistTimers, persistCache, persistLimiter, persistInterviewLimiter, buildProviderConfigs, chat, recordTokens, tokensToday } from './state';
import type { ContentToWorker, WorkerToContent } from '@/shared/messages';
import type { ProblemRecord } from '@/shared/types';
import { TIMER_TICK_MS } from '@/shared/constants';
import { scheduleDailyAlarm, fireDailyReminder, listForSource } from './alarms';
import { getSettings, getProblems, getDailyLog, setDailyLog, upsertProblem, getSolveDates, addSolveDate } from '@/shared/storage';
import { dueReviews, pickDaily, isoToday } from './scheduler';
import { initialSm2State, updateSm2 } from '@/shared/sm2';
import { approachEvalPrompt, hintPrompt } from '@/llm/prompts';
import { stripCodeBlocks } from '@/llm/output-filter';
import { codeHash } from './hint-cache';
import { getSupabase } from '@/shared/supabase/client-factory';
import { Auth, resolveProfile, type AuthSupabase } from './challenger/auth';
import { Friends, type FriendsSupabase } from './challenger/friends';
import { ChallengeManager, type ChallengeSupabase } from './challenger/challenge-manager';
import { RaceTimer } from './challenger/race-timer';
import { PollAlarm } from './challenger/poll-alarm';
import { Notifier } from './challenger/notifier';
import { runInterviewTurn, runInterviewDebrief, type InterviewChatFn } from './interview';
import type { ActiveChallengeResponse, ChallengeInboxResponse } from '@/shared/messages';
import type { Profile } from '@/shared/types';


// Cast: AuthSupabase is a structurally-compatible subset of the real
// SupabaseClient. Direct assignment trips TS2589 (deep generic instantiation
// from the Database<...> chain), so we narrow at the boundary.
const sbForAuth = getSupabase() as unknown as AuthSupabase;
const auth = new Auth(sbForAuth);

// Same TS2589 dodge as sbForAuth.
const sbForFriends = getSupabase() as unknown as FriendsSupabase;
const friends = new Friends(sbForFriends);

const sbForChallenges = getSupabase() as unknown as ChallengeSupabase;
const challengeManager = new ChallengeManager(sbForChallenges);
const raceTimer = new RaceTimer();

const notifier = new Notifier(chrome.storage.local);

const pollAlarm = new PollAlarm(challengeManager, async (msg) => {
  const tabs = await chrome.tabs.query({ url: 'https://leetcode.com/problems/*' });
  for (const tab of tabs) {
    if (tab.id != null) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}, notifier);

// Broadcast auth state changes to any listening popups / content scripts.
// MUST NOT call back into supabase here (getSession, getCurrentUser, table
// queries): auth-js awaits subscriber callbacks while initializePromise is
// still pending, and every client call starts by awaiting initializePromise.
// Calling back in creates a circular wait that permanently freezes the auth
// client on any worker cold start with a stored session — every getSession()
// hangs and the popup sticks on "Loading…". See tests/auth-state-callback.test.ts.
sbForAuth.auth.onAuthStateChange(async (_event, session) => {
  const cached = await chrome.storage.local.get('cached_profile');
  const user = session
    ? resolveProfile(session.user, cached['cached_profile'] as Profile | undefined)
    : null;
  chrome.runtime.sendMessage({ type: 'AUTH_STATE', user }).catch(() => { /* no popup open */ });
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  const slug = await notifier.getNavSlug(notifId);
  if (slug) void chrome.tabs.create({ url: `https://leetcode.com/problems/${slug}/` });
  void chrome.notifications.clear(notifId);
});

chrome.notifications.onButtonClicked.addListener(async (notifId) => {
  const slug = await notifier.getNavSlug(notifId);
  if (slug) void chrome.tabs.create({ url: `https://leetcode.com/problems/${slug}/` });
  void chrome.notifications.clear(notifId);
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('timer-tick', { periodInMinutes: TIMER_TICK_MS / 60_000 });
  chrome.alarms.create('pollChallenges', { periodInMinutes: 1 });
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
        let entry = log[today];
        if (!entry) {
          const settings = await getSettings();
          const list = await listForSource(settings.dailySource);
          const slug = pickDaily({ today, problems, log, list, now });
          if (slug) {
            entry = { slug, source: settings.dailySource, completed: false };
            log[today] = entry;
            await setDailyLog(log);
          }
        }
        const solveDates = await getSolveDates();
        const streak = computeStreak(solveDates, now);
        sendResponse({
          ok: true,
          payload: {
            todaysProblem: entry ? { slug: entry.slug, title: problems[entry.slug]?.title ?? entry.slug,
                                     difficulty: problems[entry.slug]?.difficulty ?? 'medium' } : null,
            todaysProblemCompleted: !!entry?.completed,
            reviewsDue: due.length,
            reviewItems: due.map(p => ({ slug: p.slug, title: p.title, difficulty: p.difficulty })),
            streakDays: streak,
            tokensUsedToday: await tokensToday(now),
          },
        });
        return;
      }
      case 'TIMER_START': {
        if (tabId === undefined) { sendResponse({ ok: false, error: 'no tabId' }); return; }
        const settings = await getSettings();
        state.timers.start(tabId, msg.slug, msg.difficulty, settings.timerOverrides[msg.difficulty], now);
        await persistTimers(state);
        sendResponse({ ok: true, snapshot: state.timers.snapshot(tabId, now) });
        return;
      }
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
        if (msg.timeMs !== undefined) {
          rec.lastSolveMs = msg.timeMs;
          rec.lastSolveLcRuntimePct = msg.lcRuntimePct;
          rec.lastSolveLcMemPct = msg.lcMemPct;
        }
        state.timers.markSolved(tabId, now);
        await upsertProblem(rec);
        await persistTimers(state);
        await addSolveDate(isoToday(now));

        const solveLog = await getDailyLog();
        const solveToday = isoToday(now);
        const todayEntry = solveLog[solveToday];
        if (todayEntry && todayEntry.slug === msg.slug && !todayEntry.completed) {
          todayEntry.completed = true;
          todayEntry.completedAt = now;
          await setDailyLog(solveLog);
        }

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
      case 'INTERVIEW_TURN': {
        if (!state.interviewLimiter.tryAcquire(now)) {
          sendResponse({ ok: false, error: 'interview rate limited — wait a few minutes' });
          return;
        }
        await persistInterviewLimiter(state);
        try {
          const { primary, fallback } = await buildProviderConfigs();
          const chatFn: InterviewChatFn = async args => {
            const res = await chat({ systemPrompt: args.systemPrompt, userPrompt: args.userPrompt, maxTokens: args.maxTokens, primary, fallback });
            await recordTokens((res.tokensIn ?? 0) + (res.tokensOut ?? 0), now);
            return { text: res.text };
          };
          const reply = await runInterviewTurn(msg.payload, chatFn);
          sendResponse({ ok: true, ...reply });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'INTERVIEW_DEBRIEF': {
        if (!state.interviewLimiter.tryAcquire(now)) {
          sendResponse({ ok: false, error: 'interview rate limited — wait a few minutes' });
          return;
        }
        await persistInterviewLimiter(state);
        try {
          const { primary, fallback } = await buildProviderConfigs();
          const chatFn: InterviewChatFn = async args => {
            const res = await chat({ systemPrompt: args.systemPrompt, userPrompt: args.userPrompt, maxTokens: args.maxTokens, primary, fallback });
            await recordTokens((res.tokensIn ?? 0) + (res.tokensOut ?? 0), now);
            return { text: res.text };
          };
          const debrief = await runInterviewDebrief(msg.payload, chatFn);
          sendResponse({ ok: true, debrief });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'AUTH_SEND_OTP': {
        const result = await auth.sendOtp(msg.email);
        sendResponse(result);
        return;
      }
      case 'AUTH_VERIFY_OTP': {
        const result = await auth.verifyOtp(msg.email, msg.code);
        if (result.ok && result.user) {
          await chrome.storage.local.set({ cached_profile: result.user });
        }
        sendResponse(result);
        return;
      }
      case 'AUTH_SIGN_OUT': {
        await auth.signOut();
        await chrome.storage.local.remove('cached_profile');
        sendResponse({ ok: true });
        return;
      }
      case 'GET_AUTH_STATE': {
        try {
          const { data } = await sbForAuth.auth.getSession();
          if (!data.session) {
            sendResponse({ ok: true, user: null });
          } else {
            const cached = await chrome.storage.local.get('cached_profile');
            const user = resolveProfile(data.session.user, cached['cached_profile'] as Profile | undefined);
            sendResponse({ ok: true, user });
          }
        } catch {
          sendResponse({ ok: true, user: null });
        }
        return;
      }
      case 'FRIENDS_LIST': {
        try {
          const list = await friends.list();
          sendResponse({ ok: true, ...list });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'FRIEND_ADD': {
        try {
          const result = await friends.add(msg.target);
          sendResponse({ ok: true, ...result });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'FRIEND_ACCEPT': {
        try {
          await friends.accept(msg.friendshipId);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'FRIEND_REMOVE': {
        try {
          await friends.remove(msg.friendshipId);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'GET_ACTIVE_CHALLENGE': {
        try {
          const challenge = await challengeManager.getForSlug(msg.slug);
          if (!challenge) {
            sendResponse({ ok: true, challenge: null, friendProfile: null, meId: '' } satisfies ActiveChallengeResponse);
            return;
          }
          const { data: sessionData } = await sbForAuth.auth.getSession();
          const meId = sessionData?.session?.user.id ?? '';
          const friendId = challenge.sender_id === meId ? challenge.recipient_id : challenge.sender_id;
          const friendProfile = await fetchProfile(friendId);
          sendResponse({ ok: true, challenge, friendProfile, meId } satisfies ActiveChallengeResponse);
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'CHALLENGE_CREATE': {
        try {
          const id = await challengeManager.create({
            friendId: msg.friendId,
            problemSlug: msg.problemSlug,
            problemTitle: msg.problemTitle,
            timeMs: msg.timeMs,
            lcRuntimePct: msg.lcRuntimePct,
            lcMemPct: msg.lcMemPct,
          });
          sendResponse({ ok: true, challengeId: id });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'CHALLENGE_ACCEPT': {
        try {
          await challengeManager.accept(msg.challengeId);
          if (tabId !== undefined) {
            await raceTimer.start(tabId, msg.challengeId, Date.now());
          }
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'CHALLENGE_SUBMIT': {
        try {
          const challenge = await challengeManager.submitResult(
            msg.challengeId, msg.timeMs, msg.lcRuntimePct, msg.lcMemPct,
          );
          if (tabId !== undefined) await raceTimer.stop(tabId);
          sendResponse({ ok: true, challenge });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'CHALLENGE_CANCEL': {
        try {
          await challengeManager.cancel(msg.challengeId);
          if (tabId !== undefined) await raceTimer.stop(tabId);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'CHALLENGE_INBOX_GET': {
        try {
          const inbox = await challengeManager.listInbox();
          sendResponse({ ok: true, ...inbox } satisfies ChallengeInboxResponse);
        } catch (e) {
          sendResponse({ ok: false, error: (e as Error).message });
        }
        return;
      }
      case 'GET_STREAK_COUNT': {
        try {
          const { data: sessData } = await sbForAuth.auth.getSession();
          const uid = sessData?.session?.user.id ?? '';
          const streak = await challengeManager.getStreakCount(uid);
          sendResponse({ ok: true, streak });
        } catch {
          sendResponse({ ok: true, streak: 0 });
        }
        return;
      }
      default: break; // other message types handled in later tasks
    }
    await persistTimers(state);
    if (tabId !== undefined) {
      sendResponse({ ok: true, snapshot: state.timers.snapshot(tabId, now) });
    }
  })().catch(() => {
    sendResponse({ ok: false, error: 'internal error' });
  });
  return true; // async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-reminder') {
    await fireDailyReminder();
    return;
  }
  if (alarm.name === 'pollChallenges') {
    const { data } = await sbForAuth.auth.getSession();
    const meId = data?.session?.user.id ?? '';
    void pollAlarm.tick(meId);
    return;
  }
  if (alarm.name !== 'timer-tick') return;
  const state = await getState();
  const now = Date.now();

  for (const [tabId] of state.timers.toJSON()) {
    const snap = state.timers.snapshot(tabId, now);
    if (!snap) continue;
    const msg: WorkerToContent = { type: 'TIMER_TICK', tabId, elapsedSeconds: snap.elapsedSeconds, status: snap.status };
    chrome.tabs.sendMessage(tabId, msg).catch(() => { /* tab closed */ });
    if (snap.status === 'fired' && state.timers.consumeFiredEvent(tabId)) {
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

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const result = await (getSupabase() as unknown as {
      from(t: string): {
        select(c: string): { eq(col: string, val: string): Promise<{ data: unknown[] | null }> };
      };
    }).from('profiles').select('*').eq('id', userId);
    return (result.data?.[0] as Profile) ?? null;
  } catch {
    return null;
  }
}


function parseApproachReply(text: string): { verdict: 'validate' | 'redirect' | 'clarify'; message: string } {
  const verdictMatch = text.match(/VERDICT:\s*(validate|redirect|clarify)/i);
  const messageMatch = text.match(/MESSAGE:\s*([\s\S]+?)(?:\n\n|$)/);
  return {
    verdict: (verdictMatch?.[1]?.toLowerCase() as 'validate' | 'redirect' | 'clarify') ?? 'clarify',
    message: messageMatch?.[1]?.trim() ?? text.trim(),
  };
}

function computeStreak(solveDates: string[], now: number): number {
  const dateSet = new Set(solveDates);
  let streak = 0;
  const d = new Date(now);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (dateSet.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
