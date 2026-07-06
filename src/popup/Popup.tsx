import { useEffect, useState } from 'react';
import type { PopupState } from '@/shared/messages';
import type { Profile } from '@/shared/types';
import { SignedOutPrompt } from './SignedOutPrompt';
import { StatsTab } from './StatsTab';

type AuthState = 'loading' | 'signed-out' | 'signed-in';

const AUTH_TIMEOUT_MS = 5_000;

export function Popup() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [state, setState] = useState<PopupState | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setTimedOut(false);
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' })
      .then((r: { ok: boolean; user: Profile | null }) => {
        setUser(r.user ?? null);
        setAuthState(r.user ? 'signed-in' : 'signed-out');
      })
      .catch(() => setAuthState('signed-out'));
    const t = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [attempt]);

  useEffect(() => {
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

  if (authState === 'loading') {
    return (
      <div style={{ padding: 16, width: 280, fontFamily: 'system-ui', fontSize: 13 }}>
        {timedOut ? (
          <>
            <p style={{ margin: '0 0 8px' }}>The background worker isn&apos;t responding.</p>
            <button onClick={() => setAttempt(a => a + 1)}>Retry</button>
          </>
        ) : (
          'Loading…'
        )}
      </div>
    );
  }
  if (authState === 'signed-out') {
    return <SignedOutPrompt onSignedIn={(u) => { setUser(u); setAuthState('signed-in'); }} />;
  }

  return (
    <div style={{ width: 300, fontFamily: 'system-ui', fontSize: 13, background: '#262626', color: '#f0f0f0' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontWeight: 700, color: '#ffa116', fontSize: 14 }}>leet-buddy</span>
        {user && <span style={{ fontSize: 11, color: '#6b7280' }}>@{user.handle}</span>}
      </header>
      {state
        ? <StatsTab state={state} />
        : <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>}
    </div>
  );
}
