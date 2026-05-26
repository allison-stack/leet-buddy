import type { Difficulty } from '@/shared/types';
import type { TimerStatus } from '@/shared/messages';

interface InternalState {
  slug: string;
  difficulty: Difficulty;
  durationSeconds: number;
  startedAt: number;       // wall clock ms
  pausedAt?: number;       // if paused
  accumulatedPausedMs: number;
  forcedStatus?: 'solved';
}

export interface Snapshot {
  slug: string;
  difficulty: Difficulty;
  status: TimerStatus;
  remainingSeconds: number;
  durationSeconds: number;
}

export class TimerManager {
  private states = new Map<number /* tabId */, InternalState>();

  start(tabId: number, slug: string, difficulty: Difficulty, durationSeconds: number, now: number): void {
    this.states.set(tabId, {
      slug, difficulty, durationSeconds,
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
  }

  markSolved(tabId: number, now: number): void {
    const s = this.states.get(tabId);
    if (!s) return;
    // freeze paused state at "now"
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
    const remainingSeconds = Math.max(0, Math.ceil((s.durationSeconds * 1000 - elapsedMs) / 1000));

    let status: TimerStatus;
    if (s.forcedStatus === 'solved') status = 'solved';
    else if (s.pausedAt !== undefined) status = 'paused';
    else if (remainingSeconds === 0) status = 'fired';
    else status = 'running';

    return {
      slug: s.slug,
      difficulty: s.difficulty,
      status,
      remainingSeconds,
      durationSeconds: s.durationSeconds,
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
