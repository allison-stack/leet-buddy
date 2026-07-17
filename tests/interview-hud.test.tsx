import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InterviewHud, type InterviewHudProps } from '@/content/components/interview/InterviewHud';

const sendMessage = vi.fn();
const storageGet = vi.fn(async () => ({}));
const storageSet = vi.fn(async () => {});

beforeEach(() => {
  sendMessage.mockReset();
  storageGet.mockReset();
  storageGet.mockResolvedValue({});
  storageSet.mockReset();
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { sendMessage },
    storage: { local: { get: storageGet, set: storageSet } },
  };
});

afterEach(() => cleanup());

function props(overrides: Partial<InterviewHudProps> = {}): InterviewHudProps {
  return {
    slug: 'two-sum', title: 'Two Sum', difficulty: 'easy',
    problemStatement: 'Given nums and target...', starter: 'class Solution:',
    sessionSeconds: 1800, remainingSeconds: 1800, solved: false, onExit: () => {},
    ...overrides,
  };
}

describe('InterviewHud', () => {
  it('requests the intro greeting on mount and shows it', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, say: 'Welcome! Restate the problem for me.', action: 'stay' });
    render(<InterviewHud {...props()} />);
    await waitFor(() => expect(screen.getByText(/Restate the problem/)).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INTERVIEW_TURN',
      payload: expect.objectContaining({ trigger: 'session_start', phase: 'intro' }),
    }));
  });

  it('sends a typed turn and renders the reply', async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, say: 'Welcome!', action: 'stay' })
      .mockResolvedValueOnce({ ok: true, say: 'Good restatement. Any clarifying questions?', action: 'advance' });
    render(<InterviewHud {...props()} />);
    await waitFor(() => expect(screen.getByText('Welcome!')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText(/say something/i), { target: { value: 'Find two indices summing to target' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/Any clarifying questions/)).toBeTruthy());
    expect(screen.getByText(/Clarify —/)).toBeTruthy();
  });

  it('shows error and retry on a failed turn, and retry re-sends', async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, say: 'Welcome!', action: 'stay' })
      .mockResolvedValueOnce({ ok: false, error: 'rate limited' })
      .mockResolvedValueOnce({ ok: true, say: 'Recovered.', action: 'stay' });
    render(<InterviewHud {...props()} />);
    await waitFor(() => expect(screen.getByText('Welcome!')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText(/say something/i), { target: { value: 'hello?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/rate limited/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Recovered.')).toBeTruthy());
  });

  it('requests a debrief when solved flips true, saves the session, and shows the rubric', async () => {
    const debrief = {
      categories: [{ name: 'communication', score: 3, evidence: 'e', improvement: 'i' }],
      missedQuestions: [], processMisses: [], spokenSummary: 'Nice work.',
    };
    sendMessage
      .mockResolvedValueOnce({ ok: true, say: 'Welcome!', action: 'stay' })
      .mockResolvedValueOnce({ ok: true, debrief });
    const { rerender } = render(<InterviewHud {...props()} />);
    await waitFor(() => expect(screen.getByText('Welcome!')).toBeTruthy());
    rerender(<InterviewHud {...props({ solved: true })} />);
    await waitFor(() => expect(screen.getByText('Nice work.')).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INTERVIEW_DEBRIEF',
      payload: expect.objectContaining({ solveStatus: 'solved' }),
    }));
  });

  it('End interview button requests a debrief with ended-early', async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, say: 'Welcome!', action: 'stay' })
      .mockResolvedValueOnce({ ok: true, debrief: { categories: [{ name: 'c', score: 1, evidence: '', improvement: '' }], missedQuestions: [], processMisses: [], spokenSummary: 'Cut short.' } });
    render(<InterviewHud {...props()} />);
    await waitFor(() => expect(screen.getByText('Welcome!')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /end interview/i }));
    await waitFor(() => expect(screen.getByText('Cut short.')).toBeTruthy());
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INTERVIEW_DEBRIEF',
      payload: expect.objectContaining({ solveStatus: 'ended-early' }),
    }));
  });
});
