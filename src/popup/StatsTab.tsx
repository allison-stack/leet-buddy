import type { PopupState } from '@/shared/messages';

interface Props { state: PopupState }

export function StatsTab({ state }: Props) {
  return (
    <div style={{ padding: 14, fontSize: 13 }}>
      <div style={{
        textAlign: 'center', padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 12,
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#ffa116', lineHeight: 1 }}>
          {state.streakDays}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>
          day streak 🔥
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Today
        </div>
        {state.todaysProblem ? (
          <a
            href={`https://leetcode.com/problems/${state.todaysProblem.slug}/`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#ffa116', fontSize: 12, textDecoration: 'none' }}
          >
            {state.todaysProblem.title} ({state.todaysProblem.difficulty})
            {state.todaysProblemCompleted && ' ✓'}
          </a>
        ) : (
          <span style={{ color: '#4b5563', fontSize: 12 }}>No pick yet.</span>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <StatRow label="Reviews due" value={String(state.reviewsDue)} />
        {state.reviewItems.length > 0 && (
          <div style={{ padding: '6px 0 2px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {state.reviewItems.map(item => (
              <a
                key={item.slug}
                href={`https://leetcode.com/problems/${item.slug}/`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block', padding: '3px 0', fontSize: 12,
                  color: '#e0e0e0', textDecoration: 'none',
                }}
              >
                {item.title}{' '}
                <span style={{
                  fontSize: 10,
                  color: item.difficulty === 'easy' ? '#00b8a3'
                    : item.difficulty === 'medium' ? '#ffa116' : '#ef4743',
                }}>
                  {item.difficulty}
                </span>
              </a>
            ))}
          </div>
        )}
        <StatRow label="Tokens today" value={state.tokensUsedToday.toLocaleString()} />
      </div>

      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        style={{
          width: '100%', marginTop: 12, padding: '7px 0',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: '#e0e0e0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ⚙️ Settings
      </button>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
