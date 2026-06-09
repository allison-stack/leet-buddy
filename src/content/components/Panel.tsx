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
import { MinimizedBar } from './MinimizedBar';
import { useDragResize } from '../hooks/useDragResize';
import { getPanelMinimized, setPanelMinimized, getSettings } from '@/shared/storage';
import { playTimerPing } from '../sound';
import type { Snapshot } from '@/background/timer-manager';
import type { Challenge, Profile } from '@/shared/types';
import { readSolveStats } from '../leetcode-dom';
import { ChallengeBanner } from './challenger/ChallengeBanner';
import { ChallengeCTA } from './challenger/ChallengeCTA';
import { FriendPicker } from './challenger/FriendPicker';
import { ResultScreen } from './challenger/ResultScreen';

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
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);

  type ChallengePhase = 'none' | 'racing' | 'waiting' | 'cta' | 'picking' | 'result';
  interface SolveData { timeMs: number; lcRuntimePct?: number; lcMemPct?: number }

  const [challengePhase, setChallengePhase] = useState<ChallengePhase>('none');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
  const [solveData, setSolveData] = useState<SolveData | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [meId, setMeId] = useState('');
  const activeChallengeRef = useRef<Challenge | null>(null);
  activeChallengeRef.current = activeChallenge;

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const userToggledMinimizedRef = useRef(false);

  useEffect(() => {
    const s = slugFromUrl();
    if (!s) return;
    setSlug(s);
    setTitle(readTitle());
    const d = readDifficulty();
    setDifficulty(d);
    setDismissed(false);
    void sendToWorker({ type: 'TIMER_START', tabId: -1, slug: s, difficulty: d });
  }, []);

  useEffect(() => {
    if (!slug) return;
    void sendToWorker<{ ok: boolean; challenge: Challenge | null; friendProfile: Profile | null; meId: string }>(
      { type: 'GET_ACTIVE_CHALLENGE', slug },
    ).then(res => {
      if (!res?.ok) return;
      if (res.meId) setMeId(res.meId);
      if (!res.challenge) return;
      setActiveChallenge(res.challenge);
      setFriendProfile(res.friendProfile);
      if (res.challenge.accepted_at !== null && res.challenge.recipient_id === res.meId) {
        setChallengePhase('racing');
      } else {
        setChallengePhase('waiting');
      }
    });
  }, [slug]);

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
        void (async () => {
          const settings = await getSettings();
          if (settings.timerSoundEnabled) await playTimerPing();
        })();
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [starter]);

  useEffect(() => {
    if (!slug) return;
    const handler = (msg: { type: string; challenge?: Challenge }) => {
      if (msg.type === 'CHALLENGE_RESULT_READY' && msg.challenge) {
        setActiveChallenge(msg.challenge);
        setChallengePhase('result');
      }
      if (msg.type === 'CHALLENGE_INBOX_UPDATED') {
        void sendToWorker<{ ok: boolean; challenge: Challenge | null; friendProfile: Profile | null; meId: string }>(
          { type: 'GET_ACTIVE_CHALLENGE', slug },
        ).then(res => {
          if (!res?.ok) return;
          if (res.challenge) {
            setActiveChallenge(res.challenge);
            setFriendProfile(res.friendProfile);
          }
        });
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    return onAcceptedVerdict(async () => {
      if (phaseRef.current === 'solved') return;
      setPhase('solved');
      void sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed });
      const timerRes = await sendToWorker<{ ok: boolean; snapshot?: Snapshot }>({ type: 'GET_TIMER_STATE', tabId: -1 });
      const timeMs = timerRes?.snapshot?.elapsedMs ?? 0;
      const lcStats = readSolveStats();
      const data: SolveData = { timeMs, lcRuntimePct: lcStats?.lcRuntimePct, lcMemPct: lcStats?.lcMemPct };
      setSolveData(data);

      const challenge = activeChallengeRef.current;
      if (challenge && challenge.accepted_at !== null) {
        const res = await sendToWorker<{ ok: boolean; challenge?: Challenge }>({
          type: 'CHALLENGE_SUBMIT',
          challengeId: challenge.id,
          timeMs,
          lcRuntimePct: lcStats?.lcRuntimePct,
          lcMemPct: lcStats?.lcMemPct,
        });
        if (res?.ok && res.challenge) {
          setActiveChallenge(res.challenge);
          const streakRes = await sendToWorker<{ ok: boolean; streak?: number }>({ type: 'GET_STREAK_COUNT' });
          setStreakCount(streakRes?.streak ?? 0);
          setChallengePhase('result');
        }
      } else {
        setChallengePhase('cta');
      }
    });
  }, [slug, title, difficulty, hintTierUsed]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    userToggledMinimizedRef.current = false;
    void getPanelMinimized(slug).then(value => {
      if (cancelled) return;
      if (userToggledMinimizedRef.current) return;
      setMinimized(value);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const { pos, size, dragHandleProps, resizeGripProps } = useDragResize(slug);

  function toggleMinimized(next: boolean) {
    userToggledMinimizedRef.current = true;
    setMinimized(next);
    if (slug) void setPanelMinimized(slug, next);
  }

  function pauseToggle() {
    void sendTimerControl({ type: status === 'paused' ? 'TIMER_RESUME' : 'TIMER_PAUSE', tabId: -1 });
  }

  function markSolved() {
    if (!slug) return;
    setPhase('solved');
    void sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed });
  }

  const rootStyle: React.CSSProperties = {
    width: size.width,
    ...(size.height !== undefined ? { height: size.height, maxHeight: size.height } : {}),
    ...(pos !== null ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {}),
  };

  if (!slug) return null;
  if (dismissed) return null;
  if (minimized) {
    return (
      <MinimizedBar
        remaining={remaining}
        status={status}
        phase={phase}
        pendingCount={0}
        raceOpponent={null}
        acceptedAt={null}
        onHint={() => {}}
        onPauseToggle={pauseToggle}
        onMarkSolved={markSolved}
        onExpand={() => toggleMinimized(false)}
      />
    );
  }

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
        <span className="lb-header__right">
          <Timer remainingFromWorker={remaining} status={status} />
          <button
            className="lb-header__minimize"
            onClick={e => { e.stopPropagation(); toggleMinimized(true); }}
            onPointerDown={e => e.stopPropagation()}
            title="Minimize"
            aria-label="Minimize panel"
          >
            ▾
          </button>
        </span>
      </div>
      <div className="lb-body">
        <div style={{ opacity: 0.7, fontSize: 11 }}>{title} · {difficulty}</div>
        {(challengePhase === 'racing' || challengePhase === 'waiting') && activeChallenge && (
          <ChallengeBanner
            challenge={activeChallenge}
            meId={meId}
            friendHandle={friendProfile?.handle ?? '?'}
            onCancel={async () => {
              await sendToWorker({ type: 'CHALLENGE_CANCEL', challengeId: activeChallenge.id });
              setActiveChallenge(null);
              setChallengePhase('none');
            }}
          />
        )}
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

        {phase === 'solved' && challengePhase !== 'picking' && challengePhase !== 'result' && (
          <SolveRating slug={slug} title={title} difficulty={difficulty} hintTierUsed={hintTierUsed} onRated={() => setDismissed(true)} />
        )}
        {phase === 'solved' && challengePhase === 'cta' && solveData && (
          <ChallengeCTA timeMs={solveData.timeMs} onChallenge={() => setChallengePhase('picking')} />
        )}
        {challengePhase === 'picking' && solveData && (
          <FriendPicker
            solveData={solveData}
            problemSlug={slug}
            problemTitle={title}
            onSent={() => {
              void sendToWorker<{ ok: boolean; challenge: Challenge | null; friendProfile: Profile | null; meId: string }>(
                { type: 'GET_ACTIVE_CHALLENGE', slug },
              ).then(res => {
                if (res?.ok && res.challenge) setActiveChallenge(res.challenge);
              });
              setChallengePhase('waiting');
            }}
            onCancel={() => setChallengePhase('cta')}
          />
        )}
        {challengePhase === 'result' && activeChallenge && (
          <ResultScreen
            challenge={activeChallenge}
            meId={meId}
            friendHandle={friendProfile?.handle ?? '?'}
            streakCount={streakCount}
            onDismiss={() => { setChallengePhase('none'); setActiveChallenge(null); }}
          />
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
