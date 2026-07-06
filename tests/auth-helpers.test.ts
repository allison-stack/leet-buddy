import { describe, it, expect } from 'vitest';
import { deriveHandleFromEmail, deriveAvatarColor, resolveProfile } from '@/background/challenger/auth';
import type { Profile } from '@/shared/types';

describe('deriveHandleFromEmail', () => {
  it('uses the local part lowercased', () => {
    expect(deriveHandleFromEmail('Alice@example.com')).toBe('alice');
  });

  it('strips non-alphanumerics', () => {
    expect(deriveHandleFromEmail('alice.smith+lc@example.com')).toBe('alicesmithlc');
  });

  it('falls back to "user" if local part is empty after stripping', () => {
    expect(deriveHandleFromEmail('___@example.com')).toBe('user');
  });

  it('handles malformed input', () => {
    expect(deriveHandleFromEmail('not-an-email')).toBe('notanemail');
    expect(deriveHandleFromEmail('')).toBe('user');
  });
});

describe('deriveAvatarColor', () => {
  it('returns the same color for the same id', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    expect(deriveAvatarColor(id)).toBe(deriveAvatarColor(id));
  });

  it('returns an hsl() string with hue in [0, 360)', () => {
    const c = deriveAvatarColor('abc');
    expect(c).toMatch(/^hsl\(\d{1,3}, 65%, 50%\)$/);
    const hue = Number(c.match(/^hsl\((\d+),/)![1]);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it('returns different colors for at least two different ids', () => {
    expect(deriveAvatarColor('abc')).not.toBe(deriveAvatarColor('xyz'));
  });
});

describe('resolveProfile', () => {
  const cached: Profile = {
    id: 'u1', handle: 'alice', display_name: 'Alice', avatar_color: '#123456', created_at: '2026-06-06',
  };

  it('returns the cached profile when present', () => {
    expect(resolveProfile({ id: 'u1', email: 'alice@example.com' }, cached)).toBe(cached);
  });

  it('falls back to a profile derived from the session email', () => {
    const p = resolveProfile({ id: 'u2', email: 'bob@example.com' }, undefined);
    expect(p).toEqual({
      id: 'u2', handle: 'bob', display_name: 'bob', avatar_color: '#ffa116', created_at: '',
    });
  });

  it('uses "user" when the session has no email', () => {
    const p = resolveProfile({ id: 'u3' }, undefined);
    expect(p.handle).toBe('user');
    expect(p.display_name).toBe('user');
  });
});
