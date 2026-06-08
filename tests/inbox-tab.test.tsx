import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InboxTab } from '@/popup/InboxTab';
import type { Challenge } from '@/shared/types';

const sendMessage = vi.fn();
beforeEach(() => {
  sendMessage.mockReset();
  (globalThis as unknown as { chrome: object }).chrome = {
    runtime: { sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { update: vi.fn() },
  };
});
afterEach(() => cleanup());

function makeChallenge(id: string, slug: string): Challenge {
  return {
    id, sender_id: 'friend', recipient_id: 'me',
    problem_slug: slug, problem_title: slug,
    sender_time_ms: 120000, sender_lc_runtime_pct: null, sender_lc_memory_pct: null,
    accepted_at: null, recipient_time_ms: null, recipient_lc_runtime_pct: null, recipient_lc_memory_pct: null,
    state: 'pending', created_at: '2026-06-07T00:00:00Z',
    expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    completed_at: null, winner_id: null,
  };
}

describe('InboxTab', () => {
  it('renders pending challenges', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, pending: [makeChallenge('c1', 'two-sum')], recent: [] });
    render(<InboxTab />);
    await waitFor(() => expect(screen.getByText(/two-sum/i)).toBeTruthy());
  });

  it('shows empty state when no challenges', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, pending: [], recent: [] });
    render(<InboxTab />);
    await waitFor(() => expect(screen.getByText(/no challenges/i)).toBeTruthy());
  });

  it('sends CHALLENGE_ACCEPT and opens LC URL on Accept', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, pending: [makeChallenge('c1', 'two-sum')], recent: [] });
    sendMessage.mockResolvedValueOnce({ ok: true }); // CHALLENGE_ACCEPT
    render(<InboxTab />);
    await waitFor(() => screen.getByRole('button', { name: /accept/i }));
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: 'CHALLENGE_ACCEPT', challengeId: 'c1' }),
    );
  });
});
