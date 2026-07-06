import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { Popup } from '@/popup/Popup';

const sendMessage = vi.fn();
const storageGet = vi.fn(async () => ({}));

beforeEach(() => {
  sendMessage.mockReset();
  storageGet.mockReset();
  storageGet.mockResolvedValue({});
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage,
      openOptionsPage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: { local: { get: storageGet, set: vi.fn(), remove: vi.fn() } },
  };
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Popup', () => {
  it('shows the sign-in prompt when GET_AUTH_STATE reports no user', async () => {
    sendMessage.mockResolvedValue({ ok: true, user: null });
    render(<Popup />);
    await waitFor(() => expect(screen.getByText(/sign in/i)).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_AUTH_STATE' });
  });

  it('replaces a stuck "Loading…" with a retry prompt after the timeout', async () => {
    vi.useFakeTimers();
    sendMessage.mockReturnValue(new Promise(() => {})); // worker never answers
    render(<Popup />);
    expect(screen.getByText('Loading…')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(5_000); });

    expect(screen.queryByText('Loading…')).toBeNull();
    const retry = screen.getByRole('button', { name: /retry/i });

    fireEvent.click(retry);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
