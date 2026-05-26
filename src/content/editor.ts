import { MONACO_POLL_MS } from '@/shared/constants';

/** Read the Monaco editor's current text. Returns '' if the editor isn't found. */
export function readMonacoContents(): string {
  // Monaco mounts a view-lines container; reading model text requires the global API,
  // which only the page's main world can see. We use textContent of view-lines as a
  // pragmatic substitute that works from a content script.
  const lines = document.querySelectorAll<HTMLElement>('.view-lines .view-line');
  if (!lines.length) return '';
  return Array.from(lines).map(l => l.textContent ?? '').join('\n');
}

export function pollMonaco(onChange: (code: string) => void): () => void {
  let last = '';
  const id = setInterval(() => {
    const cur = readMonacoContents();
    if (cur !== last) { last = cur; onChange(cur); }
  }, MONACO_POLL_MS);
  return () => clearInterval(id);
}

const NON_WS = /\S/g;

export function stripStarterTemplate(code: string, starter: string): string {
  const trimmed = code.trim();
  const starterTrimmed = starter.trim();
  if (trimmed.startsWith(starterTrimmed)) return trimmed.slice(starterTrimmed.length).trim();
  // Fallback: subtract starter's non-whitespace char count's worth from the front
  // is too aggressive; just return the full code minus a normalized prefix attempt.
  const stripped = code.replace(starterTrimmed, '');
  return stripped.trim();
}

export function isSubstantive(code: string, starter: string, threshold: number): boolean {
  const added = stripStarterTemplate(code, starter);
  const nonWsCount = (added.match(NON_WS) ?? []).length;
  return nonWsCount >= threshold;
}
