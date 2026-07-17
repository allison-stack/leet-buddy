import { describe, expect, it } from 'vitest';
import { initialInterviewState, reduce, type InterviewState, type InterviewEvent } from '@/content/interview/machine';
import { INTERVIEW_TURN_CAP } from '@/shared/constants';

function apply(state: InterviewState, ...events: InterviewEvent[]) {
  let result = { state, requestTurn: undefined as string | undefined, requestDebrief: undefined as boolean | undefined };
  for (const e of events) result = { requestTurn: undefined, requestDebrief: undefined, ...reduce(result.state, e) };
  return result;
}

const reply = (action: 'stay' | 'advance' | 'end', say = 'ok'): InterviewEvent =>
  ({ type: 'INTERVIEWER_REPLY', say, action, at: 1 });
const userTurn = (text = 'hello'): InterviewEvent => ({ type: 'USER_TURN', text, at: 1 });

describe('session start and turns', () => {
  it('starts in intro and requests a session_start turn', () => {
    const r = reduce(initialInterviewState(), { type: 'SESSION_START', at: 1 });
    expect(r.state.phase).toBe('intro');
    expect(r.requestTurn).toBe('session_start');
  });

  it('a user turn appends to transcript and requests a user_turn', () => {
    const r = reduce(initialInterviewState(), userTurn('two sum, find indices'));
    expect(r.state.transcript.at(-1)).toMatchObject({ role: 'candidate', text: 'two sum, find indices' });
    expect(r.requestTurn).toBe('user_turn');
  });

  it('an interviewer reply appends to transcript', () => {
    const r = reduce(initialInterviewState(), reply('stay', 'tell me more'));
    expect(r.state.transcript.at(-1)).toMatchObject({ role: 'interviewer', text: 'tell me more' });
  });
});

describe('phase advancement', () => {
  it('advance walks intro -> clarify -> approach', () => {
    let r = apply(initialInterviewState(), reply('advance'));
    expect(r.state.phase).toBe('clarify');
    r = apply(r.state, reply('advance'));
    expect(r.state.phase).toBe('approach');
  });

  it('approach gate: advance is NOT honored before one probe exchange', () => {
    const inApproach = apply(initialInterviewState(), reply('advance'), reply('advance')).state;
    const r = reduce(inApproach, reply('advance'));
    expect(r.state.phase).toBe('approach');
  });

  it('approach gate: advance honored after one probe exchange', () => {
    const inApproach = apply(initialInterviewState(), reply('advance'), reply('advance')).state;
    const r = apply(inApproach, reply('stay', 'whats the complexity?'), reply('advance'));
    expect(r.state.phase).toBe('coding');
  });

  it('approach gate: force-advance after 3 probe exchanges even on stay', () => {
    const inApproach = apply(initialInterviewState(), reply('advance'), reply('advance')).state;
    const r = apply(inApproach, reply('stay'), reply('stay'), reply('stay'));
    expect(r.state.phase).toBe('coding');
  });

  it('action end moves to debrief and requests it', () => {
    const r = reduce(initialInterviewState(), reply('end'));
    expect(r.state.phase).toBe('debrief');
    expect(r.requestDebrief).toBe(true);
  });

  it('action end records endReason interviewer', () => {
    const r = reduce(initialInterviewState(), reply('end'));
    expect(r.state.endReason).toBe('interviewer');
  });
});

describe('code-before-approach nudge', () => {
  it('substantive code change pre-coding requests a code_before_approach turn once', () => {
    const first = reduce(initialInterviewState(), { type: 'CODE_CHANGED', substantive: true, at: 1 });
    expect(first.requestTurn).toBe('code_before_approach');
    expect(first.state.codeNudgeUsed).toBe(true);
    const second = reduce(first.state, { type: 'CODE_CHANGED', substantive: true, at: 2 });
    expect(second.requestTurn).toBeUndefined();
  });

  it('non-substantive changes never trigger it', () => {
    const r = reduce(initialInterviewState(), { type: 'CODE_CHANGED', substantive: false, at: 1 });
    expect(r.requestTurn).toBeUndefined();
  });

  it('does not trigger during coding phase', () => {
    const coding = apply(initialInterviewState(), reply('advance'), reply('advance'), reply('stay'), reply('advance')).state;
    expect(coding.phase).toBe('coding');
    const r = reduce(coding, { type: 'CODE_CHANGED', substantive: true, at: 1 });
    expect(r.requestTurn).toBeUndefined();
  });
});

describe('quiet timeout', () => {
  it('requests candidate_silent only during coding', () => {
    const coding = apply(initialInterviewState(), reply('advance'), reply('advance'), reply('stay'), reply('advance')).state;
    expect(reduce(coding, { type: 'QUIET_TIMEOUT', at: 1 }).requestTurn).toBe('candidate_silent');
    expect(reduce(initialInterviewState(), { type: 'QUIET_TIMEOUT', at: 1 }).requestTurn).toBeUndefined();
  });
});

describe('session end', () => {
  it.each([
    ['SOLVED', 'solved'],
    ['CLOCK_EXPIRED', 'time'],
    ['END_REQUESTED', 'user'],
  ] as const)('%s ends with reason %s and requests debrief', (type, reason) => {
    const r = reduce(initialInterviewState(), { type, at: 1 } as InterviewEvent);
    expect(r.state.phase).toBe('debrief');
    expect(r.state.endReason).toBe(reason);
    expect(r.requestDebrief).toBe(true);
  });

  it('turn cap force-ends the session', () => {
    let state = initialInterviewState();
    state = { ...state, turnCount: INTERVIEW_TURN_CAP - 1 };
    const r = reduce(state, userTurn());
    expect(r.state.phase).toBe('debrief');
    expect(r.state.endReason).toBe('turn-cap');
    expect(r.requestDebrief).toBe(true);
    expect(r.requestTurn).toBeUndefined();
  });

  it('events after debrief are ignored', () => {
    const ended = reduce(initialInterviewState(), { type: 'END_REQUESTED', at: 1 }).state;
    const r = reduce(ended, userTurn('too late'));
    expect(r.state).toBe(ended);
    expect(r.requestTurn).toBeUndefined();
  });
});
