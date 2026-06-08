import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FriendPicker } from '@/content/components/challenger/FriendPicker';
import type { FriendsListEntry } from '@/shared/types';

const sendMessage = vi.fn();
beforeEach(() => {
  sendMessage.mockReset();
  (globalThis as unknown as { chrome: object }).chrome = { runtime: { sendMessage } };
});
afterEach(() => cleanup());

function fakeEntry(handle: string): FriendsListEntry {
  return {
    friendshipId: `f-${handle}`,
    profile: { id: `id-${handle}`, handle, display_name: handle, avatar_color: '#aaa', created_at: 't' },
    relation: 'accepted',
    createdAt: 't',
  };
}

describe('FriendPicker (panel)', () => {
  it('lists accepted friends', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [fakeEntry('alex')], incoming: [], outgoing: [] });
    render(<FriendPicker solveData={{ timeMs: 120000 }} onSent={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByText('@alex')).toBeTruthy());
  });

  it('calls CHALLENGE_CREATE when Send is clicked', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [fakeEntry('alex')], incoming: [], outgoing: [] });
    sendMessage.mockResolvedValueOnce({ ok: true, challengeId: 'new-c' });
    render(<FriendPicker solveData={{ timeMs: 120000 }} onSent={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByText('@alex')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'CHALLENGE_CREATE' })),
    );
  });

  it('shows empty state when no friends', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] });
    render(<FriendPicker solveData={{ timeMs: 120000 }} onSent={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no friends/i)).toBeTruthy());
  });

  it('calls onCancel when Cancel is clicked', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] });
    let cancelled = false;
    render(<FriendPicker solveData={{ timeMs: 120000 }} onSent={() => {}} onCancel={() => { cancelled = true; }} />);
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(cancelled).toBe(true);
  });
});
