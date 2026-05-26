import { sendToWorker } from '@/shared/messages';
import type { Difficulty, HintTier } from '@/shared/types';

interface Props {
  slug: string;
  title: string;
  difficulty: Difficulty;
  hintTierUsed: 0 | HintTier;
  onRated: () => void;
}

export function SolveRating({ slug, title, difficulty, hintTierUsed, onRated }: Props) {
  async function rate(q: 1 | 3 | 4 | 5) {
    await sendToWorker({ type: 'MARK_SOLVED', slug, title, difficulty, hintTierUsed });
    await sendToWorker({ type: 'RATE_SOLVE', slug, quality: q });
    onRated();
  }
  return (
    <div className="lb-section">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Solved! How hard was it?</div>
      <div className="lb-row">
        <button className="lb-btn" onClick={() => rate(1)}>Again</button>
        <button className="lb-btn" onClick={() => rate(3)}>Hard</button>
        <button className="lb-btn" onClick={() => rate(4)}>Good</button>
        <button className="lb-btn primary" onClick={() => rate(5)}>Easy</button>
      </div>
    </div>
  );
}
