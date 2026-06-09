import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollAlarm } from '@/background/challenger/poll-alarm';
import type { ChallengeManagerLike } from '@/background/challenger/challenge-manager';
import type { Challenge } from '@/shared/types';

function makeChallenge(id: string): Challenge {
  return {
    id, sender_id: 's', recipient_id: 'r', problem_slug: 'two-sum',
    problem_title: 'Two Sum', sender_time_ms: 100, sender_lc_runtime_pct: null,
    sender_lc_memory_pct: null, accepted_at: null, recipient_time_ms: null,
    recipient_lc_runtime_pct: null, recipient_lc_memory_pct: null,
    state: 'pending', created_at: 't', expires_at: 't', completed_at: null, winner_id: null,
  };
}

function makeNotifier() {
  return { tick: vi.fn().mockResolvedValue(undefined) };
}

describe('PollAlarm.tick', () => {
  it('calls applyExpiries and pushes CHALLENGE_INBOX_UPDATED', async () => {
    const inbox = { pending: [makeChallenge('c1')], recent: [] };
    const cm: ChallengeManagerLike = {
      applyExpiries: vi.fn().mockResolvedValue(undefined),
      listInbox: vi.fn().mockResolvedValue(inbox),
    };
    const messages: unknown[] = [];
    const pa = new PollAlarm(cm, async (msg) => { messages.push(msg); }, makeNotifier());
    await pa.tick('');
    expect(cm.applyExpiries).toHaveBeenCalledOnce();
    expect(messages).toEqual([{ type: 'CHALLENGE_INBOX_UPDATED', ...inbox }]);
  });

  it('still pushes when inbox is empty', async () => {
    const cm: ChallengeManagerLike = {
      applyExpiries: vi.fn().mockResolvedValue(undefined),
      listInbox: vi.fn().mockResolvedValue({ pending: [], recent: [] }),
    };
    const messages: unknown[] = [];
    const pa = new PollAlarm(cm, async (msg) => { messages.push(msg); }, makeNotifier());
    await pa.tick('');
    expect(messages).toHaveLength(1);
  });

  it('calls notifier.tick with pending, recent, and meId', async () => {
    const inbox = { pending: [makeChallenge('c1')], recent: [] };
    const cm: ChallengeManagerLike = {
      applyExpiries: vi.fn().mockResolvedValue(undefined),
      listInbox: vi.fn().mockResolvedValue(inbox),
    };
    const notifier = makeNotifier();
    const pa = new PollAlarm(cm, async () => {}, notifier);
    await pa.tick('user-123');
    expect(notifier.tick).toHaveBeenCalledWith(inbox.pending, inbox.recent, 'user-123');
  });
});
