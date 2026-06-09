import type { Challenge, ChallengeState } from '@/shared/types';

export interface SelectChain {
  eq(col: string, val: unknown): SelectChain;
  or(filter: string): SelectChain;
  in(col: string, vals: unknown[]): SelectChain;
  is(col: string, val: null): SelectChain;
  lt(col: string, val: string): SelectChain;
  gte(col: string, val: string): SelectChain;
  order(col: string, opts?: { ascending: boolean }): SelectChain;
  limit(n: number): SelectChain;
  then(resolve: (r: { data: Challenge[] | null; error: Error | null }) => void): void;
}

export interface UpdateChain {
  eq(col: string, val: unknown): UpdateChain;
  or(filter: string): UpdateChain;
  is(col: string, val: null): UpdateChain;
  lt(col: string, val: string): UpdateChain;
  then(resolve: (r: { error: Error | null }) => void): void;
}

export interface ChallengeSupabase {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
  };
  from(table: 'challenges'): {
    select(cols: string): SelectChain;
    insert(row: object): {
      select(cols: string): {
        single(): Promise<{ data: { id: string } | null; error: Error | null }>;
      };
    };
    update(patch: object): UpdateChain;
  };
}

export interface CreateChallengeParams {
  friendId: string;
  problemSlug: string;
  problemTitle: string;
  timeMs: number;
  lcRuntimePct?: number;
  lcMemPct?: number;
}

export interface ChallengeManagerLike {
  applyExpiries(): Promise<void>;
  listInbox(): Promise<{ pending: Challenge[]; recent: Challenge[] }>;
}

export class ChallengeManager implements ChallengeManagerLike {
  constructor(private sb: ChallengeSupabase) {}

  async create(params: CreateChallengeParams): Promise<string> {
    const meId = await this.requireMeId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.sb.from('challenges')
      .insert({
        sender_id: meId,
        recipient_id: params.friendId,
        problem_slug: params.problemSlug,
        problem_title: params.problemTitle,
        sender_time_ms: params.timeMs,
        sender_lc_runtime_pct: params.lcRuntimePct ?? null,
        sender_lc_memory_pct: params.lcMemPct ?? null,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (error) throw error;
    if (!data) throw new Error('no data returned from challenge insert');
    return data.id;
  }

  async accept(challengeId: string): Promise<void> {
    await this.update({ accepted_at: new Date().toISOString() }, challengeId);
  }

  async submitResult(
    challengeId: string,
    timeMs: number,
    lcRuntimePct?: number,
    lcMemPct?: number,
  ): Promise<Challenge> {
    const meId = await this.requireMeId();
    const rows = await this.selectRows('*', (q) => q.eq('id', challengeId));
    const challenge = rows[0];
    if (!challenge) throw new Error(`challenge ${challengeId} not found`);
    const winnerId = timeMs <= challenge.sender_time_ms ? meId : challenge.sender_id;
    const completedAt = new Date().toISOString();
    const patch = {
      recipient_time_ms: timeMs,
      recipient_lc_runtime_pct: lcRuntimePct ?? null,
      recipient_lc_memory_pct: lcMemPct ?? null,
      state: 'completed' as ChallengeState,
      completed_at: completedAt,
      winner_id: winnerId,
    };
    await this.update(patch, challengeId);
    return { ...challenge, ...patch };
  }

  async cancel(challengeId: string): Promise<void> {
    await this.update({ state: 'cancelled' as ChallengeState }, challengeId);
  }

  async getForSlug(slug: string): Promise<Challenge | null> {
    const meId = await this.requireMeId();
    const rows = await this.selectRows('*', (q) =>
      q.or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
       .eq('problem_slug', slug)
       .eq('state', 'pending'),
    );
    return rows[0] ?? null;
  }

  async listInbox(): Promise<{ pending: Challenge[]; recent: Challenge[] }> {
    const meId = await this.requireMeId();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [pending, recent] = await Promise.all([
      this.selectRows('*', (q) =>
        q.eq('recipient_id', meId).eq('state', 'pending'),
      ),
      this.selectRows('*', (q) =>
        q.or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
         .in('state', ['completed', 'expired_forfeit', 'expired_no_contest', 'cancelled'])
         .gte('completed_at', sevenDaysAgo)
         .order('completed_at', { ascending: false })
         .limit(10),
      ),
    ]);
    return { pending, recent };
  }

  async getStreakCount(meId: string): Promise<number> {
    const rows = await this.selectRows('winner_id, completed_at', (q) =>
      q.or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
       .eq('state', 'completed')
       .order('completed_at', { ascending: false }),
    );
    let streak = 0;
    for (const row of rows) {
      if (row.winner_id === meId) streak++;
      else break;
    }
    return streak;
  }

  async applyExpiries(): Promise<void> {
    const now = new Date().toISOString();
    // expired_no_contest: pending, never accepted, past deadline
    await new Promise<void>((resolve) => {
      this.sb.from('challenges')
        .update({ state: 'expired_no_contest' as ChallengeState })
        .eq('state', 'pending').is('accepted_at', null).lt('expires_at', now)
        .then(({ error }) => { if (error) console.error('[poll] expiry no_contest:', error); resolve(); });
    });
    // expired_forfeit: pending, accepted but not finished, past deadline
    const expired = await this.selectRows('*', (q) =>
      q.eq('state', 'pending').lt('expires_at', now),
    );
    for (const row of expired) {
      if (row.accepted_at === null) continue;
      await new Promise<void>((resolve) => {
        this.sb.from('challenges')
          .update({ state: 'expired_forfeit' as ChallengeState, winner_id: row.sender_id, completed_at: now })
          .eq('id', row.id).eq('state', 'pending')
          .then(({ error }) => { if (error) console.error('[poll] expiry forfeit:', error); resolve(); });
      });
    }
  }

  private async selectRows(
    cols: string,
    filter: (q: SelectChain) => SelectChain,
  ): Promise<Challenge[]> {
    return new Promise((resolve, reject) => {
      const base = this.sb.from('challenges').select(cols);
      filter(base).then(({ data, error }) => {
        if (error) reject(error);
        else resolve(data ?? []);
      });
    });
  }

  private async update(patch: object, challengeId: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.sb.from('challenges').update(patch).eq('id', challengeId)
        .then(({ error }) => (error ? reject(error) : resolve()));
    });
  }

  private async requireMeId(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) throw new Error('not signed in');
    return data.session.user.id;
  }
}
