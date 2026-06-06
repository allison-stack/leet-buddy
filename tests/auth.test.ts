import { describe, it, expect } from 'vitest';
import { Auth, type AuthSupabase } from '@/background/challenger/auth';
import type { Profile } from '@/shared/types';

function makeStub() {
  const profilesById: Record<string, Profile> = {};
  const profilesByHandle: Record<string, Profile> = {};

  const calls: {
    signInWithOtp: unknown[];
    verifyOtp: unknown[];
    signOut: number;
    inserts: unknown[];
  } = { signInWithOtp: [], verifyOtp: [], signOut: 0, inserts: [] };

  let nextVerify: { id: string; email: string } | { error: string } | null = null;

  const stub: AuthSupabase = {
    auth: {
      signInWithOtp: async (args) => {
        calls.signInWithOtp.push(args);
        return { error: null };
      },
      verifyOtp: async (args) => {
        calls.verifyOtp.push(args);
        if (!nextVerify) throw new Error('no programmed response');
        if ('error' in nextVerify) {
          return { data: { user: null }, error: new Error(nextVerify.error) };
        }
        return { data: { user: { id: nextVerify.id, email: nextVerify.email } }, error: null };
      },
      signOut: async () => {
        calls.signOut++;
        return { error: null };
      },
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: async () => {
              if (col === 'id') return { data: profilesById[val] ?? null, error: null };
              if (col === 'handle') return { data: profilesByHandle[val] ?? null, error: null };
              throw new Error(`unexpected eq column ${col}`);
            },
          }),
        }),
        insert: (row) => ({
          select: () => ({
            single: async () => {
              calls.inserts.push(row);
              if (profilesByHandle[row.handle]) {
                return {
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                };
              }
              const created: Profile = { ...row, created_at: new Date().toISOString() } as Profile;
              profilesById[row.id] = created;
              profilesByHandle[row.handle] = created;
              return { data: created, error: null };
            },
          }),
        }),
      };
    },
  };

  return {
    stub,
    calls,
    profilesById,
    profilesByHandle,
    setNextVerify: (r: typeof nextVerify) => { nextVerify = r; },
  };
}

describe('Auth.sendOtp', () => {
  it('calls supabase signInWithOtp with shouldCreateUser=true', async () => {
    const { stub, calls } = makeStub();
    const auth = new Auth(stub);
    const result = await auth.sendOtp('alice@example.com');
    expect(result.ok).toBe(true);
    expect(calls.signInWithOtp).toEqual([
      { email: 'alice@example.com', options: { shouldCreateUser: true } },
    ]);
  });
});

describe('Auth.verifyOtp', () => {
  it('on success, creates a profile if none exists and returns it', async () => {
    const { stub, calls, profilesById, setNextVerify } = makeStub();
    setNextVerify({ id: 'user-1', email: 'alice@example.com' });
    const auth = new Auth(stub);
    const result = await auth.verifyOtp('alice@example.com', '123456');
    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe('user-1');
    expect(result.user?.handle).toBe('alice');
    expect(result.user?.display_name).toBe('alice');
    expect(profilesById['user-1']).toBeDefined();
    expect(calls.inserts).toHaveLength(1);
  });

  it('returns the existing profile without re-inserting if one is already present', async () => {
    const { stub, calls, profilesById, profilesByHandle, setNextVerify } = makeStub();
    const existing = {
      id: 'user-1', handle: 'alice', display_name: 'Alice',
      avatar_color: 'hsl(0, 65%, 50%)', created_at: 't',
    } as Profile;
    profilesById['user-1'] = existing;
    profilesByHandle['alice'] = existing;

    setNextVerify({ id: 'user-1', email: 'alice@example.com' });
    const auth = new Auth(stub);
    const result = await auth.verifyOtp('alice@example.com', '123456');
    expect(result.ok).toBe(true);
    expect(result.user?.display_name).toBe('Alice');
    expect(calls.inserts).toHaveLength(0);
  });

  it('retries with a suffixed handle when the derived handle is already taken', async () => {
    const { stub, profilesById, profilesByHandle, setNextVerify } = makeStub();
    profilesByHandle['alice'] = {
      id: 'other', handle: 'alice', display_name: 'Other',
      avatar_color: 'x', created_at: 't',
    } as Profile;
    setNextVerify({ id: 'user-1', email: 'alice@example.com' });
    const auth = new Auth(stub);
    const result = await auth.verifyOtp('alice@example.com', '123456');
    expect(result.ok).toBe(true);
    expect(result.user?.handle).toMatch(/^alice-[a-z0-9]{6}$/);
    expect(profilesById['user-1']).toBeDefined();
  });

  it('returns an error result when verifyOtp fails', async () => {
    const { stub, setNextVerify } = makeStub();
    setNextVerify({ error: 'invalid code' });
    const auth = new Auth(stub);
    const result = await auth.verifyOtp('alice@example.com', '000000');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid code');
  });
});

describe('Auth.signOut', () => {
  it('calls supabase signOut', async () => {
    const { stub, calls } = makeStub();
    const auth = new Auth(stub);
    await auth.signOut();
    expect(calls.signOut).toBe(1);
  });
});
