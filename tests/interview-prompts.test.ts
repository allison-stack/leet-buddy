import { describe, expect, it } from 'vitest';
import {
  interviewTurnPrompt, interviewDebriefPrompt, parseInterviewTurn, parseDebrief, stripFences,
} from '@/llm/interview-prompts';
import type { InterviewDebriefRequest, InterviewTurnRequest } from '@/shared/types';

const turnReq: InterviewTurnRequest = {
  slug: 'two-sum', title: 'Two Sum', difficulty: 'easy',
  problemStatement: 'Given an array of integers nums and a target...',
  phase: 'approach',
  transcript: [
    { role: 'interviewer', text: 'What is your approach?', at: 1 },
    { role: 'candidate', text: 'Brute force nested loops', at: 2 },
    { role: 'event', text: 'code_before_approach', at: 3 },
  ],
  trigger: 'user_turn',
};

describe('interviewTurnPrompt', () => {
  it('system prompt carries persona rules, phase brief, problem, and JSON format', () => {
    const { system } = interviewTurnPrompt(turnReq);
    expect(system).toMatch(/never reveal/i);
    expect(system).toMatch(/1-3 sentences/i);
    expect(system).toMatch(/CURRENT PHASE: approach/);
    expect(system).toContain('Given an array of integers nums');
    expect(system).toMatch(/"say"/);
    expect(system).toMatch(/"action"/);
  });

  it('user prompt renders transcript with roles and events, plus the trigger', () => {
    const { user } = interviewTurnPrompt(turnReq);
    expect(user).toContain('INTERVIEWER: What is your approach?');
    expect(user).toContain('CANDIDATE: Brute force nested loops');
    expect(user).toContain('[EVENT: code_before_approach]');
    expect(user).toMatch(/candidate just said/i);
  });

  it('includes code snapshot only when provided', () => {
    const withCode = interviewTurnPrompt({ ...turnReq, phase: 'coding', code: 'def twoSum(: pass' });
    expect(withCode.user).toContain('def twoSum(: pass');
    expect(interviewTurnPrompt(turnReq).user).not.toMatch(/current code/i);
  });

  it('each trigger gets a distinct instruction', () => {
    const triggers = ['session_start', 'user_turn', 'candidate_silent', 'code_before_approach'] as const;
    const rendered = triggers.map(trigger => interviewTurnPrompt({ ...turnReq, trigger }).user);
    expect(new Set(rendered).size).toBe(4);
  });
});

describe('parseInterviewTurn', () => {
  it('parses plain JSON', () => {
    expect(parseInterviewTurn('{"say": "Sounds good.", "action": "advance"}'))
      .toEqual({ say: 'Sounds good.', action: 'advance' });
  });

  it('parses fenced JSON', () => {
    expect(parseInterviewTurn('```json\n{"say": "Hm.", "action": "stay"}\n```'))
      .toEqual({ say: 'Hm.', action: 'stay' });
  });

  it('unknown action degrades to stay', () => {
    expect(parseInterviewTurn('{"say": "Hi", "action": "banana"}').action).toBe('stay');
  });

  it('throws on non-JSON and on missing say', () => {
    expect(() => parseInterviewTurn('Sure, sounds good!')).toThrow();
    expect(() => parseInterviewTurn('{"action": "stay"}')).toThrow();
  });

  it('recovers JSON wrapped in surrounding prose', () => {
    expect(parseInterviewTurn('Sure, here you go:\n```json\n{"say": "Hi.", "action": "stay"}\n```\nHope that helps!'))
      .toEqual({ say: 'Hi.', action: 'stay' });
  });
});

describe('debrief', () => {
  const debriefReq: InterviewDebriefRequest = {
    slug: 'two-sum', title: 'Two Sum', difficulty: 'easy',
    problemStatement: 'Given an array...', transcript: turnReq.transcript,
    finalCode: 'class Solution: ...', solveStatus: 'solved', elapsedMs: 900_000,
  };

  it('prompt demands verbatim evidence, exhaustive missed questions, and process misses', () => {
    const { system, user } = interviewDebriefPrompt(debriefReq);
    expect(system).toMatch(/verbatim/i);
    expect(system).toMatch(/every question/i);
    expect(system).toMatch(/processMisses/);
    expect(user).toContain('class Solution: ...');
    expect(user).toContain('solved');
  });

  it('parseDebrief accepts a full object and rejects a missing-categories one', () => {
    const good = JSON.stringify({
      categories: [{ name: 'communication', score: 3, evidence: 'q', improvement: 'x' }],
      missedQuestions: [{ question: 'q', yourAnswer: 'a', correctAnswer: 'b' }],
      processMisses: ['asked zero clarifying questions'],
      spokenSummary: 'Solid.',
    });
    expect(parseDebrief(good).categories).toHaveLength(1);
    expect(() => parseDebrief('{"spokenSummary": "hi"}')).toThrow();
  });

  it('throws on missing spokenSummary even with valid categories', () => {
    const noSummary = JSON.stringify({
      categories: [{ name: 'communication', score: 3, evidence: 'q', improvement: 'x' }],
      missedQuestions: [], processMisses: [],
    });
    expect(() => parseDebrief(noSummary)).toThrow(/spokenSummary/);
  });

  it('skips non-object entries and defaults missing fields', () => {
    const messy = JSON.stringify({
      categories: [null, 'junk', { score: 2 }],
      missedQuestions: [null, { question: 'q' }],
      processMisses: ['ok', 42],
      spokenSummary: 's',
    });
    const d = parseDebrief(messy);
    expect(d.categories).toEqual([{ name: '', score: 2, evidence: '', improvement: '' }]);
    expect(d.missedQuestions).toEqual([{ question: 'q', yourAnswer: '', correctAnswer: '' }]);
    expect(d.processMisses).toEqual(['ok']);
  });

  it('throws when every category entry is junk', () => {
    expect(() => parseDebrief('{"categories": [null, 1], "spokenSummary": "s"}')).toThrow(/categories/);
  });
});

describe('stripFences', () => {
  it('removes surrounding code fences and trims', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('  plain  ')).toBe('plain');
  });
});
