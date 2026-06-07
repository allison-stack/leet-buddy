import { useEffect, useState } from 'react';
import type {
  FriendsListEntry, RequestFriendshipStatus,
} from '@/shared/types';
import type { FriendsListResponse } from '@/shared/messages';

interface AddResult {
  status: RequestFriendshipStatus;
  friendshipId?: string;
  target: string;
}

export function FriendsTab() {
  const [accepted, setAccepted]   = useState<FriendsListEntry[]>([]);
  const [incoming, setIncoming]   = useState<FriendsListEntry[]>([]);
  const [outgoing, setOutgoing]   = useState<FriendsListEntry[]>([]);
  const [target, setTarget]       = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
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

  useEffect(() => { refresh(); }, []);

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
    setBusy(true);
    await chrome.runtime.sendMessage({ type: 'FRIEND_ACCEPT', friendshipId });
    setBusy(false);
    await refresh();
  };

  const onRemove = async (friendshipId: string, handle: string) => {
    if (!confirm(`Remove @${handle}?`)) return;
    setBusy(true);
    await chrome.runtime.sendMessage({ type: 'FRIEND_REMOVE', friendshipId });
    setBusy(false);
    await refresh();
  };

  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <h4 style={{ margin: '0 0 8px' }}>Add a friend</h4>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          placeholder="handle or email"
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={{ flex: 1, padding: 6 }}
        />
        <button onClick={onAdd} disabled={busy || !target.trim()}>Add</button>
      </div>
      {addResult && <AddResultLine result={addResult} />}
      {error && <p style={{ color: '#dc2626', marginTop: 6 }}>{error}</p>}

      {outgoing.length > 0 && (
        <section style={section}>
          <h4 style={h}>Sent</h4>
          {outgoing.map(e => (
            <Row key={e.friendshipId} entry={e} muted suffix="waiting…" />
          ))}
        </section>
      )}

      {incoming.length > 0 && (
        <section style={section}>
          <h4 style={h}>Requests</h4>
          {incoming.map(e => (
            <Row
              key={e.friendshipId}
              entry={e}
              action={<button onClick={() => onAccept(e.friendshipId)} disabled={busy}>Accept</button>}
            />
          ))}
        </section>
      )}

      <section style={section}>
        <h4 style={h}>Friends</h4>
        {accepted.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No friends yet. Add someone above.</div>
        ) : (
          accepted.map(e => (
            <Row
              key={e.friendshipId}
              entry={e}
              action={
                <button onClick={() => onRemove(e.friendshipId, e.profile.handle)} disabled={busy}>
                  Remove
                </button>
              }
            />
          ))
        )}
      </section>
    </div>
  );
}

function AddResultLine({ result }: { result: AddResult }) {
  switch (result.status) {
    case 'created':
      return <p style={{ color: '#16a34a', marginTop: 6 }}>Request sent.</p>;
    case 'already_pending':
      return <p style={{ marginTop: 6 }}>Request already pending.</p>;
    case 'already_accepted':
      return <p style={{ marginTop: 6 }}>You're already friends.</p>;
    case 'self':
      return <p style={{ marginTop: 6 }}>That's you.</p>;
    case 'not_found':
      return (
        <p style={{ marginTop: 6 }}>
          No leet-buddy user for <em>{result.target}</em>.{' '}
          <a href={mailtoInvite(result.target)}>Invite them</a>
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

interface RowProps {
  entry: FriendsListEntry;
  action?: React.ReactNode;
  muted?: boolean;
  suffix?: string;
}

function Row({ entry, action, muted, suffix }: RowProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 0', borderBottom: '1px solid #eee',
        opacity: muted ? 0.7 : 1,
      }}
    >
      <span
        style={{
          width: 20, height: 20, borderRadius: 10,
          background: entry.profile.avatar_color, flexShrink: 0,
        }}
        aria-hidden
      />
      <span style={{ flex: 1 }}>
        @{entry.profile.handle}
        {suffix && <span style={{ marginLeft: 6, opacity: 0.6 }}>{suffix}</span>}
      </span>
      {action}
    </div>
  );
}

const section: React.CSSProperties = { marginTop: 14 };
const h: React.CSSProperties = { margin: '0 0 4px', fontSize: 12, textTransform: 'uppercase', opacity: 0.6 };
