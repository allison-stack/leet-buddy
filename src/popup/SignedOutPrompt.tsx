import { useEffect, useState } from 'react';
import type { Profile } from '@/shared/types';

type Step = 'email' | 'code';

interface Props { onSignedIn: (user: Profile) => void }

// chrome.storage.local key under which we persist mid-flow sign-in state, so
// the popup can be closed (to switch tabs and check email) without losing the
// "we already sent you a code for <email>" context.
const SIGN_IN_STATE_KEY = 'signin_state';

const COOLDOWN_SECONDS = 60;

interface PersistedState { step: Step; email: string; codeSentAt?: number }

export function SignedOutPrompt({ onSignedIn }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Restore mid-flow state on mount (popup may have been closed/reopened
  // between sending the code and entering it).
  useEffect(() => {
    chrome.storage.local.get(SIGN_IN_STATE_KEY).then((res) => {
      const saved = res[SIGN_IN_STATE_KEY] as PersistedState | undefined;
      if (saved?.step === 'code' && saved.email) {
        setStep('code');
        setEmail(saved.email);
        if (saved.codeSentAt) {
          const remaining = COOLDOWN_SECONDS - Math.floor((Date.now() - saved.codeSentAt) / 1000);
          if (remaining > 0) setCooldown(remaining);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendCode = async () => {
    setBusy(true); setError(null);
    const now = Date.now();
    await chrome.storage.local.set({ [SIGN_IN_STATE_KEY]: { step: 'code', email, codeSentAt: now } });
    const res: { ok: boolean; error?: string } = await chrome.runtime.sendMessage({
      type: 'AUTH_SEND_OTP', email,
    });
    setBusy(false);
    if (!res.ok) {
      await chrome.storage.local.remove(SIGN_IN_STATE_KEY);
      setError(res.error ?? 'Failed to send code');
      return;
    }
    setStep('code');
    setCooldown(COOLDOWN_SECONDS);
  };

  const verify = async () => {
    setBusy(true); setError(null);
    const res: { ok: boolean; user?: Profile; error?: string } = await chrome.runtime.sendMessage({
      type: 'AUTH_VERIFY_OTP', email, code,
    });
    setBusy(false);
    if (!res.ok || !res.user) { setError(res.error ?? 'Invalid code'); return; }
    await chrome.storage.local.remove(SIGN_IN_STATE_KEY);
    onSignedIn(res.user);
  };

  const resetToEmailStep = async () => {
    await chrome.storage.local.remove(SIGN_IN_STATE_KEY);
    setStep('email'); setCode(''); setError(null);
  };

  return (
    <div style={wrap}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight: 700, color: '#ffa116', fontSize: 14 }}>leet-buddy</span>
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13, color: '#f0f0f0' }}>Sign in</p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
          We email you a 6-digit code. No password.
        </p>

        {step === 'email' ? (
          <>
            <input
              placeholder="email@example.com"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && email.includes('@') && !busy && cooldown <= 0) void sendCode(); }}
              style={input}
            />
            <button onClick={sendCode} disabled={busy || !email.includes('@') || cooldown > 0} style={btn(busy || !email.includes('@') || cooldown > 0)}>
              {cooldown > 0 ? `Send code in ${cooldown}s` : busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
              Check <span style={{ color: '#9ca3af' }}>{email}</span> for a 6-digit code.
            </p>
            <input
              placeholder="6-digit code"
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter' && code.length === 6 && !busy) void verify(); }}
              style={input}
            />
            <button onClick={verify} disabled={busy || code.length !== 6} style={btn(busy || code.length !== 6)}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={sendCode} disabled={busy || cooldown > 0} style={linkBtn}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button onClick={resetToEmailStep} style={linkBtn}>
              Use a different email
            </button>
          </>
        )}

        {error && <p style={errorStyle}>{error}</p>}

        <div style={settingsRow}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
            Just want hints? An account is only needed for challenges.
          </p>
          <button onClick={() => chrome.runtime.openOptionsPage()} style={linkBtn}>
            Configure API key in Settings →
          </button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: 300, fontFamily: 'system-ui', fontSize: 13,
  background: '#262626', color: '#f0f0f0',
};
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', marginBottom: 8,
  fontSize: 12, fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e0e0e0', outline: 'none',
};
const btn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '8px 0', marginBottom: 4,
  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
  background: disabled ? 'rgba(255,161,22,0.4)' : '#ffa116',
  border: 'none', borderRadius: 6, color: '#1a1a1a',
  opacity: disabled ? 0.6 : 1,
});
const linkBtn: React.CSSProperties = {
  width: '100%', padding: '6px 0', marginTop: 2,
  fontSize: 12, background: 'transparent', border: 0,
  color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
};
const errorStyle: React.CSSProperties = { color: '#f87171', fontSize: 12, marginTop: 8 };
const settingsRow: React.CSSProperties = {
  marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)',
};
