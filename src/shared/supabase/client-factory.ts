import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/shared/constants';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

// Token-refresh calls (/auth/v1/token?grant_type=refresh_token) can hang
// indefinitely in an MV3 service worker, holding navigator.locks and blocking
// every subsequent getSession(). Cap them tightly. All other requests (OTP,
// profile fetches, etc.) get a generous limit since they involve SMTP or DB.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isRefresh = url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');
  const ms = isRefresh ? 8_000 : 30_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const res = await chrome.storage.local.get(key);
    const v = res[key];
    return typeof v === 'string' ? v : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

export function getSupabase(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchWithTimeout },
  });
  return cached;
}
