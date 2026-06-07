import { describe, it, expect } from 'vitest';
import { canonicalPair } from '@/background/challenger/friends';

describe('canonicalPair', () => {
  it('returns the smaller uuid as user_a', () => {
    const { user_a, user_b } = canonicalPair('bbb', 'aaa');
    expect(user_a).toBe('aaa');
    expect(user_b).toBe('bbb');
  });

  it('is stable when inputs are already ordered', () => {
    const { user_a, user_b } = canonicalPair('aaa', 'bbb');
    expect(user_a).toBe('aaa');
    expect(user_b).toBe('bbb');
  });

  it('uses lexicographic comparison (string-typed UUIDs)', () => {
    // '0' < '9' < 'a' in JS string compare. UUID v4s are hex, so this matches
    // postgres UUID ordering for the canonical-check constraint.
    const { user_a, user_b } = canonicalPair(
      '11111111-1111-1111-1111-111111111111',
      '00000000-0000-0000-0000-000000000001',
    );
    expect(user_a).toBe('00000000-0000-0000-0000-000000000001');
    expect(user_b).toBe('11111111-1111-1111-1111-111111111111');
  });
});
