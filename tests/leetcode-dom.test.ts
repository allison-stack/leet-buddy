import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SELECTORS } from '@/content/selectors';
import { onAcceptedVerdict, readSolveStats } from '@/content/leetcode-dom';

function wait(ms = 30) {
  return new Promise<void>(r => setTimeout(r, ms));
}

describe('onAcceptedVerdict', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    SELECTORS.submissionResult = '[data-result]';
  });

  it('calls callback when an Accepted element appears', async () => {
    const cb = vi.fn();
    const cleanup = onAcceptedVerdict(cb);

    const el = document.createElement('div');
    el.setAttribute('data-result', '');
    el.textContent = 'Accepted';
    document.body.appendChild(el);

    await wait();
    expect(cb).toHaveBeenCalledOnce();
    cleanup();
  });

  it('does NOT call callback for Wrong Answer', async () => {
    const cb = vi.fn();
    const cleanup = onAcceptedVerdict(cb);

    const el = document.createElement('div');
    el.setAttribute('data-result', '');
    el.textContent = 'Wrong Answer';
    document.body.appendChild(el);

    await wait();
    expect(cb).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls callback at most once even with multiple subsequent mutations', async () => {
    const cb = vi.fn();
    const cleanup = onAcceptedVerdict(cb);

    const el = document.createElement('div');
    el.setAttribute('data-result', '');
    el.textContent = 'Accepted';
    document.body.appendChild(el);

    // Trigger several more mutations after the first
    document.body.appendChild(document.createElement('span'));
    document.body.appendChild(document.createElement('p'));

    await wait();
    expect(cb).toHaveBeenCalledOnce();
    cleanup();
  });

  it('does NOT call callback after cleanup() is called before the element appears', async () => {
    const cb = vi.fn();
    const cleanup = onAcceptedVerdict(cb);
    cleanup(); // disconnect before anything happens

    const el = document.createElement('div');
    el.setAttribute('data-result', '');
    el.textContent = 'Accepted';
    document.body.appendChild(el);

    await wait();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('readSolveStats', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    SELECTORS.runtimeStats = '[data-e2e-locator="submission-result-stats"]';
  });

  it('extracts runtime and memory percentages', () => {
    document.body.innerHTML = `
      <div data-e2e-locator="submission-result-stats">
        <span>Runtime: 64 ms, Faster than 82.31% of JavaScript submissions.</span>
        <span>Memory: 44.5 MB, Less than 93.45% of JavaScript submissions.</span>
      </div>`;
    const stats = readSolveStats();
    expect(stats?.lcRuntimePct).toBe(82);
    expect(stats?.lcMemPct).toBe(93);
  });

  it('returns null when stats container absent', () => {
    expect(readSolveStats()).toBeNull();
  });

  it('returns partial result when only runtime found', () => {
    document.body.innerHTML = `
      <div data-e2e-locator="submission-result-stats">
        <span>Runtime: 64 ms, Faster than 55.00% of JavaScript submissions.</span>
      </div>`;
    const stats = readSolveStats();
    expect(stats?.lcRuntimePct).toBe(55);
    expect(stats?.lcMemPct).toBeUndefined();
  });
});
