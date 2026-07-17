import { useEffect, useRef, useState } from 'react';
import { initialInterviewState, reduce, type InterviewEvent, type InterviewState } from '../../interview/machine';
import { isSubstantive, pollMonaco, readMonacoContents } from '../../editor';
import { sendToWorker } from '@/shared/messages';
import { appendInterviewSession } from '@/shared/storage';
import type {
  Debrief, Difficulty, InterviewPhase, InterviewSolveStatus, InterviewTurnEvent,
} from '@/shared/types';
import { RubricCard } from './RubricCard';

export interface InterviewHudProps {
  slug: string;
  title: string;
  difficulty: Difficulty;
  problemStatement: string;
  starter: string;
  sessionSeconds: number;
  remainingSeconds: number;
  solved: boolean;
  onExit: () => void;
}

const PHASE_HINTS: Record<InterviewPhase, string> = {
  intro: 'Intro — restate the problem in your own words',
  clarify: 'Clarify — interviewers expect questions about constraints, edge cases, sizes',
  approach: 'Approach — explain your plan and complexity before coding',
  coding: 'Coding — narrate as you go',
  debrief: 'Debrief',
  ended: 'Session over',
};

export function InterviewHud(p: InterviewHudProps) {
  const [iv, setIv] = useState<InterviewState>(initialInterviewState);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const ivRef = useRef(iv);
  ivRef.current = iv;
  // retry re-runs the exact failed request without re-dispatching the machine event
  const retryRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);
  const solvedFiredRef = useRef(false);
  const expiredFiredRef = useRef(false);

  function dispatch(event: InterviewEvent) {
    const result = reduce(ivRef.current, event);
    ivRef.current = result.state;
    setIv(result.state);
    if (result.requestTurn) void requestTurn(result.requestTurn);
    if (result.requestDebrief) void requestDebrief();
  }

  async function requestTurn(trigger: InterviewTurnEvent) {
    setThinking(true);
    setError(null);
    const state = ivRef.current;
    const res = await sendToWorker<{ ok: boolean; say?: string; action?: 'stay' | 'advance' | 'end'; error?: string }>({
      type: 'INTERVIEW_TURN',
      payload: {
        slug: p.slug, title: p.title, difficulty: p.difficulty, problemStatement: p.problemStatement,
        phase: state.phase, transcript: state.transcript, trigger,
        ...(state.phase === 'coding' || trigger === 'code_before_approach'
          ? { code: readMonacoContents() } : {}),
      },
    });
    setThinking(false);
    if (res?.ok && res.say) {
      dispatch({ type: 'INTERVIEWER_REPLY', say: res.say, action: res.action ?? 'stay', at: Date.now() });
    } else {
      setError(res?.error ?? 'request failed');
      retryRef.current = () => void requestTurn(trigger);
    }
  }

  async function requestDebrief() {
    setThinking(true);
    setError(null);
    const state = ivRef.current;
    const solveStatus: InterviewSolveStatus =
      state.endReason === 'solved' ? 'solved' : state.endReason === 'time' ? 'time-up' : 'ended-early';
    const elapsedMs = (p.sessionSeconds - Math.max(0, p.remainingSeconds)) * 1000;
    const res = await sendToWorker<{ ok: boolean; debrief?: Debrief; error?: string }>({
      type: 'INTERVIEW_DEBRIEF',
      payload: {
        slug: p.slug, title: p.title, difficulty: p.difficulty, problemStatement: p.problemStatement,
        transcript: state.transcript, finalCode: readMonacoContents(), solveStatus, elapsedMs,
      },
    });
    setThinking(false);
    if (res?.ok && res.debrief) {
      setDebrief(res.debrief);
      void appendInterviewSession({
        slug: p.slug, date: new Date().toISOString().slice(0, 10), durationMs: elapsedMs,
        solveStatus, transcript: state.transcript, debrief: res.debrief,
      });
    } else {
      setError(res?.error ?? 'debrief failed');
      retryRef.current = () => void requestDebrief();
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    dispatch({ type: 'SESSION_START', at: Date.now() });
  }, []);

  useEffect(() => pollMonaco(code => {
    dispatch({ type: 'CODE_CHANGED', substantive: isSubstantive(code, p.starter, 30), at: Date.now() });
  }), [p.starter]);

  useEffect(() => {
    if (p.solved && !solvedFiredRef.current) {
      solvedFiredRef.current = true;
      dispatch({ type: 'SOLVED', at: Date.now() });
    }
  }, [p.solved]);

  useEffect(() => {
    if (p.remainingSeconds <= 0 && !expiredFiredRef.current && startedRef.current) {
      expiredFiredRef.current = true;
      dispatch({ type: 'CLOCK_EXPIRED', at: Date.now() });
    }
  }, [p.remainingSeconds]);

  function send() {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    dispatch({ type: 'USER_TURN', text, at: Date.now() });
  }

  if (debrief) return <RubricCard debrief={debrief} onClose={p.onExit} />;

  const lastInterviewer = [...iv.transcript].reverse().find(e => e.role === 'interviewer');
  const lastCandidate = [...iv.transcript].reverse().find(e => e.role === 'candidate');

  return (
    <div className="lb-section">
      <div style={{ fontSize: 11, color: '#ffa116', fontWeight: 600, marginBottom: 6 }}>
        {PHASE_HINTS[iv.phase]}
      </div>

      {lastCandidate && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>You: {lastCandidate.text}</div>
      )}
      {lastInterviewer && (
        <div style={{ fontSize: 12, marginBottom: 8 }}>{lastInterviewer.text}</div>
      )}
      {thinking && <div style={{ fontSize: 11, color: '#6b7280' }}>Interviewer is thinking…</div>}

      {error && (
        <div style={{ fontSize: 11, color: '#f87171', margin: '6px 0' }}>
          {error}
          <button className="lb-btn" style={{ marginLeft: 8 }} onClick={() => retryRef.current?.()}>
            Retry
          </button>
        </div>
      )}

      {iv.phase !== 'debrief' && iv.phase !== 'ended' && (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', background: '#2d2d2d', color: '#f0f0f0',
                     border: '1px solid #3d3d3d', borderRadius: 6, padding: 8 }}
            placeholder="Say something to your interviewer…"
          />
          <div className="lb-row">
            <button className="lb-btn primary" disabled={thinking} onClick={send}>Send</button>
            <button className="lb-btn" onClick={() => dispatch({ type: 'END_REQUESTED', at: Date.now() })}>
              End interview
            </button>
          </div>
        </>
      )}
    </div>
  );
}
