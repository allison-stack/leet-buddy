import { describe, it, expect } from 'vitest';
import { Friends, type FriendsSupabase, type FriendshipRowWithProfiles } from '@/background/challenger/friends';
import type { Profile, FriendsListEntry } from '@/shared/types';

const meId = '00000000-0000-0000-0000-00000000000a';
const otherId = '00000000-0000-0000-0000-00000000000b';

const meProfile: Profile = {
  id: meId, handle: 'me', display_name: 'Me', avatar_color: 'hsl(0, 65%, 50%)', created_at: 't',
};
const otherProfile: Profile = {
  id: otherId, handle: 'alex', display_name: 'Alex', avatar_color: 'hsl(120, 65%, 50%)', created_at: 't',
};

function makeStub(opts: {
  rows?: FriendshipRowWithProfiles[];
  rpcResult?: { status: string; friendship_id?: string };
  affectedRows?: number;
} = {}) {
  const rows: FriendshipRowWithProfiles[] = opts.rows ?? [];
  const affectedRows = opts.affectedRows ?? 1;
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const updates: Array<{ id: string; patch: unknown }> = [];
  const deletes: Array<{ id: string }> = [];

  const stub: FriendsSupabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: meId } } } }),
    },
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: opts.rpcResult ?? null, error: null };
    },
    from: (table) => {
      if (table !== 'friendships') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          // Simulate PostgREST returning embedded profiles.
          then: (resolve: (r: { data: FriendshipRowWithProfiles[]; error: null }) => void) =>
            resolve({ data: rows, error: null }),
        }),
        update: (patch: unknown) => ({
          eq: (_col: string, id: string) => ({
            select: () => ({
              then: (resolve: (r: { data: { id: string }[]; error: null }) => void) => {
                updates.push({ id, patch });
                resolve({ data: Array.from({ length: affectedRows }, () => ({ id })), error: null });
              },
            }),
          }),
        }),
        delete: () => ({
          eq: (_col: string, id: string) => ({
            select: () => ({
              then: (resolve: (r: { data: { id: string }[]; error: null }) => void) => {
                deletes.push({ id });
                resolve({ data: Array.from({ length: affectedRows }, () => ({ id })), error: null });
              },
            }),
          }),
        }),
      };
    },
  };

  return { stub, rpcCalls, updates, deletes };
}

describe('Friends.list', () => {
  it('groups rows into accepted / incoming / outgoing relative to me', async () => {
    const { stub } = makeStub({
      rows: [
        // accepted friendship with alex
        {
          id: 'f1', user_a: meId < otherId ? meId : otherId, user_b: meId < otherId ? otherId : meId,
          status: 'accepted', requested_by: meId, created_at: 't',
          user_a_profile: meId < otherId ? meProfile : otherProfile,
          user_b_profile: meId < otherId ? otherProfile : meProfile,
        },
        // pending request sent BY me (outgoing)
        {
          id: 'f2', user_a: meId, user_b: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          status: 'pending', requested_by: meId, created_at: 't',
          user_a_profile: meProfile,
          user_b_profile: { ...otherProfile, id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', handle: 'mira' },
        },
        // pending request sent TO me (incoming)
        {
          id: 'f3', user_a: '11111111-1111-1111-1111-111111111111', user_b: meId,
          status: 'pending', requested_by: '11111111-1111-1111-1111-111111111111', created_at: 't',
          user_a_profile: { ...otherProfile, id: '11111111-1111-1111-1111-111111111111', handle: 'sam' },
          user_b_profile: meProfile,
        },
      ],
    });

    const friends = new Friends(stub);
    const list = await friends.list();

    expect(list.accepted).toHaveLength(1);
    expect(list.accepted[0]?.profile.handle).toBe('alex');
    expect(list.accepted[0]?.relation).toBe('accepted');

    expect(list.outgoing).toHaveLength(1);
    expect(list.outgoing[0]?.profile.handle).toBe('mira');
    expect(list.outgoing[0]?.relation).toBe('pending_out');

    expect(list.incoming).toHaveLength(1);
    expect(list.incoming[0]?.profile.handle).toBe('sam');
    expect(list.incoming[0]?.relation).toBe('pending_in');
  });

  it('returns empty groups when no rows', async () => {
    const { stub } = makeStub({ rows: [] });
    const friends = new Friends(stub);
    const list = await friends.list();
    expect(list).toEqual<{
      accepted: FriendsListEntry[]; incoming: FriendsListEntry[]; outgoing: FriendsListEntry[];
    }>({ accepted: [], incoming: [], outgoing: [] });
  });
});

describe('Friends.add', () => {
  it('invokes the request_friendship RPC and returns its status', async () => {
    const { stub, rpcCalls } = makeStub({ rpcResult: { status: 'created', friendship_id: 'f-new' } });
    const friends = new Friends(stub);
    const res = await friends.add('alex@example.com');
    expect(rpcCalls).toEqual([{ fn: 'request_friendship', args: { target: 'alex@example.com' } }]);
    expect(res).toEqual({ status: 'created', friendshipId: 'f-new' });
  });

  it('passes the not_found status through verbatim', async () => {
    const { stub } = makeStub({ rpcResult: { status: 'not_found' } });
    const friends = new Friends(stub);
    const res = await friends.add('nobody@example.com');
    expect(res).toEqual({ status: 'not_found' });
  });
});

describe('Friends.accept', () => {
  it('updates the row to accepted', async () => {
    const { stub, updates } = makeStub();
    const friends = new Friends(stub);
    await friends.accept('f3');
    expect(updates).toEqual([{ id: 'f3', patch: { status: 'accepted' } }]);
  });

  it('throws when zero rows are affected', async () => {
    const { stub } = makeStub({ affectedRows: 0 });
    const friends = new Friends(stub);
    await expect(friends.accept('f3')).rejects.toThrow('Could not accept');
  });
});

describe('Friends.remove', () => {
  it('deletes the row', async () => {
    const { stub, deletes } = makeStub();
    const friends = new Friends(stub);
    await friends.remove('f1');
    expect(deletes).toEqual([{ id: 'f1' }]);
  });

  it('throws when zero rows are affected', async () => {
    const { stub } = makeStub({ affectedRows: 0 });
    const friends = new Friends(stub);
    await expect(friends.remove('f1')).rejects.toThrow('Could not remove');
  });
});
