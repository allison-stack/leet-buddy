import type { Sm2State } from './types';

const DAY_MS = 86_400_000;

export function initialSm2State(now: number): Sm2State {
  return { ease: 2.5, interval: 0, reps: 0, dueAt: now, lastQuality: 4 };
}

export function updateSm2(prev: Sm2State, q: 1 | 3 | 4 | 5, now: number): Sm2State {
  let { ease, interval, reps } = prev;

  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
  }

  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  return {
    ease,
    interval,
    reps,
    dueAt: now + interval * DAY_MS,
    lastQuality: q,
  };
}

export function isDue(state: Sm2State, now: number): boolean {
  return state.dueAt <= now;
}
