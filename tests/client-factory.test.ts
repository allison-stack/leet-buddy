import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  // @ts-expect-error — define chrome global for vitest
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(store, obj); }),
        remove: vi.fn(async (key: string) => { delete store[key]; }),
      },
    },
  };
  // happy-dom doesn't provide WebSocket; supabase-js's createClient eagerly
  // builds a RealtimeClient that requires one. We don't use realtime in this
  // extension, but the constructor still needs a class to instantiate.
  // @ts-expect-error — stub for test env only
  globalThis.WebSocket = class { close() {} send() {} addEventListener() {} removeEventListener() {} };
  vi.resetModules();
});

describe('client-factory', () => {
  it('returns the same client instance across calls (singleton)', async () => {
    const { getSupabase } = await import('@/shared/supabase/client-factory');
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
  });

  it('uses chrome.storage.local as the auth session store', async () => {
    const { getSupabase } = await import('@/shared/supabase/client-factory');
    const sb = getSupabase();
    // supabase-js holds the configured storage adapter at this internal path.
    // We round-trip through it to verify it writes to chrome.storage.local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (sb.auth as any).storage as {
      setItem: (k: string, v: string) => Promise<void>;
      getItem: (k: string) => Promise<string | null>;
      removeItem: (k: string) => Promise<void>;
    };
    await storage.setItem('k', 'v');
    expect(store.k).toBe('v');
    expect(await storage.getItem('k')).toBe('v');
    await storage.removeItem('k');
    expect(store.k).toBeUndefined();
  });
});
