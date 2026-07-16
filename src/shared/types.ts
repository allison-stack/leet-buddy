export type Difficulty = 'easy' | 'medium' | 'hard';

export type LlmProvider = 'groq' | 'gemini' | 'anthropic' | 'openai';

export type DailySource =
  | 'lc-daily'
  | 'blind-75'
  | 'neetcode-150'
  | 'lc-75'
  | 'company';

export interface Settings {
  llm: {
    provider: LlmProvider;
    model: string;
    keyStorage: 'sync' | 'local';
    fallbackProvider?: LlmProvider;
    fallbackModel?: string;
  };
  apiKey?: string; // present only when keyStorage='sync'
  fallbackApiKey?: string;
  dailyReminder: { enabled: boolean; time: string /* HH:mm */ };
  dailySource: DailySource;
  companyTag?: string;
  timerOverrides: { easy: number; medium: number; hard: number /* seconds */ };
  substantiveCodeThreshold: number; // default 30
  hourlyRequestCap: number; // default 20
  timerSoundEnabled: boolean;
  interview?: { sessionMinutes: number };
}

export interface Sm2State {
  ease: number;
  interval: number; // days
  reps: number;
  dueAt: number; // unix ms (day boundary, UTC)
  lastQuality: 1 | 3 | 4 | 5;
}

export interface ProblemRecord {
  slug: string;
  title: string;
  difficulty: Difficulty;
  firstSolvedAt: number;
  sm2: Sm2State;
  hintTierUsedMax: 0 | 1 | 2 | 3 | 4;
  attempts: number;
  lastSolveMs?: number;
  lastSolveLcRuntimePct?: number;
  lastSolveLcMemPct?: number;
}

export interface DailyLogEntry {
  slug: string;
  source: DailySource;
  completed: boolean;
  completedAt?: number;
}

export type DailyLog = Record<string /* YYYY-MM-DD */, DailyLogEntry>;

export type HintTier = 1 | 2 | 3 | 4;

export interface HintRequest {
  slug: string;
  problemStatement: string;
  difficulty: Difficulty;
  userCode: string;
  tier: HintTier;
  priorHints: string[];
  approachText?: string;
}

export interface ApproachEvalRequest {
  slug: string;
  problemStatement: string;
  difficulty: Difficulty;
  approachText: string;
}

export type ApproachVerdict = 'validate' | 'redirect' | 'clarify';

export interface ApproachEvalResponse {
  verdict: ApproachVerdict;
  message: string;
}

import type { Database } from './supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

export type Friendship       = Database['public']['Tables']['friendships']['Row'];
export type FriendshipStatus = Database['public']['Enums']['friendship_status'];

// A flattened view of one friend (or pending counterparty) for popup rendering.
// `relation` collapses "I am user_a vs user_b" plus the pending/accepted axis
// into a single tag the UI consumes directly.
export type FriendRelation = 'accepted' | 'pending_in' | 'pending_out';

export interface FriendsListEntry {
  friendshipId: string;
  profile: Profile;
  relation: FriendRelation;
  createdAt: string;
}

// Discriminator returned by the request_friendship RPC.
export type RequestFriendshipStatus =
  | 'created'
  | 'not_found'
  | 'self'
  | 'already_pending'
  | 'already_accepted';

export type Challenge      = Database['public']['Tables']['challenges']['Row'];
export type ChallengeState = Database['public']['Enums']['challenge_state'];

export type Phase = 'timing' | 'approach' | 'hint' | 'solved';

export type InterviewPhase = 'intro' | 'clarify' | 'approach' | 'coding' | 'debrief' | 'ended';

export type InterviewAction = 'stay' | 'advance' | 'end';

export type InterviewTurnEvent = 'session_start' | 'user_turn' | 'candidate_silent' | 'code_before_approach';

export interface TranscriptEntry {
  role: 'candidate' | 'interviewer' | 'event';
  text: string;
  at: number;
}

export interface InterviewTurnRequest {
  slug: string;
  title: string;
  difficulty: Difficulty;
  problemStatement: string;
  phase: InterviewPhase;
  transcript: TranscriptEntry[];
  trigger: InterviewTurnEvent;
  code?: string;
}

export type InterviewSolveStatus = 'solved' | 'time-up' | 'ended-early';

export interface InterviewDebriefRequest {
  slug: string;
  title: string;
  difficulty: Difficulty;
  problemStatement: string;
  transcript: TranscriptEntry[];
  finalCode: string;
  solveStatus: InterviewSolveStatus;
  elapsedMs: number;
}

export interface DebriefCategory {
  name: string;
  score: 1 | 2 | 3 | 4;
  evidence: string;
  improvement: string;
}

export interface MissedQuestion {
  question: string;
  yourAnswer: string;
  correctAnswer: string;
}

export interface Debrief {
  categories: DebriefCategory[];
  missedQuestions: MissedQuestion[];
  processMisses: string[];
  spokenSummary: string;
}

export interface InterviewSessionRecord {
  slug: string;
  date: string;
  durationMs: number;
  solveStatus: InterviewSolveStatus;
  transcript: TranscriptEntry[];
  debrief: Debrief;
}
