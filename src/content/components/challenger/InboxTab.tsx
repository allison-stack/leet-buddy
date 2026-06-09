import { useEffect, useState } from 'react';
import type { Challenge } from '@/shared/types';

interface Props {
  meId: string;
}

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h left` : `${m}m left`;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function InboxTab({ meId }: Props) {
  const [pending, setPending] = useState<Challenge[]>([]);
  const [recent, setRecent] = useState<Challenge[]>([]);

  const refresh = async () => {
    const res: { ok: boolean; pending?: Challenge[]; recent?: Challenge[] } =
      await chrome.runtime.sendMessage({ type: 'CHALLENGE_INBOX_GET' });
    if (res.ok) {
      setPending(res.pending ?? []);
      setRecent(res.recent ?? []);
    }
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const handler = (msg: { type: string; pending?: Challenge[]; recent?: Challenge[] }) => {
      if (msg.type === 'CHALLENGE_INBOX_UPDATED') {
        setPending(msg.pending ?? []);
        setRecent(msg.recent ?? []);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const accept = async (challenge: Challenge) => {
    await chrome.runtime.sendMessage({ type: 'CHALLENGE_ACCEPT', challengeId: challenge.id });
    chrome.tabs.update({ url: `https://leetcode.com/problems/${challenge.problem_slug}/` });
  };

  if (pending.length === 0 && recent.length === 0) {
    return (
      <div style={{ padding: '16px 0', color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
        No challenges yet — solve a problem and challenge a friend.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px', marginBottom: 6 }}>
        Pending
      </div>
      {pending.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 11, marginBottom: 10 }}>No pending challenges</div>
      ) : pending.map(c => (
        <div key={c.id} style={{
          background: 'rgba(255,161,22,0.08)', border: '1px solid rgba(255,161,22,0.18)',
          borderRadius: 6, padding: '8px 10px', marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{c.problem_title}</div>
            <div style={{ color: '#6b7280', fontSize: 10, marginTop: 1 }}>{formatExpiry(c.expires_at)}</div>
          </div>
          <button
            onClick={() => void accept(c)}
            style={{
              padding: '3px 10px', background: '#ffa116', border: 'none',
              borderRadius: 5, color: '#1a1a1a', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Accept
          </button>
        </div>
      ))}

      {recent.length > 0 && (
        <>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px', marginBottom: 4, marginTop: 4 }}>
            Recent
          </div>
          <div className="lb-scroll" style={{ maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
            {recent.map(c => {
              const isExpired = c.state === 'expired_forfeit' || c.state === 'expired_no_contest';
              const iWon = c.state === 'completed' && c.winner_id === meId;
              const iLost = c.state === 'completed' && c.winner_id !== null && c.winner_id !== meId;
              const myTime = c.recipient_time_ms !== null ? formatMs(c.recipient_time_ms) : '';
              return (
                <div key={c.id} style={{
                  padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: '#9ca3af' }}>{c.problem_title}</span>
                  <span style={{ fontSize: 10, color: isExpired ? '#6b7280' : iWon ? '#4ade80' : iLost ? '#f87171' : '#9ca3af' }}>
                    {isExpired ? '⏰ Expired' : iWon ? `🏆 ${myTime}` : iLost ? `😔 ${myTime}` : myTime}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
