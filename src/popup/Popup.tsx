import { useEffect, useState } from 'react';
import type { PopupState } from '@/shared/messages';
import type { Profile } from '@/shared/types';
import { SignedOutPrompt } from './SignedOutPrompt';
import { FriendsTab } from './FriendsTab';
import { InboxTab } from './InboxTab';
import { StatsTab } from './StatsTab';

type AuthState = 'loading' | 'signed-out' | 'signed-in';
type Tab = 'inbox' | 'friends' | 'stats';

export function Popup() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [state, setState] = useState<PopupState | null>(null);
  const [tab, setTab] = useState<Tab>('friends');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' })
      .then((r: { ok: boolean; user: Profile | null }) => {
        setUser(r.user ?? null);
        setAuthState(r.user ? 'signed-in' : 'signed-out');
      })
      .catch(() => setAuthState('signed-out'));

    const listener = (msg: { type: string; user?: Profile | null }) => {
      if (msg.type === 'AUTH_STATE') {
        setUser(msg.user ?? null);
        setAuthState(msg.user ? 'signed-in' : 'signed-out');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (authState !== 'signed-in') return;
    chrome.runtime.sendMessage({ type: 'GET_POPUP_STATE' }).then((r: { ok: boolean; payload: PopupState }) => {
      if (r.ok) setState(r.payload);
    });
  }, [authState]);

  if (authState === 'loading') return <div style={{ padding: 16, width: 280 }}>Loading…</div>;
  if (authState === 'signed-out') {
    return <SignedOutPrompt onSignedIn={(u) => { setUser(u); setAuthState('signed-in'); }} />;
  }

  return (
    <div style={{ width: 360, fontFamily: 'system-ui', fontSize: 13 }}>
      <header style={headerStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Leet Buddy</h3>
        {user && <span style={{ fontSize: 11, opacity: 0.7 }}>@{user.handle}</span>}
      </header>

      <nav style={navStyle} role="tablist">
        <TabButton current={tab} value="inbox"   label="Inbox"   onClick={setTab} />
        <TabButton current={tab} value="friends" label="Friends" onClick={setTab} />
        <TabButton current={tab} value="stats"   label="Stats"   onClick={setTab} />
      </nav>

      {tab === 'inbox'   && <InboxTab />}
      {tab === 'friends' && <FriendsTab />}
      {tab === 'stats'   && (state
        ? <StatsTab state={state} />
        : <div style={{ padding: 16, opacity: 0.7 }}>Loading…</div>)}
    </div>
  );
}

interface TabButtonProps { current: Tab; value: Tab; label: string; onClick: (t: Tab) => void }

function TabButton({ current, value, label, onClick }: TabButtonProps) {
  const active = current === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onClick(value)}
      style={{
        flex: 1, padding: '8px 0',
        background: 'transparent', border: 0,
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        fontWeight: active ? 600 : 400, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', borderBottom: '1px solid #eee',
};
const navStyle: React.CSSProperties = {
  display: 'flex', borderBottom: '1px solid #eee',
};
