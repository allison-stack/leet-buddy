import { useEffect, useState } from 'react';
import type { TimerStatus } from '@/shared/messages';
import { TIMER_UI_TICK_MS } from '@/shared/constants';

interface Props {
  remainingFromWorker: number;
  status: TimerStatus;
}

export function Timer({ remainingFromWorker, status }: Props) {
  const [local, setLocal] = useState(remainingFromWorker);

  useEffect(() => { setLocal(remainingFromWorker); }, [remainingFromWorker]);

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setLocal(v => Math.max(0, v - 1)), TIMER_UI_TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  const mm = String(Math.floor(local / 60)).padStart(2, '0');
  const ss = String(local % 60).padStart(2, '0');
  return <span className="lb-timer">{mm}:{ss}</span>;
}
