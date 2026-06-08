import { useEffect, useState } from 'react';
import type { Challenge } from '@/shared/types';

interface Props {
  challenge: Challenge;
  meId: string;
  friendHandle: string;
  onCancel: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ChallengeBanner({ challenge, meId, friendHandle, onCancel }: Props) {
  const isRacing = challenge.accepted_at !== null && challenge.recipient_id === meId;
  const isWaiting = challenge.sender_id === meId;

  const [elapsed, setElapsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (isRacing && challenge.accepted_at) {
        setElapsed(Date.now() - new Date(challenge.accepted_at).getTime());
      } else if (isWaiting) {
        setTimeLeft(Math.max(0, new Date(challenge.expires_at).getTime() - Date.now()));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRacing, isWaiting, challenge.accepted_at, challenge.expires_at]);

  return (
    <div style={{
      padding: '6px 10px', marginBottom: 8, borderRadius: 4,
      background: isRacing ? '#1e3a5f' : '#2d2d2d',
      color: '#e0e0e0', fontSize: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {isRacing ? (
        <span>⚔️ Racing @{friendHandle} · <code style={{ fontFamily: 'monospace' }}>{formatMs(elapsed)}</code></span>
      ) : (
        <span>⏳ @{friendHandle} — {formatMs(timeLeft)} left to accept</span>
      )}
      <button
        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 11 }}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
