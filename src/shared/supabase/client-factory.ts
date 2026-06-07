import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/shared/constants';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

// Supabase's token-refresh fetch has no built-in timeout. In an MV3 service
// worker it can hang indefinitely, holding navigator.locks and blocking every
// subsequent getSession() call. Eight seconds is generous for auth calls.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8_000);
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
