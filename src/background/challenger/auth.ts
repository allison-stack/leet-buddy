export function deriveHandleFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned || 'user';
}

export function deriveAvatarColor(userId: string): string {
  let hue = 0;
  for (let i = 0; i < userId.length; i++) {
    hue = (hue * 31 + userId.charCodeAt(i)) % 360;
  }
  return `hsl(${hue}, 65%, 50%)`;
}

import type { Profile, ProfileInsert } from '@/shared/types';

// Minimal subset of SupabaseClient that Auth uses. Real impl is provided by
// getSupabase(); tests pass a hand-rolled stub.
export interface AuthSupabase {
  auth: {
    signInWithOtp(args: { email: string; options?: { shouldCreateUser?: boolean } }): Promise<{ error: Error | null }>;
    verifyOtp(args: { email: string; token: string; type: 'email' }): Promise<{
      data: { user: { id: string; email?: string | undefined } | null };
      error: Error | null;
    }>;
    signOut(): Promise<{ error: Error | null }>;
    getSession(): Promise<{ data: { session: { user: { id: string; email?: string | undefined } } | null } }>;
    onAuthStateChange(
      cb: (event: string, session: { user: { id: string; email?: string | undefined } } | null) => void
    ): { data: { subscription: { unsubscribe(): void } } };
  };
  from(table: 'profiles'): {
    select(cols: string): {
      eq(col: 'id' | 'handle', val: string): { maybeSingle(): Promise<{ data: Profile | null; error: Error | null }> };
    };
    insert(row: ProfileInsert): {
      select(): { single(): Promise<{ data: Profile | null; error: { code?: string; message: string } | null }> };
    };
  };
}

export interface SendOtpResult { ok: boolean; error?: string }
export interface VerifyOtpResult { ok: boolean; user?: Profile; error?: string }

export class Auth {
  constructor(private sb: AuthSupabase) {}

  async sendOtp(email: string): Promise<SendOtpResult> {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
    const { data, error } = await this.sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.user) return { ok: false, error: error?.message ?? 'verification failed' };

    const profile = await this.ensureProfile(data.user.id, email);
    return { ok: true, user: profile };
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async getCurrentUser(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    const res = await this.sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
    return res.data;
  }

  private async ensureProfile(userId: string, email: string): Promise<Profile> {
    const existing = await this.sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (existing.data) return existing.data;

    const baseHandle = deriveHandleFromEmail(email);
    const insert: ProfileInsert = {
      id: userId,
      handle: baseHandle,
      display_name: baseHandle,
      avatar_color: deriveAvatarColor(userId),
    };

    const first = await this.sb.from('profiles').insert(insert).select().single();
    if (first.data) return first.data;

    if (first.error?.code === '23505') {
      const suffixed: ProfileInsert = { ...insert, handle: `${baseHandle}-${randomSuffix()}` };
      const retry = await this.sb.from('profiles').insert(suffixed).select().single();
      if (retry.data) return retry.data;
      throw new Error(retry.error?.message ?? 'profile insert retry failed');
    }
    throw new Error(first.error?.message ?? 'profile insert failed');
  }
}

function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
