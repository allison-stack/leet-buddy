import type { ProblemRecord, DailyLog } from '@/shared/types';
import { isDue } from '@/shared/sm2';

export function dueReviews(problems: Record<string, ProblemRecord>, now: number): ProblemRecord[] {
  return Object.values(problems)
    .filter(p => isDue(p.sm2, now))
    .sort((a, b) => a.sm2.dueAt - b.sm2.dueAt);
}

export interface PickArgs {
  today: string; // YYYY-MM-DD
  problems: Record<string, ProblemRecord>;
  log: DailyLog;
  list: string[];
  now: number;
}

export function pickDaily({ today, problems, log, list, now }: PickArgs): string | null {
  if (log[today]) return log[today]!.slug;

  const due = dueReviews(problems, now);
  if (due.length) return due[0]!.slug;

  const completedSlugs = new Set(
    Object.values(log).filter(e => e.completed).map(e => e.slug),
  );
  return list.find(slug => !completedSlugs.has(slug)) ?? null;
}

export function isoToday(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
