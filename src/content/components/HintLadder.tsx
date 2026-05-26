import { useState } from 'react';
import { sendToWorker } from '@/shared/messages';
import type { Difficulty, HintTier } from '@/shared/types';
import { HINT_TIER_DESCRIPTIONS } from '@/shared/constants';

interface Props {
  slug: string;
  problemStatement: string;
  difficulty: Difficulty;
  userCode: string;
  approachText?: string;
}

export function HintLadder({ slug, problemStatement, difficulty, userCode, approachText }: Props) {
  const [hints, setHints] = useState<{ tier: HintTier; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextTier = (hints.length + 1) as HintTier;

  async function requestNext() {
    if (nextTier > 4) return;
    setLoading(true);
    setError(null);
    const res = await sendToWorker<{ ok: boolean; payload?: { text: string }; error?: string }>({
      type: 'REQUEST_HINT',
      payload: {
        slug, problemStatement, difficulty, userCode,
        tier: nextTier, priorHints: hints.map(h => h.text), approachText,
      },
    });
    setLoading(false);
    if (res.ok && res.payload) setHints(h => [...h, { tier: nextTier, text: res.payload!.text }]);
    else setError(res.error ?? 'unknown error');
  }

  return (
    <div className="lb-section">
      {hints.map(h => (
        <div key={h.tier} className="lb-hint">
          <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 4 }}>
            Tier {h.tier} · {HINT_TIER_DESCRIPTIONS[h.tier]}
          </div>
          {h.text}
        </div>
      ))}
      {error && <div style={{ color: '#ff6b6b', marginTop: 8 }}>{error}</div>}
      {nextTier <= 4 && (
        <button className="lb-btn primary" disabled={loading} onClick={requestNext} style={{ marginTop: 8 }}>
          {loading ? 'Thinking…' : hints.length === 0 ? 'Show first hint' : 'I need more'}
        </button>
      )}
    </div>
  );
}
