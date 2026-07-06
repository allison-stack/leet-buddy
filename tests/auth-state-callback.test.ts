import { describe, it, expect } from 'vitest';
import { GoTrueClient } from '@supabase/auth-js';

// Regression guard for the worker's onAuthStateChange subscriber (worker.ts).
//
// auth-js awaits subscriber callbacks from inside its initializePromise
// (cold start with a stored session emits SIGNED_IN / TOKEN_REFRESHED /
// SIGNED_OUT there), and every client call — getSession() first of all —
// begins with `await this.initializePromise`. A subscriber that calls back
// into the client therefore creates a circular wait that freezes the client
// permanently: init waits on the callback, the callback waits on getSession,
// getSession waits on init. Symptom: popup stuck on "Loading…" on every
// worker cold start.
//
// These tests pin both sides: the hazard exists in the installed auth-js
// (so we know the constraint is still real after upgrades), and the
// storage-only pattern the worker now uses stays deadlock-free.

const NOW = Math.floor(Date.now() / 1000);

function makeSession() {
  return {
    access_token: 'at', refresh_token: 'rt', token_type: 'bearer',
    expires_in: 3600, expires_at: NOW + 3600,
    user: { id: 'user-1', aud: 'authenticated', email: 'a@b.c', created_at: '', app_metadata: {}, user_metadata: {} },
  };
}

// chrome.storage.local resolves on a macrotask; the deadlock only manifests
// when the subscriber is registered before init's storage read completes,
// which the delay guarantees (as it does in the real worker).
function makeStorage() {
  const map = new Map<string, string>([['sb-test', JSON.stringify(makeSession())]]);
  const delay = () => new Promise((r) => setTimeout(r, 5));
  return {
    getItem: async (k: string) => { await delay(); return map.get(k) ?? null; },
    setItem: async (k: string, v: string) => { await delay(); map.set(k, v); },
    removeItem: async (k: string) => { await delay(); map.delete(k); },
  };
}

function makeClient() {
  return new GoTrueClient({
    url: 'http://localhost:9999/auth/v1',
    storageKey: 'sb-test',
    storage: makeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    fetch: (async () =>
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });
}

function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timed-out'> {
  return Promise.race([p, new Promise<'timed-out'>((r) => setTimeout(() => r('timed-out'), ms))]);
}

describe('onAuthStateChange subscriber constraints', () => {
  it('calling getSession() inside the callback deadlocks cold-start init (why the worker must not)', async () => {
    const client = makeClient();
    client.onAuthStateChange(async () => {
      await client.getSession();
    });
    const result = await raceWithTimeout(client.getSession(), 500);
    expect(result).toBe('timed-out');
  });

  it('a storage-only callback (the worker pattern) leaves getSession() responsive', async () => {
    const client = makeClient();
    const seen: Array<{ event: string; hasSession: boolean }> = [];
    client.onAuthStateChange(async (event, session) => {
      // mimic worker.ts: async storage read + message send, no supabase calls
      await new Promise((r) => setTimeout(r, 5));
      seen.push({ event, hasSession: session !== null });
    });
    const result = await raceWithTimeout(client.getSession(), 2000);
    expect(result).not.toBe('timed-out');
    const { data } = result as { data: { session: { user: { id: string } } | null } };
    expect(data.session?.user.id).toBe('user-1');
    // the callback still received the session it needs for the AUTH_STATE broadcast
    expect(seen.some((s) => s.hasSession)).toBe(true);
  });
});
