import { useEffect, useState } from 'react';
import type { PopupState } from '@/shared/messages';

export function Popup() {
  const [state, setState] = useState<PopupState | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_POPUP_STATE' }).then((r: { ok: boolean; payload: PopupState }) => {
      if (r.ok) setState(r.payload);
    });
  }, []);

  if (!state) return <div style={{ padding: 16, width: 280 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, width: 280, fontFamily: 'system-ui', fontSize: 13 }}>
      <h3 style={{ margin: 0 }}>Leet Buddy</h3>
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
