import { useState } from 'react';
import { sendToWorker } from '@/shared/messages';
import type { ApproachEvalResponse, Difficulty } from '@/shared/types';

interface Props {
  slug: string;
  problemStatement: string;
  difficulty: Difficulty;
  onResult: (r: ApproachEvalResponse) => void;
  onSkip: () => void;
}

export function ApproachPrompt({ slug, problemStatement, difficulty, onResult, onSkip }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!text.trim()) { onSkip(); return; }
    setLoading(true);
    const res = await sendToWorker<{ ok: boolean; payload?: ApproachEvalResponse; error?: string }>({
      type: 'REQUEST_APPROACH_EVAL',
      payload: { slug, problemStatement, difficulty, approachText: text },
    });
    setLoading(false);
    if (res.ok && res.payload) onResult(res.payload);
  }

  return (
    <div className="lb-section">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Got an approach?</div>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>
        Drop 1–3 sentences. I'll sanity-check before you start coding.
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box', background: '#2d2d2d', color: '#f0f0f0',
                 border: '1px solid #3d3d3d', borderRadius: 6, padding: 8 }}
        placeholder="e.g. iterate the array, store each (target - n) in a hash map…"
      />
      <div className="lb-row">
        <button className="lb-btn primary" disabled={loading} onClick={submit}>
          {loading ? 'Checking…' : 'Check my approach'}
        </button>
        <button className="lb-btn" onClick={onSkip}>Skip — just give me a hint</button>
      </div>
    </div>
  );
}
