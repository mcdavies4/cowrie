'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

function LoginInner() {
  const params = useSearchParams();
  const next = params.get('next') || '/deals/new';
  const authError = params.get('error') === 'auth';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setErr('');
    const supa = browserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  return (
    <div className="wrap">
      <div className="brand"><Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link></div>
      <p className="eyebrow">Sign in</p>
      <h1 className="hero display" style={{ fontSize: 30 }}>Owner sign-in</h1>
      <p className="muted">You only need an account to create and manage deals. Collaborators don&apos;t — they accept by link.</p>

      {authError && <p className="err">That sign-in link didn&apos;t work — it may have expired or already been used. Request a fresh one below.</p>}

      <div className="card">
        {sent ? (
          <p className="ok" style={{ marginTop: 0 }}>Check your email for a sign-in link.</p>
        ) : (
          <>
            <label className="label">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" />
            <button className="btn block" style={{ marginTop: 14 }} onClick={send} disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
            {err && <p className="err">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  return <Suspense fallback={<div className="wrap"><p className="muted">Loading…</p></div>}><LoginInner /></Suspense>;
}
