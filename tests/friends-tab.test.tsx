import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FriendsTab } from '@/popup/FriendsTab';
import type { FriendsListEntry } from '@/shared/types';

const sendMessage = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  // @ts-expect-error — define chrome global for vitest
  globalThis.chrome = { runtime: { sendMessage } };
});

afterEach(() => {
  cleanup();
  (globalThis as unknown as { confirm?: unknown }).confirm = undefined;
});

function fakeEntry(handle: string, friendshipId: string): FriendsListEntry {
  return {
    friendshipId,
    profile: { id: `id-${handle}`, handle, display_name: handle, avatar_color: 'hsl(0, 65%, 50%)', created_at: 't' },
    relation: 'accepted',
    createdAt: 't',
  };
}

describe('FriendsTab — list rendering', () => {
  it('renders accepted friends and incoming requests', async () => {
    sendMessage.mockResolvedValueOnce({
      ok: true,
      accepted: [fakeEntry('alex', 'f1')],
      incoming: [{ ...fakeEntry('sam', 'f2'), relation: 'pending_in' }],
      outgoing: [],
    });

    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('@alex')).toBeTruthy());
    expect(screen.getByText('@sam')).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept/i })).toBeTruthy();
  });
});

describe('FriendsTab — add flow', () => {
  it('sends FRIEND_ADD and refetches on success', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] }); // initial list
    sendMessage.mockResolvedValueOnce({ ok: true, status: 'created', friendshipId: 'f-new' }); // add
    sendMessage.mockResolvedValueOnce({
      ok: true,
      accepted: [],
      incoming: [],
      outgoing: [{ ...fakeEntry('mira', 'f-new'), relation: 'pending_out' }],
    }); // refetch

    render(<FriendsTab />);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/handle or email/i), { target: { value: 'mira' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText('@mira')).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith({ type: 'FRIEND_ADD', target: 'mira' });
  });

  it('shows a mailto invite when status=not_found', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] });
    sendMessage.mockResolvedValueOnce({ ok: true, status: 'not_found' });

    render(<FriendsTab />);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/handle or email/i), { target: { value: 'ghost@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText(/no leet-buddy user/i)).toBeTruthy());
    const link = screen.getByRole('link', { name: /invite/i }) as HTMLAnchorElement;
    expect(link.href.startsWith('mailto:ghost@example.com')).toBe(true);
  });

  it('shows an inline message when status=self', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] });
    sendMessage.mockResolvedValueOnce({ ok: true, status: 'self' });

    render(<FriendsTab />);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/handle or email/i), { target: { value: 'me' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText(/that's you/i)).toBeTruthy());
  });
});

describe('FriendsTab — accept and remove', () => {
  it('accepts an incoming request and refetches', async () => {
    sendMessage.mockResolvedValueOnce({
      ok: true,
      accepted: [],
      incoming: [{ ...fakeEntry('sam', 'f-in'), relation: 'pending_in' }],
      outgoing: [],
    });
    sendMessage.mockResolvedValueOnce({ ok: true });
    sendMessage.mockResolvedValueOnce({
      ok: true,
      accepted: [fakeEntry('sam', 'f-in')],
      incoming: [],
      outgoing: [],
    });

    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('@sam')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: 'FRIEND_ACCEPT', friendshipId: 'f-in' }),
    );
  });

  it('removes an accepted friend after confirmation', async () => {
    sendMessage.mockResolvedValueOnce({
      ok: true,
      accepted: [fakeEntry('alex', 'f1')],
      incoming: [],
      outgoing: [],
    });
    sendMessage.mockResolvedValueOnce({ ok: true });
    sendMessage.mockResolvedValueOnce({ ok: true, accepted: [], incoming: [], outgoing: [] });
    (globalThis as unknown as { confirm: unknown }).confirm = () => true;

    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('@alex')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({ type: 'FRIEND_REMOVE', friendshipId: 'f1' }),
    );
  });
});
