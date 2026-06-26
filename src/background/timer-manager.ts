import type { Difficulty } from '@/shared/types';
import type { TimerStatus } from '@/shared/messages';

interface InternalState {
  slug: string;
  difficulty: Difficulty;
  thresholdSeconds: number;
  startedAt: number;
  pausedAt?: number;
  accumulatedPausedMs: number;
  forcedStatus?: 'solved';
  firedSent?: boolean;
}

export interface Snapshot {
  slug: string;
  difficulty: Difficulty;
  status: TimerStatus;
  elapsedSeconds: number;
  thresholdSeconds: number;
  elapsedMs: number;
}

export class TimerManager {
  private states = new Map<number, InternalState>();

  start(tabId: number, slug: string, difficulty: Difficulty, thresholdSeconds: number, now: number): void {
    this.states.set(tabId, {
      slug, difficulty, thresholdSeconds,
      startedAt: now,
      accumulatedPausedMs: 0,
    });
  }

  pause(tabId: number, now: number): void {
    const s = this.states.get(tabId);
    if (!s || s.pausedAt !== undefined) return;
    s.pausedAt = now;
  }

  resume(tabId: number, now: number): void {
    const s = this.states.get(tabId);
    if (!s || s.pausedAt === undefined) return;
    s.accumulatedPausedMs += now - s.pausedAt;
    s.pausedAt = undefined;
  }

  reset(tabId: number, now: number): void {
    const s = this.states.get(tabId);
    if (!s) return;
    s.startedAt = now;
    s.pausedAt = undefined;
    s.accumulatedPausedMs = 0;
    s.forcedStatus = undefined;
    s.firedSent = undefined;
  }

  consumeFiredEvent(tabId: number): boolean {
    const s = this.states.get(tabId);
    if (!s || s.firedSent) return false;
    s.firedSent = true;
    return true;
  }

  markSolved(tabId: number, now: number): void {
    const s = this.states.get(tabId);
    if (!s) return;
    if (s.pausedAt === undefined) s.pausedAt = now;
    s.forcedStatus = 'solved';
  }

  clear(tabId: number): void {
    this.states.delete(tabId);
  }

  snapshot(tabId: number, now: number): Snapshot | undefined {
    const s = this.states.get(tabId);
    if (!s) return undefined;

    const effectivePausedMs = s.accumulatedPausedMs + (s.pausedAt !== undefined ? now - s.pausedAt : 0);
    const elapsedMs = now - s.startedAt - effectivePausedMs;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    let status: TimerStatus;
    if (s.forcedStatus === 'solved') status = 'solved';
    else if (s.pausedAt !== undefined) status = 'paused';
    else if (elapsedSeconds >= s.thresholdSeconds) status = 'fired';
    else status = 'running';

    return {
      slug: s.slug,
      difficulty: s.difficulty,
      status,
      elapsedSeconds,
      thresholdSeconds: s.thresholdSeconds,
      elapsedMs,
    };
  }

  toJSON(): Array<[number, InternalState]> {
    return Array.from(this.states.entries());
  }

  static fromJSON(json: Array<[number, InternalState]>): TimerManager {
    const tm = new TimerManager();
    for (const [k, v] of json) tm.states.set(k, v);
    return tm;
  }
}
