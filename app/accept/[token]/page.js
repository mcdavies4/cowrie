'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { computePlatformFee } from '../../../lib/fees';
import { allocate, toMajor } from '../../../lib/money';

const COLORS = ['var(--jade)', 'var(--gold)', 'var(--cream)', '#8b7fd6', '#e8765b'];

function money(minor, ccy) {
  const major = toMajor(minor, ccy);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (ccy || 'gbp').toUpperCase() }).format(major); }
  catch { return `${major.toFixed(2)}`; }
}

export default function AcceptPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // FLW bank form state
  const [acctNo, setAcctNo] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [done, setDone] = useState(false);

  async function postJson(url, body) {
    const opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { method: 'POST' };
    const res = await fetch(url, opts);
    let json = {};
    try { json = await res.json(); } catch { /* non-JSON response */ }
    return { ok: res.ok, json };
  }

  async function load() {
    try {
      const res = await fetch(`/api/accept/${token}`, { cache: 'no-store' });
      let json = {};
      try { json = await res.json(); } catch {}
      if (res.ok) setData(json); else setErr(json.error || 'Could not load this deal.');
    } catch { setErr('Network error loading the deal. Please refresh.'); }
  }
  useEffect(() => { load(); }, [token]);

  async function accept() {
    setBusy(true); setErr('');
    try {
      const { ok, json } = await postJson(`/api/splits/${token}/accept`);
      if (!ok) { setErr(json.error || 'Could not accept your share. Please try again.'); return; }
      await load();
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resolveBank() {
    setBusy(true); setErr(''); setResolvedName('');
    try {
      const { ok, json } = await postJson('/api/onboard/flutterwave', {
        action: 'resolve', creator_id: data.creator.id, account_number: acctNo, account_bank: bankCode, token,
      });
      if (!ok) { setErr(json.error || 'Could not check that account. Check the number and bank code.'); return; }
      setResolvedName(json.account_name);
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function confirmBank() {
    setBusy(true); setErr('');
    try {
      const { ok, json } = await postJson('/api/onboard/flutterwave', {
        action: 'create', creator_id: data.creator.id, account_number: acctNo, account_bank: bankCode, business_name: resolvedName, token,
      });
      if (!ok) { setErr(json.error || 'Could not save that account. Please try again.'); return; }
      setDone(true); await load();
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function startStripe() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/onboard/stripe?creator=${data.creator.id}&token=${token}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) { setErr(json.error || 'Could not start Stripe setup.'); return; }
      window.location.href = json.url;
    } catch { setErr('Network error starting Stripe setup.'); }
    finally { setBusy(false); }
  }

  if (err && !data) return <div className="wrap"><p className="err">{err}</p></div>;
  if (!data) return <div className="wrap"><p className="muted">Loading…</p></div>;

  const { deal, split, creator, all } = data;
  const feePct = Number(deal.platform_fee_percent || 0);
  const feeMinor = computePlatformFee(deal.total_amount_minor, feePct, deal.platform_fee_cap_minor);
  const distributable = deal.total_amount_minor - feeMinor;
  const allAmounts = allocate(distributable, all.map((s, i) => ({ id: s.creator_email, percent: s.percent })));
  const myShareMinor = allAmounts[split.creator_email] || 0;
  const accepted = !!split.agreed_at;
  const onboarded = data.onboarded || done;

  return (
    <div className="wrap">
      <div className="brand"><Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link></div>

      <p className="eyebrow">You&apos;ve been added to a deal</p>
      <h1 className="hero display" style={{ fontSize: 30 }}>{deal.title}</h1>
      {deal.brand_name && <p className="muted" style={{ marginTop: 0 }}>From {deal.brand_name} · {money(deal.total_amount_minor, deal.currency)} total</p>}

      <div className="card">
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Your share</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="total" style={{ color: 'var(--gold)' }}>{split.percent}%</span>
          <span className="mono" style={{ fontSize: 18 }}>{money(myShareMinor, deal.currency)}</span>
        </div>
        {feePct > 0 && <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>after {feePct}% platform fee</p>}
        <div className="sharebar" style={{ marginTop: 14 }} aria-hidden>
          {all.map((s, i) => <span key={i} style={{ width: `${s.percent}%`, background: s.creator_email === split.creator_email ? 'var(--gold)' : COLORS[(i % COLORS.length)] }} />)}
        </div>
        <div className="legend">
          {all.map((s, i) => (
            <div className="item" key={i}>
              <span className="swatch" style={{ background: s.creator_email === split.creator_email ? 'var(--gold)' : COLORS[i % COLORS.length] }} />
              <span className="who">{s.creator_email === split.creator_email ? `${s.creator_email} (you)` : s.creator_email}</span>
              <span className="amt muted">{s.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: accept */}
      {!accepted && (
        <>
          <p className="muted" style={{ fontSize: 14 }}>Accepting confirms you agree to this {split.percent}% share. The terms can&apos;t be changed after you accept.</p>
          <button className="btn block" onClick={accept} disabled={busy}>{busy ? 'Accepting…' : `Accept my ${split.percent}% share`}</button>
        </>
      )}

      {/* Step 2: set up payout */}
      {accepted && !onboarded && (
        <div className="card">
          <h2 className="display">Set up where your money lands</h2>
          {deal.rail === 'stripe' ? (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>You&apos;ll verify your identity and add a bank account with Stripe. Takes a couple of minutes.</p>
              <button className="btn block" onClick={startStripe} disabled={busy}>{busy ? 'Starting…' : 'Set up payout with Stripe'}</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Enter your bank account. We&apos;ll check the name before saving.</p>
              <label className="label">Account number</label>
              <input className="mono" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} placeholder="0690000037" inputMode="numeric" />
              <label className="label">Bank code</label>
              <input className="mono" value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="044 (Access Bank)" />
              {!resolvedName
                ? <button className="btn block" style={{ marginTop: 14 }} onClick={resolveBank} disabled={busy || !acctNo || !bankCode}>{busy ? 'Checking…' : 'Check account name'}</button>
                : (
                  <>
                    <p className="ok">Account name: <strong>{resolvedName}</strong> — is this you?</p>
                    <div className="row">
                      <button className="btn ghost" onClick={() => setResolvedName('')}>No, edit</button>
                      <button className="btn" onClick={confirmBank} disabled={busy}>{busy ? 'Saving…' : 'Yes, save'}</button>
                    </div>
                  </>
                )}
            </>
          )}
        </div>
      )}

      {/* Done */}
      {accepted && onboarded && (
        <div className="card">
          <p className="ok" style={{ marginTop: 0 }}>✓ You&apos;re all set. When the brand pays, your {money(myShareMinor, deal.currency)} lands automatically.</p>
          <Link className="btn ghost block" href="/" style={{ marginTop: 12 }}>Done</Link>
        </div>
      )}

      {err && <p className="err">{err}</p>}
    </div>
  );
}
