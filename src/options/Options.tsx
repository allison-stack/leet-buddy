import { useEffect, useState } from 'react';
import { getSettings, setSettings, defaultSettings, setLocal, getLocal } from '@/shared/storage';
import type { Settings, LlmProvider, DailySource } from '@/shared/types';

const PROVIDERS: Array<{ id: LlmProvider; label: string; model: string; note: string }> = [
  { id: 'groq', label: 'Groq (default, free)', model: 'llama-3.3-70b-versatile',
    note: 'Free tier. Groq retains prompts/responses for abuse monitoring but does not use them for training.' },
  { id: 'gemini', label: 'Google AI Studio (Gemini, free)', model: 'gemini-2.5-flash',
    note: "Free tier sends your code and problem context to Google's training pipeline. Switch to a paid Gemini key if that's not OK for you." },
  { id: 'anthropic', label: 'Anthropic (paid)', model: 'claude-haiku-4-5-20251001',
    note: 'Paid. No data used for training.' },
  { id: 'openai', label: 'OpenAI (paid)', model: 'gpt-4o-mini',
    note: 'Paid. API data not used for training by default.' },
];

const SOURCES: Array<{ id: DailySource; label: string; note?: string }> = [
  { id: 'lc-daily', label: 'LeetCode Daily Challenge' },
  { id: 'blind-75', label: 'Blind 75' },
  { id: 'neetcode-150', label: 'NeetCode 150' },
  { id: 'lc-75', label: 'LeetCode 75' },
  { id: 'company', label: 'Company-tagged (Premium required)',
    note: 'Requires an active LeetCode Premium session in this browser.' },
];

export function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [localKey, setLocalKey] = useState<string>('');

  useEffect(() => {
    (async () => {
      setS(await getSettings());
      setLocalKey((await getLocal<string>('api_key')) ?? '');
    })();
  }, []);

  if (!s) return null;

  async function save(next: Settings) {
    setS(next);
    await setSettings(next);
  }

  async function saveLocalKey(k: string) {
    setLocalKey(k);
    await setLocal('api_key', k);
  }

  const providerMeta = PROVIDERS.find(p => p.id === s.llm.provider)!;

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Leet Buddy Settings</h1>

      <section style={section}>
        <h2>LLM Provider</h2>
        <select value={s.llm.provider} onChange={e => save({
          ...s, llm: { ...s.llm, provider: e.target.value as LlmProvider,
                       model: PROVIDERS.find(p => p.id === e.target.value)!.model } })}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <p style={note}>{providerMeta.note}</p>

        <label>Model: <input value={s.llm.model} onChange={e => save({ ...s, llm: { ...s.llm, model: e.target.value } })} /></label>

        <div style={{ marginTop: 12 }}>
          <div>API key storage:</div>
          <label><input type="radio" checked={s.llm.keyStorage === 'sync'}
            onChange={() => save({ ...s, llm: { ...s.llm, keyStorage: 'sync' } })} /> Sync across my Chrome (plaintext in Google account)</label><br />
          <label><input type="radio" checked={s.llm.keyStorage === 'local'}
            onChange={() => save({ ...s, llm: { ...s.llm, keyStorage: 'local' } })} /> This device only</label>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>API key: <input type="password" style={{ width: 360 }}
            value={s.llm.keyStorage === 'sync' ? s.apiKey ?? '' : localKey}
            onChange={e => s.llm.keyStorage === 'sync'
              ? save({ ...s, apiKey: e.target.value })
              : saveLocalKey(e.target.value)} /></label>
        </div>
      </section>

      <section style={section}>
        <h2>Daily problem</h2>
        <label>
          <input type="checkbox" checked={s.dailyReminder.enabled}
            onChange={e => save({ ...s, dailyReminder: { ...s.dailyReminder, enabled: e.target.checked } })} />
          Daily reminder
        </label>
        <div>
          <label>Time: <input type="time" value={s.dailyReminder.time}
            onChange={e => save({ ...s, dailyReminder: { ...s.dailyReminder, time: e.target.value } })} /></label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Source:
            <select value={s.dailySource} onChange={e => save({ ...s, dailySource: e.target.value as DailySource })}>
              {SOURCES.map(src => <option key={src.id} value={src.id}>{src.label}</option>)}
            </select>
          </label>
          {SOURCES.find(src => src.id === s.dailySource)?.note && (
            <p style={note}>{SOURCES.find(src => src.id === s.dailySource)?.note}</p>
          )}
        </div>
        <label style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={s.newTabOverride}
            onChange={e => save({ ...s, newTabOverride: e.target.checked })} />
          Override new-tab page with today's problem
        </label>
        <p style={note}>If off, the new-tab page shows a minimal placeholder (Chrome doesn't allow restoring the native new-tab without uninstalling the extension).</p>
      </section>

      <section style={section}>
        <h2>Timer thresholds (seconds)</h2>
        {(['easy', 'medium', 'hard'] as const).map(d => (
          <div key={d}><label>{d}: <input type="number" min={30} max={3600}
            value={s.timerOverrides[d]} onChange={e => save({
              ...s, timerOverrides: { ...s.timerOverrides, [d]: Number(e.target.value) },
            })} /></label></div>
        ))}
      </section>

      <section style={section}>
        <h2>Limits</h2>
        <label>Hourly request cap: <input type="number" min={1} max={500}
          value={s.hourlyRequestCap}
          onChange={e => save({ ...s, hourlyRequestCap: Number(e.target.value) })} /></label>
      </section>

      <section style={section}>
        <h2>Backup</h2>
        <button onClick={async () => {
          const sync = await chrome.storage.sync.get(null);
          const blob = new Blob([JSON.stringify(sync, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `leet-buddy-${new Date().toISOString().slice(0, 10)}.json`;
          a.click(); URL.revokeObjectURL(url);
        }}>Export progress</button>
        <input type="file" accept="application/json" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const text = await file.text();
          try {
            const data = JSON.parse(text);
            await chrome.storage.sync.set(data);
            alert('Imported. Reload the options page to see changes.');
          } catch { alert('Invalid file.'); }
        }} style={{ marginLeft: 12 }} />
      </section>

      <section style={section}>
        <h2>Reset</h2>
        <button onClick={async () => {
          if (!confirm('Erase all settings and progress?')) return;
          await chrome.storage.sync.clear();
          await chrome.storage.local.clear();
          setS(defaultSettings);
        }}>Reset everything</button>
      </section>
    </div>
  );
}

const section: React.CSSProperties = { marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee' };
const note: React.CSSProperties = { color: '#666', fontSize: 13, marginTop: 4 };
