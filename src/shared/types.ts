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
