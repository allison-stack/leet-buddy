import { useEffect, useRef, useState } from 'react';
import { slugFromUrl, readTitle, readDifficulty, readProblemStatement, onAcceptedVerdict } from '../leetcode-dom';
import { readMonacoContents, isSubstantive } from '../editor';
import { sendToWorker } from '@/shared/messages';
import type { ContentToWorker, TimerStatus } from '@/shared/messages';
import type { Difficulty, ApproachEvalResponse } from '@/shared/types';
import { Timer } from './Timer';
import { ApproachPrompt } from './ApproachPrompt';
import { HintLadder } from './HintLadder';
import { SolveRating } from './SolveRating';
import { useDragResize } from '../hooks/useDragResize';

type Phase = 'timing' | 'approach' | 'hint' | 'solved';

export function Panel() {
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [phase, setPhase] = useState<Phase>('timing');
  const [approachResult, setApproachResult] = useState<ApproachEvalResponse | null>(null);
  const [starter, setStarter] = useState<string>('');
  const [hintTierUsed, setHintTierUsed] = useState<0 | 1 | 2 | 3 | 4>(0);

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const s = slugFromUrl();
    if (!s) return;
    setSlug(s);
    setTitle(readTitle());
    const d = readDifficulty();
    setDifficulty(d);
    void sendToWorker({ type: 'TIMER_START', tabId: -1, slug: s, difficulty: d });
  }, []);

  // Capture the editor's starter template at mount (before user edits).
  useEffect(() => {
    if (!slug) return;
    let attempts = 0;
    const id = setInterval(() => {
      const code = readMonacoContents();
      attempts++;
      if (code.trim().length > 0) {
        setStarter(code);
        clearInterval(id);
      } else if (attempts > 20) {
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [slug]);

  useEffect(() => {
    const handler = (msg: { type: string; remainingSeconds?: number; status?: TimerStatus; askForApproach?: boolean }) => {
      if (msg.type === 'TIMER_TICK') {
        if (typeof msg.remainingSeconds === 'number') setRemaining(msg.remainingSeconds);
        if (msg.status) setStatus(msg.status);
      }
      if (msg.type === 'TIMER_FIRED') {
        const code = readMonacoContents();
        setPhase(isSubstantive(code, starter, 30) ? 'hint' : 'approach');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [starter]);

  useEffect(() => {
    if (!slug) return;
    return onAcceptedVerdict(() => {
      if (phaseRef.current === 'solved') return;
      setPhase('solved');
      void sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed });
    });
  }, [slug, title, difficulty, hintTierUsed]);

  const { pos, size, dragHandleProps, resizeGripProps } = useDragResize(slug);

  const rootStyle: React.CSSProperties = {
    width: size.width,
    ...(size.height !== undefined ? { height: size.height, maxHeight: size.height } : {}),
    ...(pos !== null ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {}),
  };

  if (!slug) return null;

  async function sendTimerControl(msg: ContentToWorker) {
    const r = await sendToWorker<{ ok: boolean; snapshot?: { status: TimerStatus; remainingSeconds: number } }>(msg);
    if (r?.ok && r.snapshot) {
      setStatus(r.snapshot.status);
      setRemaining(r.snapshot.remainingSeconds);
    }
  }

  return (
    <div className="lb-root" style={rootStyle}>
      <div className="lb-header" {...dragHandleProps}>
        <span>
          <span style={{ opacity: 0.3, marginRight: 6, fontSize: 12 }} aria-hidden="true">⠿</span>
          Leet Buddy
        </span>
        <Timer remainingFromWorker={remaining} status={status} />
      </div>
      <div className="lb-body">
        <div style={{ opacity: 0.7, fontSize: 11 }}>{title} · {difficulty}</div>
        <div className="lb-row">
          <button className="lb-btn" onClick={() => void sendTimerControl({ type: 'TIMER_PAUSE', tabId: -1 })}>Pause</button>
          <button className="lb-btn" onClick={() => void sendTimerControl({ type: 'TIMER_RESUME', tabId: -1 })}>Resume</button>
          <button className="lb-btn" onClick={() => void sendTimerControl({ type: 'TIMER_RESET', tabId: -1 })}>Reset</button>
          <button className="lb-btn" onClick={() => {
            if (!slug) return;
            setPhase('solved');
            void sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed });
          }}>Mark solved</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>status: {status}</div>

        {phase === 'approach' && (
          <ApproachPrompt
            slug={slug}
            problemStatement={readProblemStatement()}
            difficulty={difficulty}
            onResult={r => { setApproachResult(r); setPhase('hint'); }}
            onSkip={() => setPhase('hint')}
          />
        )}

        {approachResult && (
          <div className="lb-hint">
            <strong>{approachResult.verdict.toUpperCase()}:</strong> {approachResult.message}
          </div>
        )}

        {phase === 'hint' && (
          <HintLadder
            slug={slug}
            problemStatement={readProblemStatement()}
            difficulty={difficulty}
            userCode={readMonacoContents()}
          />
        )}

        {phase === 'solved' && (
          <SolveRating slug={slug} title={title} difficulty={difficulty} hintTierUsed={hintTierUsed} onRated={() => { /* keep panel as-is */ }} />
        )}
      </div>
      <div className="lb-resize-grip" {...resizeGripProps}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <line x1="2" y1="10" x2="10" y2="2" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="5" y1="10" x2="10" y2="5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="8" y1="10" x2="10" y2="8" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
