import { getLocal, setLocal } from '@/shared/storage';

/**
 * Hardcoded fallback selectors for LeetCode DOM.
 * Can be overridden at runtime via a remote-fetched config (see refreshRemoteSelectors).
 */
const HARDCODED = {
  problemTitle: 'div[class*="text-title-large"] a, a[href^="/problems/"]',
  difficultyPill: 'div[class*="text-difficulty-"]',
  submissionResult: 'div[data-e2e-locator="submission-result"], span[class*="text-green"]',
  monacoHost: '.monaco-editor',
};

export const SELECTORS: typeof HARDCODED = { ...HARDCODED };

export type SelectorKey = keyof typeof HARDCODED;

// Engineer note: Replace this URL with a real Gist or static-hosting URL at deploy time.
// Leaving as placeholder; the fetch fails silently and SELECTORS stays at HARDCODED defaults.
const REMOTE_URL = 'https://gist.githubusercontent.com/REPLACE_ME/raw/leet-buddy-selectors.json';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function refreshRemoteSelectors(): Promise<void> {
  const last = await getLocal<number>('selectors_last_fetch');
  if (last && Date.now() - last < TTL_MS) return;
  try {
    const resp = await fetch(REMOTE_URL);
    if (!resp.ok) return;
    const remote = await resp.json() as Partial<typeof HARDCODED>;
    Object.assign(SELECTORS, HARDCODED, remote);
    await setLocal('selectors_last_fetch', Date.now());
    await setLocal('selectors_cache', { ...SELECTORS });
  } catch { /* network/parsing errors are non-fatal */ }
}

export async function loadCachedSelectors(): Promise<void> {
  const cached = await getLocal<typeof HARDCODED>('selectors_cache');
  if (cached) Object.assign(SELECTORS, cached);
}
