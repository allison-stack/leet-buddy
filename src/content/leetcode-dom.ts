import type { Difficulty } from '@/shared/types';
import { SELECTORS } from './selectors';

export function slugFromUrl(href = location.href): string | null {
  const m = href.match(/leetcode\.com\/problems\/([^/]+)/);
  return m ? m[1]! : null;
}

export function readTitle(): string {
  const el = document.querySelector<HTMLElement>(SELECTORS.problemTitle);
  return el?.textContent?.trim() ?? slugFromUrl() ?? '';
}

export function readDifficulty(): Difficulty {
  const el = document.querySelector<HTMLElement>(SELECTORS.difficultyPill);
  const text = el?.textContent?.toLowerCase() ?? '';
  if (text.includes('hard')) return 'hard';
  if (text.includes('medium')) return 'medium';
  return 'easy';
}

export function readProblemStatement(): string {
  // Description panel has a rich-text container; grab visible text.
  const candidates = document.querySelectorAll<HTMLElement>('div[data-track-load="description_content"], div[class*="elfjS"]');
  for (const el of candidates) {
    const t = el.innerText.trim();
    if (t.length > 50) return t;
  }
  return '';
}

export function onAcceptedVerdict(callback: () => void): () => void {
  let fired = false;
  const observer = new MutationObserver(() => {
    if (fired) return;
    const el = document.querySelector<HTMLElement>(SELECTORS.submissionResult);
    if (el && /\baccepted\b/i.test(el.textContent ?? '')) {
      fired = true;
      observer.disconnect();
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export interface SolveStats {
  lcRuntimePct?: number;
  lcMemPct?: number;
}

export function readSolveStats(): SolveStats | null {
  const container = document.querySelector<HTMLElement>(SELECTORS.runtimeStats);
  if (!container) return null;
  const text = container.innerText || container.textContent || '';
  const runtimeMatch = text.match(/faster than\s+([\d.]+)%/i);
  const memMatch = text.match(/less than\s+([\d.]+)%/i);
  const result: SolveStats = {};
  if (runtimeMatch) result.lcRuntimePct = Math.round(parseFloat(runtimeMatch[1]!));
  if (memMatch) result.lcMemPct = Math.round(parseFloat(memMatch[1]!));
  if (!runtimeMatch && !memMatch) return null;
  return result;
}
