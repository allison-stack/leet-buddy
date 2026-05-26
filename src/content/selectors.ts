/**
 * Single source of truth for LeetCode DOM selectors.
 * If LeetCode redesigns, only this file needs patching.
 */
export const SELECTORS = {
  // Problem title in the description panel header.
  problemTitle: 'div[class*="text-title-large"] a, a[href^="/problems/"]',
  // Difficulty pill near the title.
  difficultyPill: 'div[class*="text-difficulty-"]',
  // Result panel after submission.
  submissionResult: 'div[data-e2e-locator="submission-result"], span[class*="text-green"]',
  // Monaco editor host.
  monacoHost: '.monaco-editor',
};

export type SelectorKey = keyof typeof SELECTORS;
