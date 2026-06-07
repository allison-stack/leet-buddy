import type { PopupState } from '@/shared/messages';

interface Props { state: PopupState }

export function StatsTab({ state }: Props) {
  return (
    <div style={{ padding: 16, fontSize: 13 }}>
      <div style={{ opacity: 0.7 }}>Today</div>
      {state.todaysProblem ? (
        <a
          href={`https://leetcode.com/problems/${state.todaysProblem.slug}/`}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#ffa116' }}
        >
          {state.todaysProblem.title} ({state.todaysProblem.difficulty})
          {state.todaysProblemCompleted && ' ✓'}
        </a>
      ) : 'No pick yet.'}
      <div style={{ marginTop: 8 }}>Reviews due: <strong>{state.reviewsDue}</strong></div>
      <div style={{ marginTop: 4 }}>Streak: <strong>{state.streakDays}</strong> day(s)</div>
      <div style={{ marginTop: 4, opacity: 0.7 }}>Tokens used today: {state.tokensUsedToday}</div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>
    </div>
  );
}
