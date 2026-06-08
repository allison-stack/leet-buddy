interface Props {
  timeMs: number;
  onChallenge: () => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ChallengeCTA({ timeMs, onChallenge }: Props) {
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 10 }}>
      <button
        className="lb-btn"
        onClick={onChallenge}
        style={{ width: '100%', textAlign: 'center' }}
      >
        ⚔️ Challenge a friend · {formatMs(timeMs)}
      </button>
    </div>
  );
}
