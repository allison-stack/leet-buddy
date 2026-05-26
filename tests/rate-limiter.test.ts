import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@/background/rate-limiter';

describe('RateLimiter', () => {
  it('allows up to cap within window', () => {
    const rl = new RateLimiter(3, 60_000);
    const now = 1000;
    expect(rl.tryAcquire(now)).toBe(true);
    expect(rl.tryAcquire(now)).toBe(true);
    expect(rl.tryAcquire(now)).toBe(true);
    expect(rl.tryAcquire(now)).toBe(false);
  });

  it('frees a slot after window elapses', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.tryAcquire(0)).toBe(true);
    expect(rl.tryAcquire(500)).toBe(true);
    expect(rl.tryAcquire(800)).toBe(false);
    expect(rl.tryAcquire(1001)).toBe(true); // first slot expired
  });

  it('reports current usage', () => {
    const rl = new RateLimiter(5, 60_000);
    rl.tryAcquire(0); rl.tryAcquire(10);
    expect(rl.usedIn(60_000, 10)).toBe(2);
  });
});
