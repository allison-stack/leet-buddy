import type { Difficulty, HintTier } from './types';

export const DIFFICULTY_THRESHOLDS_SECONDS: Record<Difficulty, number> = {
  easy: 180,
  medium: 300,
  hard: 600,
};

export const HINT_TIER_DESCRIPTIONS: Record<HintTier, string> = {
  1: 'Problem-category nudge',
  2: 'Name the data structure or technique',
  3: 'Pseudocode outline',
  4: 'Full approach in prose',
};

export const TIMER_TICK_MS = 15_000; // background alarm cadence
export const TIMER_UI_TICK_MS = 1_000; // content script local interval for display
export const TAB_BLUR_GRACE_MS = 30_000;
export const HINT_CACHE_MAX_ENTRIES = 200;
export const MONACO_POLL_MS = 2_000;
export const LC_DAILY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const SR_QUALITY = {
  AGAIN: 1,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
} as const;

// Supabase project — read from .env at build time, inlined by Vite.
// Set values in .env (see .env.example for shape). Safe to ship: the anon key
// is designed for client-side use; RLS enforces actual data access.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Storage key under which supabase-js persists the auth session.
export const SUPABASE_SESSION_STORAGE_KEY = 'supabase.auth.session';
