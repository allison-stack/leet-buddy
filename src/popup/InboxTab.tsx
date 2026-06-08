import { useEffect, useState } from 'react';
import type { Challenge } from '@/shared/types';

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

export function InboxTab() {
  const [pending, setPending] = useState<Challenge[]>([]);
  const [recent,  setRecent]  = useState<Challenge[]>([]);

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
      <div style={{ padding: 16, opacity: 0.7, fontSize: 13 }}>
        No challenges yet — solve a problem and challenge a friend from the panel.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      {pending.length > 0 && (
        <section>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', opacity: 0.6 }}>Pending</h4>
          {pending.map(c => (
            <div key={c.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 4,
              background: '#1e3a5f', color: '#e0e0e0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.problem_title}</div>
                <div style={{ opacity: 0.7, fontSize: 11 }}>{formatExpiry(c.expires_at)}</div>
              </div>
              <button
                onClick={() => accept(c)}
                style={{ padding: '4px 10px', cursor: 'pointer' }}
              >
                Accept →
              </button>
            </div>
          ))}
        </section>
      )}
      {recent.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', opacity: 0.6 }}>Recent</h4>
          {recent.map(c => (
            <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee', opacity: 0.8 }}>
              {c.problem_title} · {c.recipient_time_ms !== null ? formatMs(c.recipient_time_ms) : '—'}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
