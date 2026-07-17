import { useEffect, useRef, useState } from 'react';
import { slugFromUrl, readTitle, readDifficulty, readProblemStatement, onAcceptedVerdict } from '../leetcode-dom';
import { readMonacoContents, isSubstantive } from '../editor';
import { sendToWorker } from '@/shared/messages';
import type { ContentToWorker, TimerStatus } from '@/shared/messages';
import type { Difficulty, ApproachEvalResponse, Phase } from '@/shared/types';
import { ApproachPrompt } from './ApproachPrompt';
import { HintLadder } from './HintLadder';
import { SolveRating } from './SolveRating';
import { MinimizedBar } from './MinimizedBar';
import { useDragResize } from '../hooks/useDragResize';
import { getPanelMinimized, setPanelMinimized, getSettings, getProblems } from '@/shared/storage';
import { playTimerPing } from '../sound';
import type { Snapshot } from '@/background/timer-manager';
import type { Challenge, Profile } from '@/shared/types';
import { readSolveStats } from '../leetcode-dom';
import { ChallengeBanner } from './challenger/ChallengeBanner';
import { ChallengeCTA } from './challenger/ChallengeCTA';
import { FriendPicker } from './challenger/FriendPicker';
import { ResultScreen } from './challenger/ResultScreen';
import { InboxTab } from './challenger/InboxTab';
import { FriendsTab } from './challenger/FriendsTab';
import { Timer } from './Timer';
import { InterviewHud } from './interview/InterviewHud';

type PanelTab = 'solve' | 'inbox' | 'friends';

