import { describe, it, expect } from 'vitest';
import { HintCache } from '@/background/hint-cache';

describe('HintCache', () => {
  it('returns undefined on miss', () => {
    const c = new HintCache(10);
    expect(c.get('two-sum', 1, 'abc')).toBeUndefined();
  });

  it('round-trips a value', () => {
    const c = new HintCache(10);
    c.set('two-sum', 1, 'abc', 'hint');
    expect(c.get('two-sum', 1, 'abc')).toBe('hint');
  });

  it('evicts oldest when cap exceeded', () => {
    const c = new HintCache(2);
    c.set('a', 1, 'h1', 'A');
    c.set('b', 1, 'h2', 'B');
    c.set('c', 1, 'h3', 'C');
    expect(c.get('a', 1, 'h1')).toBeUndefined();
    expect(c.get('b', 1, 'h2')).toBe('B');
    expect(c.get('c', 1, 'h3')).toBe('C');
  });

  it('serializes and rehydrates', () => {
    const c = new HintCache(10);
    c.set('a', 1, 'h', 'A');
    const json = c.toJSON();
    const c2 = HintCache.fromJSON(json, 10);
    expect(c2.get('a', 1, 'h')).toBe('A');
  });
});
