import type { HintRequest, ApproachEvalRequest, ApproachEvalResponse, Difficulty } from './types';

export type ContentToWorker =
  | { type: 'TIMER_START'; tabId: number; slug: string; difficulty: Difficulty }
  | { type: 'TIMER_PAUSE'; tabId: number }
  | { type: 'TIMER_RESUME'; tabId: number }
  | { type: 'TIMER_RESET'; tabId: number }
  | { type: 'GET_TIMER_STATE'; tabId: number }
  | { type: 'REQUEST_APPROACH_EVAL'; payload: ApproachEvalRequest }
  | { type: 'REQUEST_HINT'; payload: HintRequest }
  | { type: 'MARK_SOLVED'; slug: string; title: string; difficulty: Difficulty; hintTierUsed: 0 | 1 | 2 | 3 | 4 }
  | { type: 'RATE_SOLVE'; slug: string; quality: 1 | 3 | 4 | 5 }
  | { type: 'SKIP_PROBLEM'; slug: string };

export type WorkerToContent =
  | { type: 'TIMER_TICK'; tabId: number; remainingSeconds: number; status: TimerStatus }
  | { type: 'TIMER_FIRED'; tabId: number; askForApproach: boolean }
  | { type: 'APPROACH_EVAL_RESULT'; payload: ApproachEvalResponse }
  | { type: 'HINT_RESULT'; tier: 1 | 2 | 3 | 4; text: string }
  | { type: 'ERROR'; message: string };

export type TimerStatus = 'idle' | 'running' | 'paused' | 'fired' | 'solved';

export type WorkerToPopup =
  | { type: 'POPUP_STATE'; payload: PopupState };

export interface PopupState {
  todaysProblem: { slug: string; title: string; difficulty: Difficulty } | null;
  todaysProblemCompleted: boolean;
  reviewsDue: number;
  streakDays: number;
  tokensUsedToday: number;
}

export function sendToWorker<R = unknown>(msg: ContentToWorker): Promise<R> {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab<R = unknown>(tabId: number, msg: WorkerToContent): Promise<R> {
  return chrome.tabs.sendMessage(tabId, msg);
}
