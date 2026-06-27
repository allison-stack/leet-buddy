import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChallengeBanner } from '@/content/components/challenger/ChallengeBanner';
import type { Challenge } from '@/shared/types';

afterEach(() => cleanup());

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1', sender_id: 'sender', recipient_id: 'me',
    problem_slug: 'two-sum', problem_title: 'Two Sum',
    sender_time_ms: 300000, sender_lc_runtime_pct: null, sender_lc_memory_pct: null,
    accepted_at: new Date(Date.now() - 30000).toISOString(),
    recipient_time_ms: null, recipient_lc_runtime_pct: null, recipient_lc_memory_pct: null,
    state: 'pending', created_at: 't',
    expires_at: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    completed_at: null, winner_id: null,
    ...overrides,
  };
}

describe('ChallengeBanner — racing', () => {
  it('shows friend handle in racing mode', () => {
    render(
      <ChallengeBanner
        challenge={makeChallenge()}
        meId="me"
        friendHandle="alex"
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/alex/i)).toBeTruthy();
  });

  it('shows count-up timer', () => {
    render(
      <ChallengeBanner
        challenge={makeChallenge()}
        meId="me"
        friendHandle="alex"
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/\d+:\d{2}/)).toBeTruthy();
  });
});

describe('ChallengeBanner — waiting (sender view)', () => {
  it('shows waiting state when meId is the sender', () => {
    render(
      <ChallengeBanner
        challenge={makeChallenge({ sender_id: 'me', recipient_id: 'alex-id', accepted_at: null })}
        meId="me"
        friendHandle="alex"
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/waiting|left to accept/i)).toBeTruthy();
  });

  it('shows non-zero time on initial render', () => {
    render(
      <ChallengeBanner
        challenge={makeChallenge({
          sender_id: 'me', recipient_id: 'alex-id', accepted_at: null,
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000 + 1000).toISOString(),
        })}
        meId="me"
        friendHandle="alex"
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/left to accept/i).textContent).not.toContain('0m');
  });
});
