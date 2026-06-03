import type { TimerStatus } from '@/shared/messages';
import { Timer } from './Timer';

type Phase = 'timing' | 'approach' | 'hint' | 'solved';

interface Props {
  remaining: number;
  status: TimerStatus;
  phase: Phase;
  onPauseToggle: () => void;
  onMarkSolved: () => void;
  onExpand: () => void;
}

export function MinimizedBar({ remaining, status, phase, onPauseToggle, onMarkSolved, onExpand }: Props) {
  const isSolved = phase === 'solved';
  const isPaused = status === 'paused';

  return (
    <div className="lb-bar" role="toolbar" aria-label="Leet Buddy minimized">
      <span className="lb-bar__logo" aria-hidden="true">LB</span>
      <Timer remainingFromWorker={remaining} status={status} />
      {!isSolved && (
        <>
          <button
            className="lb-bar__btn"
            onClick={onPauseToggle}
            title={isPaused ? 'Resume' : 'Pause'}
            aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button
            className="lb-bar__btn"
            onClick={onMarkSolved}
            title="Mark solved"
            aria-label="Mark solved"
          >
            ✓
          </button>
        </>
      )}
      {isSolved && (
        <span className="lb-bar__solved" aria-label="Solved" title="Solved">✓</span>
      )}
      <button
        className="lb-bar__btn lb-bar__expand"
        onClick={onExpand}
        title="Expand"
        aria-label="Expand panel"
      >
        ▲
      </button>
    </div>
  );
}
