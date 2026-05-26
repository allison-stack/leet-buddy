import type { HintTier } from '@/shared/types';

interface Entry { key: string; value: string }

export class HintCache {
  private map = new Map<string, string>(); // insertion-ordered

  constructor(private cap: number) {}

  private static key(slug: string, tier: HintTier, codeHash: string): string {
    return `${slug}::${tier}::${codeHash}`;
  }

  get(slug: string, tier: HintTier, codeHash: string): string | undefined {
    const k = HintCache.key(slug, tier, codeHash);
    const v = this.map.get(k);
    if (v !== undefined) {
      // bump to most-recent
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }

  set(slug: string, tier: HintTier, codeHash: string, value: string): void {
    const k = HintCache.key(slug, tier, codeHash);
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, value);
    while (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  toJSON(): Entry[] {
    return Array.from(this.map.entries()).map(([key, value]) => ({ key, value }));
  }

  static fromJSON(entries: Entry[], cap: number): HintCache {
    const c = new HintCache(cap);
    for (const e of entries) c.map.set(e.key, e.value);
    return c;
  }
}

// stable lightweight hash for "code content fingerprint"
export function codeHash(code: string): string {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
