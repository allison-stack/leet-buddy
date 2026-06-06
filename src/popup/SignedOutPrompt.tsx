import { useState } from 'react';
import type { Profile } from '@/shared/types';

type Step = 'email' | 'code';

interface Props { onSignedIn: (user: Profile) => void }

export function SignedOutPrompt({ onSignedIn }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true); setError(null);
    const res: { ok: boolean; error?: string } = await chrome.runtime.sendMessage({
      type: 'AUTH_SEND_OTP', email,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Failed to send code'); return; }
    setStep('code');
  };

  const verify = async () => {
    setBusy(true); setError(null);
    const res: { ok: boolean; user?: Profile; error?: string } = await chrome.runtime.sendMessage({
      type: 'AUTH_VERIFY_OTP', email, code,
    });
    setBusy(false);
    if (!res.ok || !res.user) { setError(res.error ?? 'Invalid code'); return; }
    onSignedIn(res.user);
  };

  return (
    <div style={wrap}>
      <h3 style={{ margin: 0 }}>Sign in</h3>
      <p style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
        We email you a 6-digit code. No password.
      </p>

      {step === 'email' ? (
        <>
          <input
            placeholder="email@example.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={input}
          />
          <button onClick={sendCode} disabled={busy || !email.includes('@')} style={btn}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
            Check {email} for a 6-digit code.
          </p>
          <input
            placeholder="6-digit code"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={input}
          />
          <button onClick={verify} disabled={busy || code.length !== 6} style={btn}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button onClick={() => { setStep('email'); setCode(''); setError(null); }} style={linkBtn}>
            Use a different email
          </button>
        </>
      )}

      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}

const wrap: React.CSSProperties = { padding: 16, width: 320, fontFamily: 'system-ui', fontSize: 13 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 8, marginTop: 8, fontSize: 13 };
const btn: React.CSSProperties = { width: '100%', padding: 8, marginTop: 8, fontSize: 13, cursor: 'pointer' };
const linkBtn: React.CSSProperties = { width: '100%', padding: 8, marginTop: 4, fontSize: 12, background: 'transparent', border: 0, color: '#2563eb', cursor: 'pointer' };
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 12, marginTop: 8 };
