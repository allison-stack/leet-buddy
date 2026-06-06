import { describe, it, expect } from 'vitest';
import { deriveHandleFromEmail, deriveAvatarColor } from '@/background/challenger/auth';

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
