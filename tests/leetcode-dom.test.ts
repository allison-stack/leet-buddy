import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SELECTORS } from '@/content/selectors';
import { onAcceptedVerdict } from '@/content/leetcode-dom';

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
