export function canonicalPair(x: string, y: string): { user_a: string; user_b: string } {
  return x < y ? { user_a: x, user_b: y } : { user_a: y, user_b: x };
}

import type {
  Profile, Friendship, FriendsListEntry, FriendRelation, RequestFriendshipStatus,
} from '@/shared/types';

// PostgREST embeds joined profile rows under the FK alias we request in the
// select string. We mirror that shape in our minimal interface and in tests.
export interface FriendshipRowWithProfiles extends Friendship {
  user_a_profile: Profile;
  user_b_profile: Profile;
}

// A thenable that resolves to a PostgREST-shaped result. Lets us stub `.select()`
// chains in tests without pulling in supabase-js.
type Thenable<T> = { then(resolve: (value: T) => void): void };

// Minimal subset of SupabaseClient that Friends uses. Real impl is provided by
// getSupabase(); tests pass a hand-rolled stub.
export interface FriendsSupabase {
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string } } | null };
    }>;
  };
  rpc(
    fn: 'request_friendship',
    args: { target: string },
  ): Promise<{ data: { status: string; friendship_id?: string } | null; error: Error | null }>;
  from(table: 'friendships'): {
    select(cols: string): Thenable<{ data: FriendshipRowWithProfiles[]; error: Error | null }>;
    update(patch: { status: 'accepted' }): {
      eq(col: 'id', val: string): {
        select(cols: string): Thenable<{ data: { id: string }[] | null; error: Error | null }>;
      };
    };
    delete(): {
      eq(col: 'id', val: string): {
        select(cols: string): Thenable<{ data: { id: string }[] | null; error: Error | null }>;
      };
    };
  };
}

export interface FriendsList {
  accepted: FriendsListEntry[];
  incoming: FriendsListEntry[];
  outgoing: FriendsListEntry[];
}

export interface AddFriendResult {
  status: RequestFriendshipStatus;
  friendshipId?: string;
}

export class Friends {
  constructor(private sb: FriendsSupabase) {}

  async list(): Promise<FriendsList> {
    const meId = await this.requireMeId();
    const rows = await new Promise<FriendshipRowWithProfiles[]>((resolve, reject) => {
      this.sb
        .from('friendships')
        .select(
          '*, user_a_profile:profiles!friendships_user_a_fkey(*), user_b_profile:profiles!friendships_user_b_fkey(*)',
        )
        .then(({ data, error }) => {
          if (error) reject(error);
          else resolve(data);
        });
    });

    const accepted: FriendsListEntry[] = [];
    const incoming: FriendsListEntry[] = [];
    const outgoing: FriendsListEntry[] = [];

    for (const row of rows) {
      const other: Profile = row.user_a === meId ? row.user_b_profile : row.user_a_profile;
      const relation: FriendRelation =
        row.status === 'accepted'
          ? 'accepted'
          : row.requested_by === meId
            ? 'pending_out'
            : 'pending_in';
      const entry: FriendsListEntry = {
        friendshipId: row.id,
        profile: other,
        relation,
        createdAt: row.created_at,
      };
      (relation === 'accepted' ? accepted : relation === 'pending_in' ? incoming : outgoing).push(entry);
    }

    return { accepted, incoming, outgoing };
  }

  async add(target: string): Promise<AddFriendResult> {
    const { data, error } = await this.sb.rpc('request_friendship', { target });
    if (error) throw error;
    if (!data) return { status: 'not_found' };
    const out: AddFriendResult = { status: data.status as RequestFriendshipStatus };
    if (data.friendship_id) out.friendshipId = data.friendship_id;
    return out;
  }

  async accept(friendshipId: string): Promise<void> {
    const { data, error } = await new Promise<{ data: { id: string }[] | null; error: Error | null }>((resolve) => {
      this.sb
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
        .select('id')
        .then(resolve);
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Could not accept — the request may have been withdrawn.');
  }

  async remove(friendshipId: string): Promise<void> {
    const { data, error } = await new Promise<{ data: { id: string }[] | null; error: Error | null }>((resolve) => {
      this.sb
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .select('id')
        .then(resolve);
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Could not remove — it may already be gone.');
  }

  private async requireMeId(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) throw new Error('not signed in');
    return data.session.user.id;
  }
}
