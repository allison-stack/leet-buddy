import type { Debrief } from '@/shared/types';

interface Props {
  debrief: Debrief;
  onClose: () => void;
}

export function RubricCard({ debrief, onClose }: Props) {
  return (
    <div className="lb-section">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Interview debrief</div>
      <div style={{ fontSize: 12, marginBottom: 10, opacity: 0.9 }}>{debrief.spokenSummary}</div>

      {debrief.categories.map(c => (
        <div key={c.name} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>
            {c.name} — {c.score}/4
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>"{c.evidence}"</div>
          <div style={{ fontSize: 11 }}>Next time: {c.improvement}</div>
        </div>
      ))}

      {debrief.missedQuestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Missed questions</div>
          {debrief.missedQuestions.map((m, i) => (
            <div key={i} style={{ fontSize: 11, marginBottom: 6 }}>
              <div>{m.question}</div>
              <div style={{ color: '#f87171' }}>You said: {m.yourAnswer}</div>
              <div style={{ color: '#4ade80' }}>Answer: {m.correctAnswer}</div>
            </div>
          ))}
        </div>
      )}

      {debrief.processMisses.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Process</div>
          {debrief.processMisses.map((p, i) => (
            <div key={i} style={{ fontSize: 11, color: '#fbbf24' }}>{p}</div>
          ))}
        </div>
      )}

      <button className="lb-btn primary" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
