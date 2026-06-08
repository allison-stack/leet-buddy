import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from '@/content/components/challenger/ResultScreen';
import type { Challenge } from '@/shared/types';

afterEach(() => cleanup());

const meId = 'me';
const friendId = 'friend';

function makeCompleted(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1', sender_id: friendId, recipient_id: meId,
    problem_slug: 'two-sum', problem_title: 'Two Sum',
    sender_time_ms: 300000, sender_lc_runtime_pct: 80, sender_lc_memory_pct: null,
    accepted_at: 't',
    recipient_time_ms: 200000, recipient_lc_runtime_pct: 90, recipient_lc_memory_pct: null,
    state: 'completed',
    created_at: 't', expires_at: 't', completed_at: 't',
    winner_id: meId,
    ...overrides,
  };
}

describe('ResultScreen', () => {
  it('shows "You won" when meId is the winner', () => {
    render(<ResultScreen challenge={makeCompleted()} meId={meId} friendHandle="alex" streakCount={3} onDismiss={() => {}} />);
    expect(screen.getByText(/you won/i)).toBeTruthy();
  });

  it('shows friend name when friend wins', () => {
    render(<ResultScreen challenge={makeCompleted({ winner_id: friendId })} meId={meId} friendHandle="alex" streakCount={0} onDismiss={() => {}} />);
    expect(screen.getByText(/@alex won/i)).toBeTruthy();
  });

  it('shows streak count when positive', () => {
    render(<ResultScreen challenge={makeCompleted()} meId={meId} friendHandle="alex" streakCount={5} onDismiss={() => {}} />);
    expect(screen.getByText(/5 win streak/i)).toBeTruthy();
  });

  it('calls onDismiss when Dismiss is clicked', () => {
    let dismissed = false;
    render(<ResultScreen challenge={makeCompleted()} meId={meId} friendHandle="alex" streakCount={1} onDismiss={() => { dismissed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(dismissed).toBe(true);
  });
});
