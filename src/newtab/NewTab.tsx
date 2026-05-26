import { useEffect, useState } from 'react';
import { getSettings, getDailyLog, getProblems } from '@/shared/storage';
import { isoToday, pickDaily } from '@/background/scheduler';
import { BLIND_75 } from '@/background/lists/blind-75';
import { NEETCODE_150 } from '@/background/lists/neetcode-150';
import { LC_75 } from '@/background/lists/lc-75';
import { getDailySlug } from '@/background/lists/lc-daily';
import type { DailySource } from '@/shared/types';

async function listForSource(source: DailySource): Promise<string[]> {
  switch (source) {
    case 'blind-75': return BLIND_75;
    case 'neetcode-150': return NEETCODE_150;
    case 'lc-75': return LC_75;
    case 'lc-daily': { const s = await getDailySlug(); return s ? [s] : []; }
    case 'company': return [];
  }
}

export function NewTab() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setEnabled(s.newTabOverride);
      if (!s.newTabOverride) return;

      const log = await getDailyLog();
      const problems = await getProblems();
      const today = isoToday(Date.now());

      const list = await listForSource(s.dailySource);
      const pick = pickDaily({ today, problems, log, list, now: Date.now() });
      setSlug(pick);
      if (pick) setTitle(problems[pick]?.title ?? pick);
      setCompleted(!!log[today]?.completed);
    })();
  }, []);

  if (enabled === null) return null;
  if (!enabled) {
    return <div style={{ padding: 48, color: '#999' }}>
      Leet Buddy is installed but the new-tab override is off. Toggle it in settings to see today's pick here.
    </div>;
  }
  if (!slug) return <div style={{ padding: 48 }}>No problem to recommend today.</div>;

  return (
    <div style={{ padding: 48, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
      <h1>Today's problem</h1>
      <p style={{ fontSize: 24, marginBottom: 8 }}>{title}</p>
      {completed
        ? <p style={{ color: '#5cb85c' }}>You finished this one today ✓</p>
        : <a href={`https://leetcode.com/problems/${slug}/`}
             style={{ display: 'inline-block', marginTop: 12, padding: '10px 18px',
                      background: '#ffa116', color: '#1a1a1a', borderRadius: 6,
                      textDecoration: 'none', fontWeight: 600 }}>
            Start
          </a>}
    </div>
  );
}
