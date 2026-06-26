import { useEffect, useState } from 'react';
import type { TimerStatus } from '@/shared/messages';
import type { Phase } from '@/shared/types';
import { Timer } from './Timer';

interface Props {
  elapsed: number;
  status: TimerStatus;
  phase: Phase;
  pendingCount: number;
  raceOpponent: string | null;
  acceptedAt: string | null;
  onHint: () => void;
  onPauseToggle: () => void;
  onMarkSolved: () => void;
  onExpand: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MinimizedBar({
  elapsed, status, phase, pendingCount, raceOpponent, acceptedAt,
  onHint, onPauseToggle, onMarkSolved, onExpand,
}: Props) {
  const isSolved = phase === 'solved';
  const isPaused = status === 'paused';

  const [raceElapsed, setRaceElapsed] = useState(() =>
    acceptedAt ? Date.now() - new Date(acceptedAt).getTime() : 0
  );
  useEffect(() => {
    if (!acceptedAt) return;
    setRaceElapsed(Date.now() - new Date(acceptedAt).getTime());
    const id = setInterval(() => {
      setRaceElapsed(Date.now() - new Date(acceptedAt).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [acceptedAt]);

  return (
    <div className="lb-bar" role="toolbar" aria-label="Leet Buddy minimized">
      <span className="lb-bar__logo" aria-hidden="true">LB</span>
      <Timer elapsedFromWorker={elapsed} status={status} pastThreshold={status === 'fired' || status === 'solved'} />
      {pendingCount > 0 && (
        <span style={{
          background: '#e03030', color: '#fff', borderRadius: 10,
          fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4,
        }}>
          {pendingCount}
        </span>
      )}
      {raceOpponent && acceptedAt && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14, margin: '0 1px' }}>|</span>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>⚔️ @{raceOpponent}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ffd580', fontWeight: 600 }}>
            {formatMs(raceElapsed)}
          </span>
        </>
      )}
      <span className="lb-bar__spacer" />
      {!isSolved && (
        <button className="lb-bar__btn" style={{ color: '#ffa116' }}
          disabled={status !== 'fired' && status !== 'solved'}
          onClick={onHint} title="Get a hint" aria-label="Get a hint">
          [?]
        </button>
      )}
      {!isSolved && (
        <button className="lb-bar__btn" style={{ color: '#9ca3af' }}
          onClick={onPauseToggle}
          title={isPaused ? 'Resume' : 'Pause'}
          aria-label={isPaused ? 'Resume timer' : 'Pause timer'}>
          {isPaused ? '[▶]' : '[⏸]'}
        </button>
      )}
      {!isSolved && (
        <button className="lb-bar__btn" style={{ color: '#4ade80' }}
          onClick={onMarkSolved} title="Mark solved" aria-label="Mark solved">
          [✓]
        </button>
      )}
      {isSolved && (
        <span className="lb-bar__solved" aria-label="Solved" title="Solved">[✓]</span>
      )}
      <button className="lb-bar__btn" style={{ color: '#6b7280' }}
        onClick={onExpand} title="Expand" aria-label="Expand panel">
        [^]
      </button>
    </div>
  );
}
