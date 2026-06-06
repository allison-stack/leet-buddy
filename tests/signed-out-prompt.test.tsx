import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SignedOutPrompt } from '@/popup/SignedOutPrompt';

const sendMessage = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage } };
});

afterEach(() => cleanup());

describe('SignedOutPrompt', () => {
  it('starts in the email step with Send code disabled when empty', () => {
    render(<SignedOutPrompt onSignedIn={() => {}} />);
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /send code/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('sends AUTH_SEND_OTP and moves to the code step on success', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true });
    render(<SignedOutPrompt onSignedIn={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/code/i)).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_SEND_OTP', email: 'alice@example.com' });
  });

  it('shows an error if AUTH_SEND_OTP fails and stays on the email step', async () => {
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'rate limited' });
    render(<SignedOutPrompt onSignedIn={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByText(/rate limited/)).toBeTruthy());
    expect(screen.queryByPlaceholderText(/code/i)).toBeNull();
  });

  it('verifies the code and calls onSignedIn with the user', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true }); // sendOtp
    const fakeUser = {
      id: 'u', handle: 'alice', display_name: 'alice', avatar_color: 'x', created_at: 't',
    };
    sendMessage.mockResolvedValueOnce({ ok: true, user: fakeUser }); // verifyOtp

    const onSignedIn = vi.fn();
    render(<SignedOutPrompt onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => screen.getByPlaceholderText(/code/i));

    fireEvent.change(screen.getByPlaceholderText(/code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(fakeUser));
  });
});
