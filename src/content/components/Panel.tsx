import { useEffect, useState } from 'react';
import { slugFromUrl, readTitle, readDifficulty } from '../leetcode-dom';
import { sendToWorker } from '@/shared/messages';
import type { TimerStatus } from '@/shared/messages';
import type { Difficulty } from '@/shared/types';
import { Timer } from './Timer';

export function Panel() {
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<TimerStatus>('idle');

  useEffect(() => {
    const s = slugFromUrl();
    if (!s) return;
    setSlug(s);
    setTitle(readTitle());
    setDifficulty(readDifficulty());
    void sendToWorker({ type: 'TIMER_START', tabId: -1, slug: s, difficulty: readDifficulty() });
  }, []);

  useEffect(() => {
    const handler = (msg: { type: string; remainingSeconds?: number; status?: TimerStatus }) => {
      if (msg.type === 'TIMER_TICK') {
        if (typeof msg.remainingSeconds === 'number') setRemaining(msg.remainingSeconds);
        if (msg.status) setStatus(msg.status);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  if (!slug) return null;

  return (
    <div className="lb-root">
      <div className="lb-header">
        <span>Leet Buddy</span>
        <Timer remainingFromWorker={remaining} status={status} />
      </div>
      <div style={{ opacity: 0.7, fontSize: 11 }}>{title} · {difficulty}</div>
      <div className="lb-row">
        <button className="lb-btn" onClick={() => sendToWorker({ type: 'TIMER_PAUSE', tabId: -1 })}>Pause</button>
        <button className="lb-btn" onClick={() => sendToWorker({ type: 'TIMER_RESUME', tabId: -1 })}>Resume</button>
        <button className="lb-btn" onClick={() => sendToWorker({ type: 'TIMER_RESET', tabId: -1 })}>Reset</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>status: {status}</div>
    </div>
  );
}
