import type {
  HintRequest, ApproachEvalRequest, ApproachEvalResponse, Difficulty, Profile,
  FriendsListEntry, Challenge,
} from './types';

export type ContentToWorker =
  | { type: 'TIMER_START'; tabId: number; slug: string; difficulty: Difficulty }
  | { type: 'TIMER_PAUSE'; tabId: number }
  | { type: 'TIMER_RESUME'; tabId: number }
  | { type: 'TIMER_RESET'; tabId: number }
  | { type: 'GET_TIMER_STATE'; tabId: number }
  | { type: 'REQUEST_APPROACH_EVAL'; payload: ApproachEvalRequest }
  | { type: 'REQUEST_HINT'; payload: HintRequest }
  | { type: 'MARK_SOLVED'; slug: string; title: string; difficulty: Difficulty; hintTierUsed: 0 | 1 | 2 | 3 | 4; timeMs?: number; lcRuntimePct?: number; lcMemPct?: number }
  | { type: 'RATE_SOLVE'; slug: string; quality: 1 | 3 | 4 | 5 }
  | { type: 'SKIP_PROBLEM'; slug: string }
  | { type: 'GET_POPUP_STATE' }
  | { type: 'AUTH_SEND_OTP'; email: string }
  | { type: 'AUTH_VERIFY_OTP'; email: string; code: string }
  | { type: 'AUTH_SIGN_OUT' }
  | { type: 'GET_AUTH_STATE' }
  | { type: 'FRIENDS_LIST' }
  | { type: 'FRIEND_ADD'; target: string }
  | { type: 'FRIEND_ACCEPT'; friendshipId: string }
  | { type: 'FRIEND_REMOVE'; friendshipId: string }
  | { type: 'GET_ACTIVE_CHALLENGE'; slug: string }
  | { type: 'CHALLENGE_CREATE'; friendId: string; problemSlug: string; problemTitle: string; timeMs: number; lcRuntimePct?: number; lcMemPct?: number }
  | { type: 'CHALLENGE_ACCEPT'; challengeId: string }
  | { type: 'CHALLENGE_SUBMIT'; challengeId: string; timeMs: number; lcRuntimePct?: number; lcMemPct?: number }
  | { type: 'CHALLENGE_CANCEL'; challengeId: string }
  | { type: 'CHALLENGE_INBOX_GET' }
  | { type: 'GET_STREAK_COUNT' };

export type WorkerToContent =
  | { type: 'TIMER_TICK'; tabId: number; elapsedSeconds: number; status: TimerStatus }
  | { type: 'TIMER_FIRED'; tabId: number; askForApproach: boolean }
  | { type: 'APPROACH_EVAL_RESULT'; payload: ApproachEvalResponse }
  | { type: 'HINT_RESULT'; tier: 1 | 2 | 3 | 4; text: string }
  | { type: 'ERROR'; message: string }
  | { type: 'AUTH_STATE'; user: Profile | null }
  | { type: 'CHALLENGE_INBOX_UPDATED'; pending: Challenge[]; recent: Challenge[] }
  | { type: 'CHALLENGE_RESULT_READY'; challenge: Challenge };

export type TimerStatus = 'idle' | 'running' | 'paused' | 'fired' | 'solved';

export type WorkerToPopup =
  | { type: 'POPUP_STATE'; payload: PopupState };

export interface ReviewItem {
  slug: string;
  title: string;
  difficulty: Difficulty;
}

export interface PopupState {
  todaysProblem: { slug: string; title: string; difficulty: Difficulty } | null;
  todaysProblemCompleted: boolean;
  reviewsDue: number;
  reviewItems: ReviewItem[];
  streakDays: number;
  tokensUsedToday: number;
}

export interface FriendsListResponse {
  ok: true;
  accepted: FriendsListEntry[];
  incoming: FriendsListEntry[];
  outgoing: FriendsListEntry[];
}

export interface ActiveChallengeResponse {
  ok: true;
  challenge: Challenge | null;
  friendProfile: Profile | null;
  meId: string;
}

export interface ChallengeInboxResponse {
  ok: true;
  pending: Challenge[];
  recent: Challenge[];
}

export function sendToWorker<R = unknown>(msg: ContentToWorker): Promise<R> {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab<R = unknown>(tabId: number, msg: WorkerToContent): Promise<R> {
  return chrome.tabs.sendMessage(tabId, msg);
}
