import { useEffect, useState } from 'react';
import type { FriendsListEntry } from '@/shared/types';

interface SolveData { timeMs: number; lcRuntimePct?: number; lcMemPct?: number }

interface Props {
  solveData: SolveData;
  problemSlug?: string;
  problemTitle?: string;
  onSent: (challengeId: string) => void;
  onCancel: () => void;
}

export function FriendPicker({ solveData, problemSlug = '', problemTitle = '', onSent, onCancel }: Props) {
  const [friends, setFriends] = useState<FriendsListEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'FRIENDS_LIST' }).then((res: { ok: boolean; accepted?: FriendsListEntry[] }) => {
      if (res.ok) setFriends(res.accepted ?? []);
    });
  }, []);

  const send = async (friendId: string) => {
    setBusy(true);
    const res: { ok: boolean; challengeId?: string } = await chrome.runtime.sendMessage({
      type: 'CHALLENGE_CREATE',
      friendId,
      problemSlug,
      problemTitle,
      timeMs: solveData.timeMs,
      lcRuntimePct: solveData.lcRuntimePct,
      lcMemPct: solveData.lcMemPct,
    });
    setBusy(false);
    if (res.ok && res.challengeId) onSent(res.challengeId);
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>Challenge a friend</div>
      {friends.length === 0 ? (
        <div style={{ opacity: 0.6, fontSize: 12 }}>
          No friends yet — add one in the extension popup.
        </div>
      ) : (
        friends.map(f => (
          <div key={f.friendshipId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: f.profile.avatar_color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12 }}>@{f.profile.handle}</span>
            <button className="lb-btn" onClick={() => send(f.profile.id)} disabled={busy}>Send</button>
          </div>
        ))
      )}
      <button className="lb-btn" style={{ marginTop: 8, opacity: 0.7 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}