export function Panel() {
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [elapsed, setElapsed] = useState(0);
  const [thresholdSeconds, setThresholdSeconds] = useState(Infinity);
  const [flashHints, setFlashHints] = useState(false);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [phase, setPhase] = useState<Phase>('timing');
  const [approachResult, setApproachResult] = useState<ApproachEvalResponse | null>(null);
  const [starter, setStarter] = useState<string>('');
  const [hintTierUsed, setHintTierUsed] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('solve');
  const [pendingCount, setPendingCount] = useState(0);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [interviewActive, setInterviewActive] = useState(false);
  const [interviewSessionSeconds, setInterviewSessionSeconds] = useState(1800);
  const interviewStartElapsedRef = useRef(0);
  const interviewActiveRef = useRef(false);
  interviewActiveRef.current = interviewActive;

  type ChallengePhase = 'none' | 'racing' | 'waiting' | 'cta' | 'picking' | 'result';
  interface SolveData { timeMs: number; lcRuntimePct?: number; lcMemPct?: number }

  const [challengePhase, setChallengePhase] = useState<ChallengePhase>('none');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
  const [solveData, setSolveData] = useState<SolveData | null>(null);
  const [storedSolveData, setStoredSolveData] = useState<SolveData | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [meId, setMeId] = useState('');
  const activeChallengeRef = useRef<Challenge | null>(null);
  activeChallengeRef.current = activeChallenge;

  function formatSolveMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const starterRef = useRef(starter);
  starterRef.current = starter;
  const hintsUnlocked = status === 'solved' || elapsed >= thresholdSeconds;
  const prevHintsUnlockedRef = useRef(false);
  const userToggledMinimizedRef = useRef(false);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' })
      .then((r: { ok: boolean; user: { id: string } | null }) => {
        setIsSignedIn(!!r?.user);
      })
      .catch(() => setIsSignedIn(false));

    const authHandler = (msg: { type: string; user?: { id: string } | null }) => {
      if (msg.type === 'AUTH_STATE') setIsSignedIn(!!msg.user);
    };
    chrome.runtime.onMessage.addListener(authHandler);
    return () => chrome.runtime.onMessage.removeListener(authHandler);
  }, []);

  useEffect(() => {
    function initProblem() {
      const s = slugFromUrl();
      if (!s) return;
      setSlug(s);
      setTitle(readTitle());
      const d = readDifficulty();
      setDifficulty(d);
      setDismissed(false);
      setPhase('timing');
      setApproachResult(null);
      setHintTierUsed(0);
      setElapsed(0);
      setStatus('idle');
      setFlashHints(false);
      setStoredSolveData(null);
      setChallengePhase('none');
      setActiveChallenge(null);
      setFriendProfile(null);
      setSolveData(null);
      setInterviewActive(false);
      prevHintsUnlockedRef.current = false;
      void sendToWorker<{ ok: boolean; snapshot?: Snapshot }>({ type: 'TIMER_START', tabId: -1, slug: s, difficulty: d })
        .then(res => {
          if (res?.snapshot) {
            setElapsed(res.snapshot.elapsedSeconds);
            setThresholdSeconds(res.snapshot.thresholdSeconds);
            setStatus(res.snapshot.status);
          }
        });
      void getProblems().then(problems => {
        const rec = problems[s];
        if (rec?.lastSolveMs) {
          setStoredSolveData({ timeMs: rec.lastSolveMs, lcRuntimePct: rec.lastSolveLcRuntimePct, lcMemPct: rec.lastSolveLcMemPct });
        }
      });
    }

    initProblem();

    let lastSlug = slugFromUrl();
    const id = setInterval(() => {
      const cur = slugFromUrl();
      if (cur && cur !== lastSlug) {
        lastSlug = cur;
        setTimeout(initProblem, 600);
      }
    }, 500);
    return () => clearInterval(id);
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

    void chrome.runtime.sendMessage({ type: 'CHALLENGE_INBOX_GET' })
      .then((r: { ok: boolean; pending?: Challenge[] }) => {
        if (r?.ok) setPendingCount(r.pending?.length ?? 0);
      })
      .catch(() => {/* signed out — badge stays 0 */});
  }, [slug]);

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
    const handler = (msg: { type: string; elapsedSeconds?: number; status?: TimerStatus }) => {
      if (msg.type === 'TIMER_TICK') {
        if (typeof msg.elapsedSeconds === 'number') setElapsed(msg.elapsedSeconds);
        if (msg.status) setStatus(msg.status);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    if (status !== 'running' && status !== 'fired') return;
    const id = setInterval(() => setElapsed(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (hintsUnlocked && !prevHintsUnlockedRef.current && !interviewActiveRef.current) {
      setFlashHints(true);
      const code = readMonacoContents();
      setPhase(isSubstantive(code, starterRef.current, 30) ? 'hint' : 'approach');
      void (async () => {
        const settings = await getSettings();
        if (settings.timerSoundEnabled) await playTimerPing();
      })();
    }
    prevHintsUnlockedRef.current = hintsUnlocked;
  }, [hintsUnlocked]);

  useEffect(() => {
    if (!slug) return;
    const handler = (msg: { type: string; challenge?: Challenge; pending?: Challenge[]; recent?: Challenge[] }) => {
      if (msg.type === 'CHALLENGE_RESULT_READY' && msg.challenge) {
        setActiveChallenge(msg.challenge);
        setChallengePhase('result');
      }
      if (msg.type === 'CHALLENGE_INBOX_UPDATED') {
        setPendingCount(msg.pending?.length ?? 0);
        const justCompleted = msg.recent?.find(c => c.id === activeChallengeRef.current?.id);
        if (justCompleted) {
          setActiveChallenge(justCompleted);
          void sendToWorker<{ ok: boolean; streak?: number }>({ type: 'GET_STREAK_COUNT' })
            .then(r => setStreakCount(r?.streak ?? 0));
          setChallengePhase('result');
          return;
        }
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
      const timerRes = await sendToWorker<{ ok: boolean; snapshot?: Snapshot }>({ type: 'GET_TIMER_STATE', tabId: -1 });
      const timeMs = timerRes?.snapshot?.elapsedMs ?? 0;
      const lcStats = readSolveStats();
      const data: SolveData = { timeMs, lcRuntimePct: lcStats?.lcRuntimePct, lcMemPct: lcStats?.lcMemPct };
      setSolveData(data);
      void sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed, timeMs, lcRuntimePct: lcStats?.lcRuntimePct, lcMemPct: lcStats?.lcMemPct });

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

  async function startInterview() {
    const settings = await getSettings();
    setInterviewSessionSeconds((settings.interview?.sessionMinutes ?? 30) * 60);
    interviewStartElapsedRef.current = elapsed;
    setInterviewActive(true);
  }

  const interviewRemaining = Math.max(
    0, interviewSessionSeconds - (elapsed - interviewStartElapsedRef.current),
  );

  function formatCountdown(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
        elapsed={elapsed}
        status={status}
        hintsUnlocked={hintsUnlocked}
        phase={phase}
        pendingCount={pendingCount}
        raceOpponent={challengePhase === 'racing' ? (friendProfile?.handle ?? null) : null}
        acceptedAt={challengePhase === 'racing' ? (activeChallenge?.accepted_at ?? null) : null}
        onHint={() => { if (phase !== 'solved') setPhase('hint'); }}
        onPauseToggle={pauseToggle}
        onMarkSolved={markSolved}
        onExpand={() => {
          toggleMinimized(false);
          if (pendingCount > 0) setActiveTab('inbox');
        }}
      />
    );
  }

  async function sendTimerControl(msg: ContentToWorker) {
    const r = await sendToWorker<{ ok: boolean; snapshot?: { status: TimerStatus; elapsedSeconds: number } }>(msg);
    if (r?.ok && r.snapshot) {
      setStatus(r.snapshot.status);
      setElapsed(r.snapshot.elapsedSeconds);
    }
  }

  const diffColor = difficulty === 'easy' ? '#4ade80' : difficulty === 'medium' ? '#fbbf24' : '#f87171';

  return (
    <div className="lb-root" style={rootStyle}>
      <div className="lb-header" {...dragHandleProps}>
        <span style={{ color: '#ffa116', fontWeight: 700, fontSize: 13 }}>leet-buddy</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {title}&nbsp;·&nbsp;<span style={{ color: diffColor }}>{difficulty}</span>
          </span>
          <button
            className="lb-header__minimize"
            onClick={e => { e.stopPropagation(); toggleMinimized(true); }}
            onPointerDown={e => e.stopPropagation()}
            title="Minimize"
            aria-label="Minimize panel"
          >
            −
          </button>
        </span>
      </div>

      <div className="lb-body">
        {activeTab === 'solve' && (
          <div>
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              {interviewActive ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 700, color: interviewRemaining < 300 ? '#f87171' : '#f0f0f0' }}>
                    {formatCountdown(interviewRemaining)}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
                    interview
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={pauseToggle}
                    title={status === 'paused' ? 'Click to resume' : 'Click to pause'}
                  >
                    <Timer elapsedFromWorker={elapsed} status={status} pastThreshold={hintsUnlocked} />
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
                    {status === 'paused' ? 'paused' : status === 'idle' ? 'ready' : 'running'}
                  </div>
                </>
              )}
            </div>

            {!interviewActive && phase !== 'solved' && (
              <button className="lb-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => void startInterview()}>
                🎤 Mock interview
              </button>
            )}

            {interviewActive && (
              <InterviewHud
                slug={slug}
                title={title}
                difficulty={difficulty}
                problemStatement={readProblemStatement()}
                starter={starter}
                sessionSeconds={interviewSessionSeconds}
                remainingSeconds={interviewRemaining}
                solved={phase === 'solved'}
                onExit={() => setInterviewActive(false)}
              />
            )}

            {!interviewActive && (challengePhase === 'racing' || challengePhase === 'waiting') && activeChallenge && (
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

            {!interviewActive && isSignedIn && storedSolveData && phase !== 'solved' && challengePhase === 'none' && (
              <div className="lb-section">
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                  Previous solve: {formatSolveMs(storedSolveData.timeMs)}
                </div>
                <div className="lb-row">
                  <button
                    className="lb-btn primary"
                    style={{ flex: 1 }}
                    onClick={() => { setSolveData(storedSolveData); setChallengePhase('picking'); }}
                  >
                    ⚔️ Challenge
                  </button>
                  <button className="lb-btn" style={{ flex: 1 }} onClick={() => setStoredSolveData(null)}>
                    Redo
                  </button>
                </div>
              </div>
            )}

            {!interviewActive && phase !== 'solved' && (
              <div className="lb-row" style={{ marginTop: 8 }}>
                <button
                  className={`lb-btn${flashHints ? ' flash' : ''}`}
                  style={{ flex: 1 }}
                  disabled={!hintsUnlocked}
                  onClick={() => setPhase('hint')}
                  onAnimationEnd={() => setFlashHints(false)}
                >
                  💡 Hint
                </button>
                <button
                  className={`lb-btn${flashHints ? ' flash' : ''}`}
                  style={{ flex: 1 }}
                  disabled={!hintsUnlocked}
                  onClick={() => setPhase('approach')}
                  onAnimationEnd={() => setFlashHints(false)}
                >
                  🧠 Approach
                </button>
              </div>
            )}
            {!interviewActive && phase !== 'solved' && (
              <button className="lb-btn primary" style={{ width: '100%', marginTop: 8 }} onClick={markSolved}>
                Mark solved ✓
              </button>
            )}

            {!interviewActive && phase === 'approach' && (
              <ApproachPrompt
                slug={slug}
                problemStatement={readProblemStatement()}
                difficulty={difficulty}
                onResult={r => { setApproachResult(r); setPhase('hint'); }}
                onSkip={() => setPhase('hint')}
              />
            )}
            {!interviewActive && approachResult && (
              <div className="lb-hint">
                <strong>{approachResult.verdict.toUpperCase()}:</strong> {approachResult.message}
              </div>
            )}
            {!interviewActive && phase === 'hint' && (
              <HintLadder
                slug={slug}
                problemStatement={readProblemStatement()}
                difficulty={difficulty}
                userCode={readMonacoContents()}
              />
            )}
            {!interviewActive && phase === 'solved' && challengePhase !== 'picking' && challengePhase !== 'result' && (
              <SolveRating slug={slug} title={title} difficulty={difficulty} hintTierUsed={hintTierUsed} onRated={() => setDismissed(true)} />
            )}
            {!interviewActive && phase === 'solved' && challengePhase === 'cta' && solveData && (
              <ChallengeCTA timeMs={solveData.timeMs} onChallenge={() => setChallengePhase('picking')} />
            )}
            {!interviewActive && challengePhase === 'picking' && solveData && (
              <FriendPicker
                solveData={solveData}
                problemSlug={slug}
                problemTitle={title}
                onSent={() => {
                  void sendToWorker<{ ok: boolean; challenge: Challenge | null; friendProfile: Profile | null; meId: string }>(
                    { type: 'GET_ACTIVE_CHALLENGE', slug },
                  ).then(res => {
                    if (res?.ok && res.challenge) setActiveChallenge(res.challenge);
                    if (res?.ok && res.friendProfile) setFriendProfile(res.friendProfile);
                  });
                  setChallengePhase('waiting');
                }}
                onCancel={() => setChallengePhase('cta')}
              />
            )}
            {!interviewActive && challengePhase === 'result' && activeChallenge && (
              <ResultScreen
                challenge={activeChallenge}
                meId={meId}
                friendHandle={friendProfile?.handle ?? '?'}
                streakCount={streakCount}
                onDismiss={() => { setChallengePhase('none'); setActiveChallenge(null); }}
              />
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          isSignedIn
            ? <InboxTab meId={meId} />
            : <SignedOutNudge />
        )}

        {activeTab === 'friends' && (
          isSignedIn
            ? <FriendsTab />
            : <SignedOutNudge />
        )}
      </div>

      <nav className="lb-bottom-nav" aria-label="Panel tabs">
        <button className={activeTab === 'solve' ? 'active' : ''} onClick={() => setActiveTab('solve')}>
          Solve
        </button>
        <button className={activeTab === 'inbox' ? 'active' : ''} onClick={() => setActiveTab('inbox')}>
          Inbox{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </button>
        <button className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>
          Friends
        </button>
      </nav>

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

function SignedOutNudge() {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
      Sign in via the extension icon to challenge friends.
    </div>
  );
}
