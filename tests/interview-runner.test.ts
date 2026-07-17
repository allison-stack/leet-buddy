import { describe, expect, it } from 'vitest';
import { runInterviewTurn, runInterviewDebrief, type InterviewChatFn } from '@/background/interview';
import type { InterviewDebriefRequest, InterviewTurnRequest } from '@/shared/types';

const turnReq: InterviewTurnRequest = {
  slug: 's', title: 'T', difficulty: 'easy', problemStatement: 'P',
  phase: 'intro', transcript: [], trigger: 'session_start',
};

const debriefReq: InterviewDebriefRequest = {
  slug: 's', title: 'T', difficulty: 'easy', problemStatement: 'P',
  transcript: [], finalCode: '', solveStatus: 'ended-early', elapsedMs: 60_000,
};

const goodDebrief = JSON.stringify({
  categories: [{ name: 'communication', score: 2, evidence: 'e', improvement: 'i' }],
  missedQuestions: [], processMisses: [], spokenSummary: 'ok',
});

function scripted(...replies: string[]): { fn: InterviewChatFn; calls: { userPrompt: string }[] } {
  const calls: { userPrompt: string }[] = [];
  const queue = [...replies];
  const fn: InterviewChatFn = async args => {
    calls.push({ userPrompt: args.userPrompt });
    return { text: queue.shift() ?? '' };
  };
  return { fn, calls };
}

describe('runInterviewTurn', () => {
  it('returns parsed reply on first success', async () => {
    const { fn, calls } = scripted('{"say": "Hello!", "action": "stay"}');
    expect(await runInterviewTurn(turnReq, fn)).toEqual({ say: 'Hello!', action: 'stay' });
    expect(calls).toHaveLength(1);
  });

  it('re-asks once on parse failure, appending the parse error', async () => {
    const { fn, calls } = scripted('Sure thing, boss!', '{"say": "Hi.", "action": "stay"}');
    expect(await runInterviewTurn(turnReq, fn)).toEqual({ say: 'Hi.', action: 'stay' });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.userPrompt).toMatch(/not valid JSON/i);
  });

  it('degrades to raw text + stay after two failures', async () => {
    const { fn } = scripted('nonsense one', '```\nnonsense two\n```');
    expect(await runInterviewTurn(turnReq, fn)).toEqual({ say: 'nonsense two', action: 'stay' });
  });
});

describe('runInterviewDebrief', () => {
  it('returns parsed debrief on first success', async () => {
    const { fn } = scripted(goodDebrief);
    const d = await runInterviewDebrief(debriefReq, fn);
    expect(d.spokenSummary).toBe('ok');
  });

  it('re-asks once, then throws after two failures', async () => {
    const { fn, calls } = scripted('not json', 'still not json');
    await expect(runInterviewDebrief(debriefReq, fn)).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });
});
