import type { Challenge } from '@/shared/types';

interface Props {
  challenge: Challenge;
  meId: string;
  friendHandle: string;
  streakCount: number;
  onDismiss: () => void;
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ResultScreen({ challenge, meId, friendHandle, streakCount, onDismiss }: Props) {
  const iWon = challenge.winner_id === meId;
  const myTimeMs = challenge.recipient_id === meId ? challenge.recipient_time_ms : challenge.sender_time_ms;
  const friendTimeMs = challenge.recipient_id === meId ? challenge.sender_time_ms : challenge.recipient_time_ms;
  const myPct = challenge.recipient_id === meId ? challenge.recipient_lc_runtime_pct : challenge.sender_lc_runtime_pct;
  const friendPct = challenge.recipient_id === meId ? challenge.sender_lc_runtime_pct : challenge.recipient_lc_runtime_pct;

  return (
    <div style={{ padding: '8px 0', fontSize: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: iWon ? '#16a34a' : '#dc2626' }}>
        {iWon ? '🎉 You won' : `@${friendHandle} won`}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ opacity: 0.6 }}>You</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{formatMs(myTimeMs)}</div>
          {myPct !== null && myPct !== undefined && <div style={{ opacity: 0.6 }}>{myPct}% faster</div>}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ opacity: 0.6 }}>@{friendHandle}</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{formatMs(friendTimeMs)}</div>
          {friendPct !== null && friendPct !== undefined && <div style={{ opacity: 0.6 }}>{friendPct}% faster</div>}
        </div>
      </div>
      {streakCount > 0 && (
        <div style={{ marginBottom: 8 }}>🔥 {streakCount} win streak</div>
      )}
      <button className="lb-btn" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
