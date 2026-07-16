import { INTERVIEW_TURN_CAP } from '@/shared/constants';
import type { InterviewAction, InterviewPhase, InterviewTurnEvent, TranscriptEntry } from '@/shared/types';

export type EndReason = 'solved' | 'time' | 'user' | 'turn-cap' | 'interviewer';

export interface InterviewState {
  phase: InterviewPhase;
  transcript: TranscriptEntry[];
  approachExchanges: number;
  turnCount: number;
  codeNudgeUsed: boolean;
  endReason?: EndReason;
}

export type InterviewEvent =
  | { type: 'SESSION_START'; at: number }
  | { type: 'USER_TURN'; text: string; at: number }
  | { type: 'INTERVIEWER_REPLY'; say: string; action: InterviewAction; at: number }
  | { type: 'CODE_CHANGED'; substantive: boolean; at: number }
  | { type: 'QUIET_TIMEOUT'; at: number }
  | { type: 'SOLVED'; at: number }
  | { type: 'CLOCK_EXPIRED'; at: number }
  | { type: 'END_REQUESTED'; at: number };

export interface ReduceResult {
  state: InterviewState;
  requestTurn?: InterviewTurnEvent;
  requestDebrief?: boolean;
}

const PHASE_ORDER: InterviewPhase[] = ['intro', 'clarify', 'approach', 'coding'];
const PRE_CODING: InterviewPhase[] = ['intro', 'clarify', 'approach'];

export function initialInterviewState(): InterviewState {
  return { phase: 'intro', transcript: [], approachExchanges: 0, turnCount: 0, codeNudgeUsed: false };
}

function withEntry(state: InterviewState, entry: TranscriptEntry): InterviewState {
  return { ...state, transcript: [...state.transcript, entry] };
}

function toDebrief(state: InterviewState, endReason: EndReason): ReduceResult {
  return { state: { ...state, phase: 'debrief', endReason }, requestDebrief: true };
}

export function reduce(state: InterviewState, event: InterviewEvent): ReduceResult {
  if (state.phase === 'debrief' || state.phase === 'ended') return { state };

  switch (event.type) {
    case 'SESSION_START':
      return {
        state: withEntry(state, { role: 'event', text: 'session_start', at: event.at }),
        requestTurn: 'session_start',
      };

    case 'USER_TURN': {
      const next = withEntry({ ...state, turnCount: state.turnCount + 1 },
        { role: 'candidate', text: event.text, at: event.at });
      if (next.turnCount >= INTERVIEW_TURN_CAP) return toDebrief(next, 'turn-cap');
      return { state: next, requestTurn: 'user_turn' };
    }

    case 'INTERVIEWER_REPLY': {
      const next = withEntry(state, { role: 'interviewer', text: event.say, at: event.at });
      if (event.action === 'end') return toDebrief(next, 'interviewer');
      if (state.phase === 'approach') {
        if (event.action === 'advance' && state.approachExchanges >= 1) {
          return { state: { ...next, phase: 'coding' } };
        }
        const approachExchanges = state.approachExchanges + 1;
        if (approachExchanges >= 3) return { state: { ...next, approachExchanges, phase: 'coding' } };
        return { state: { ...next, approachExchanges } };
      }
      if (event.action === 'advance') {
        const idx = PHASE_ORDER.indexOf(state.phase);
        const phase = PHASE_ORDER[idx + 1] ?? 'coding';
        return { state: { ...next, phase } };
      }
      return { state: next };
    }

    case 'CODE_CHANGED': {
      if (!event.substantive || state.codeNudgeUsed || !PRE_CODING.includes(state.phase)) return { state };
      return {
        state: withEntry({ ...state, codeNudgeUsed: true },
          { role: 'event', text: 'code_before_approach', at: event.at }),
        requestTurn: 'code_before_approach',
      };
    }

    case 'QUIET_TIMEOUT': {
      if (state.phase !== 'coding') return { state };
      return {
        state: withEntry(state, { role: 'event', text: 'candidate_silent', at: event.at }),
        requestTurn: 'candidate_silent',
      };
    }

    case 'SOLVED': return toDebrief(state, 'solved');
    case 'CLOCK_EXPIRED': return toDebrief(state, 'time');
    case 'END_REQUESTED': return toDebrief(state, 'user');
  }
}
