export class RateLimiter {
  private timestamps: number[];
  constructor(private cap: number, private windowMs: number, initial: number[] = []) {
    this.timestamps = [...initial];
  }

  toJSON(): number[] {
    return this.timestamps;
  }

  tryAcquire(now: number): boolean {
    this.prune(now);
    if (this.timestamps.length >= this.cap) return false;
    this.timestamps.push(now);
    return true;
  }

  usedIn(_windowMs: number, now: number): number {
    this.prune(now);
    return this.timestamps.length;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter(t => t > cutoff);
  }
}
