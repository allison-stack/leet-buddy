import { useEffect, useState } from 'react';
import type { FriendsListEntry, RequestFriendshipStatus } from '@/shared/types';
import type { FriendsListResponse } from '@/shared/messages';

interface AddResult {
  status: RequestFriendshipStatus;
  friendshipId?: string;
  target: string;
}

export function FriendsTab() {
  const [accepted, setAccepted] = useState<FriendsListEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendsListEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendsListEntry[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<AddResult | null>(null);

  const refresh = async () => {
    setError(null);
    const res: FriendsListResponse | { ok: false; error: string } =
      await chrome.runtime.sendMessage({ type: 'FRIENDS_LIST' });
    if (!res.ok) { setError(res.error); return; }
    setAccepted(res.accepted);
    setIncoming(res.incoming);
    setOutgoing(res.outgoing);
  };

  useEffect(() => { void refresh(); }, []);

  const onAdd = async () => {
    if (!target.trim()) return;
    setBusy(true); setError(null); setAddResult(null);
    const res: { ok: boolean; status?: RequestFriendshipStatus; friendshipId?: string; error?: string } =
      await chrome.runtime.sendMessage({ type: 'FRIEND_ADD', target: target.trim() });
    setBusy(false);
    if (!res.ok || !res.status) { setError(res.error ?? 'Add failed'); return; }
    setAddResult({ status: res.status, friendshipId: res.friendshipId, target: target.trim() });
    if (res.status === 'created' || res.status === 'already_pending' || res.status === 'already_accepted') {
      setTarget('');
      await refresh();
    }
  };

  const onAccept = async (friendshipId: string) => {
    setBusy(true); setError(null);
    const res: { ok: boolean; error?: string } =
      await chrome.runtime.sendMessage({ type: 'FRIEND_ACCEPT', friendshipId });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Accept failed'); return; }
    await refresh();
  };

  const onRemove = async (friendshipId: string, handle: string) => {
    if (!confirm(`Remove @${handle}?`)) return;
    setBusy(true); setError(null);
    const res: { ok: boolean; error?: string } =
      await chrome.runtime.sendMessage({ type: 'FRIEND_REMOVE', friendshipId });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Remove failed'); return; }
    await refresh();
  };

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          placeholder="handle or email"
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void onAdd(); }}
          style={{
            flex: 1, padding: '5px 8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#e0e0e0', fontSize: 11, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => void onAdd()}
          disabled={busy || !target.trim()}
          style={{
            padding: '5px 10px', background: '#ffa116', border: 'none',
            borderRadius: 6, color: '#1a1a1a', fontSize: 11, fontWeight: 700,
            cursor: busy || !target.trim() ? 'default' : 'pointer',
            opacity: busy || !target.trim() ? 0.6 : 1,
          }}
        >
          Add
        </button>
      </div>
      {addResult && <AddResultLine result={addResult} />}
      {error && <p style={{ color: '#f87171', marginTop: 4, fontSize: 11 }}>{error}</p>}

      {outgoing.length > 0 && (
        <section style={{ marginBottom: 8 }}>
          <SectionLabel>Sent</SectionLabel>
          {outgoing.map(e => <FriendRow key={e.friendshipId} entry={e} suffix="waiting…" />)}
        </section>
      )}

      {incoming.length > 0 && (
        <section style={{ marginBottom: 8 }}>
          <SectionLabel>Requests</SectionLabel>
          <div className="lb-scroll" style={{ maxHeight: 70, overflowY: 'auto', paddingRight: 4 }}>
            {incoming.map(e => (
              <FriendRow
                key={e.friendshipId}
                entry={e}
                action={
                  <button onClick={() => void onAccept(e.friendshipId)} disabled={busy}
                    style={ghostOrangeBtn}>
                    Accept
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Friends</SectionLabel>
        {accepted.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 11 }}>No friends yet. Add someone above.</div>
        ) : (
          <div className="lb-scroll" style={{ maxHeight: 100, overflowY: 'auto', paddingRight: 4 }}>
            {accepted.map(e => (
              <FriendRow
                key={e.friendshipId}
                entry={e}
                action={
                  <button onClick={() => void onRemove(e.friendshipId, e.profile.handle)} disabled={busy}
                    style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: 10, cursor: 'pointer' }}>
                    Remove
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px', marginBottom: 4 }}>
      {children}
    </div>
  );
}

interface FriendRowProps { entry: FriendsListEntry; action?: React.ReactNode; suffix?: string }

function FriendRow({ entry, action, suffix }: FriendRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ width: 16, height: 16, borderRadius: 8, background: entry.profile.avatar_color, flexShrink: 0 }} aria-hidden />
      <span style={{ flex: 1, color: '#e0e0e0' }}>
        @{entry.profile.handle}
        {suffix && <span style={{ marginLeft: 6, color: '#6b7280', fontSize: 10 }}>{suffix}</span>}
      </span>
      {action}
    </div>
  );
}

function AddResultLine({ result }: { result: AddResult }) {
  switch (result.status) {
    case 'created':
      return <p style={{ color: '#4ade80', marginTop: 4, fontSize: 11 }}>Request sent.</p>;
    case 'already_pending':
      return <p style={{ color: '#9ca3af', marginTop: 4, fontSize: 11 }}>Request already pending.</p>;
    case 'already_accepted':
      return <p style={{ color: '#9ca3af', marginTop: 4, fontSize: 11 }}>You're already friends.</p>;
    case 'self':
      return <p style={{ color: '#9ca3af', marginTop: 4, fontSize: 11 }}>That's you.</p>;
    case 'not_found':
      return (
        <p style={{ color: '#9ca3af', marginTop: 4, fontSize: 11 }}>
          No leet-buddy user for <em>{result.target}</em>.
          {result.target.includes('@') && (
            <> <a href={mailtoInvite(result.target)} style={{ color: '#ffa116' }}>Invite them</a></>
          )}
        </p>
      );
  }
}

function mailtoInvite(target: string): string {
  const subject = encodeURIComponent("Let's race on LeetCode");
  const body = encodeURIComponent(
    "I'm using leet-buddy to challenge friends on LeetCode problems — beat my time, " +
    'see who wins. Install the extension and sign in, then add my handle to challenge me back.',
  );
  return `mailto:${target}?subject=${subject}&body=${body}`;
}

const ghostOrangeBtn: React.CSSProperties = {
  padding: '2px 7px', background: 'rgba(255,161,22,0.15)',
  border: '1px solid rgba(255,161,22,0.3)', borderRadius: 4,
  color: '#ffa116', fontSize: 10, cursor: 'pointer',
};
