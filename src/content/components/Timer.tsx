import { useEffect, useState } from 'react';
import type { TimerStatus } from '@/shared/messages';
import { TIMER_UI_TICK_MS } from '@/shared/constants';

interface Props {
  elapsedFromWorker: number;
  status: TimerStatus;
  pastThreshold: boolean;
}

export function Timer({ elapsedFromWorker, status, pastThreshold }: Props) {
  const [local, setLocal] = useState(elapsedFromWorker);

  useEffect(() => { setLocal(elapsedFromWorker); }, [elapsedFromWorker]);

  useEffect(() => {
    if (status !== 'running' && status !== 'fired') return;
    const id = setInterval(() => setLocal(v => v + 1), TIMER_UI_TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  const mm = String(Math.floor(local / 60)).padStart(2, '0');
  const ss = String(local % 60).padStart(2, '0');
  const className = `lb-timer${pastThreshold ? ' lb-timer--past' : ''}`;
  return <span className={className}>{mm}:{ss}</span>;
}
