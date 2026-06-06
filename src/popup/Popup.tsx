import { useEffect, useState } from 'react';
import type { PopupState } from '@/shared/messages';
import type { Profile } from '@/shared/types';
import { SignedOutPrompt } from './SignedOutPrompt';

type AuthState = 'loading' | 'signed-out' | 'signed-in';

export function Popup() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [state, setState] = useState<PopupState | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }).then((r: { ok: boolean; user: Profile | null }) => {
      setUser(r.user);
      setAuthState(r.user ? 'signed-in' : 'signed-out');
    });

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
  if (!state) return <div style={{ padding: 16, width: 280 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, width: 320, fontFamily: 'system-ui', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Leet Buddy</h3>
        {user && <span style={{ fontSize: 11, opacity: 0.7 }}>@{user.handle}</span>}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ opacity: 0.7 }}>Today</div>
        {state.todaysProblem ? (
          <a href={`https://leetcode.com/problems/${state.todaysProblem.slug}/`} target="_blank" rel="noreferrer"
             style={{ color: '#ffa116' }}>
            {state.todaysProblem.title} ({state.todaysProblem.difficulty})
            {state.todaysProblemCompleted && ' ✓'}
          </a>
        ) : 'No pick yet.'}
      </div>
      <div style={{ marginTop: 8 }}>Reviews due: <strong>{state.reviewsDue}</strong></div>
      <div style={{ marginTop: 4 }}>Streak: <strong>{state.streakDays}</strong> day(s)</div>
      <div style={{ marginTop: 4, opacity: 0.7 }}>Tokens used today: {state.tokensUsedToday}</div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>
    </div>
  );
}
