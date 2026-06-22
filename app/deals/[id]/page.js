'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const COLORS = ['var(--jade)', 'var(--gold)', 'var(--cream)', '#8b7fd6', '#e8765b'];

function money(minor, ccy) {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (ccy || 'gbp').toUpperCase() }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)} ${(ccy || '').toUpperCase()}`; }
}

export default function DealPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [payUrl, setPayUrl] = useState('');

  async function load() {
    const res = await fetch(`/api/deals/${id}`, { cache: 'no-store' });
    const json = await res.json();
    if (res.ok) setData(json); else setErr(json.error);
  }
  useEffect(() => { load(); }, [id]);

  async function verifyPayment(silent) {
    if (!silent) { setChecking(true); setErr(''); }
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const transaction_id = sp.get('transaction_id') || null;
      const res = await fetch(`/api/deals/${id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id }), cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok) { await load(); }
      else if (!silent) { setErr(json.error || json.note || 'Payment not confirmed yet. If you just paid, wait a few seconds and check again.'); }
    } catch { if (!silent) setErr('Could not check payment. Please try again.'); }
    finally { if (!silent) setChecking(false); }
  }

  // When the payer is redirected back with ?paid=1, confirm with Flutterwave automatically.
  useEffect(() => {
    if (!data) return;
    const paidFlag = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1';
    if (paidFlag && data.deal.status !== 'distributed') { verifyPayment(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.deal?.id]);

  async function lock() {
    setBusy(true); setErr('');
    const res = await fetch(`/api/deals/${id}/lock`, { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(json.error); return; }
    setPayUrl(json.pay_url);
    load();
  }

  if (err && !data) return <div className="wrap"><p className="err">{err}</p></div>;
  if (!data) return <div className="wrap"><p className="muted">Loading…</p></div>;

  const { deal, splits } = data;
  const total = deal.total_amount_minor;
  const allAccepted = splits.every((s) => s.agreed_at);
  const allOnboarded = splits.every((s) => s.onboarding_complete);
  const isDraft = deal.status === 'draft';

  const statusPill = {
    draft: <span className="pill">Draft</span>,
    locked: <span className="pill gold">Locked — awaiting payment</span>,
    paid: <span className="pill go">Paid — settling</span>,
    distributed: <span className="pill go">Distributed ✓</span>,
  }[deal.status];

  return (
    <div className="wrap">
      <div className="brand"><Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link></div>

      <p className="eyebrow">{deal.rail === 'stripe' ? 'Stripe rail' : 'Flutterwave rail'} · {deal.currency.toUpperCase()}</p>
      <h1 className="hero display" style={{ fontSize: 30 }}>{deal.title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span className="total">{money(total, deal.currency)}</span>
        {statusPill}
      </div>
      {deal.brand_name && <p className="muted" style={{ marginTop: 0 }}>From {deal.brand_name}</p>}

      <div className="card">
        <div className="sharebar" aria-hidden>
          {splits.map((s, i) => <span key={s.id} style={{ width: `${s.percent}%`, background: COLORS[i % COLORS.length] }} />)}
        </div>
        <div className="legend">
          {splits.map((s, i) => (
            <div className="item" key={s.id}>
              <span className="swatch" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="who">
                {s.creator_email}
                <br />
                <span className="muted" style={{ fontSize: 12 }}>
                  {s.agreed_at ? '✓ accepted' : '○ not accepted'} ·{' '}
                  {s.onboarding_complete ? `✓ ${s.payout_label || 'payout set'}` : '○ payout not set'}
                </span>
              </span>
              <span className="amt">{s.percent}%<br /><span className="muted" style={{ fontSize: 12 }}>{s.amount_minor != null ? money(s.amount_minor, deal.currency) : '—'}</span></span>
            </div>
          ))}
        </div>
        {deal.platform_fee_percent > 0 && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            Platform fee: {deal.platform_fee_percent}%{deal.fee_minor ? ` · ${money(deal.fee_minor, deal.currency)}` : ''} — kept by you, off the top.
          </p>
        )}
      </div>
      {isDraft && (
        <div className="card">
          <h2 className="display">Before you lock</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Locking freezes the terms — they can&apos;t change after anyone has accepted. Everyone must accept and set up their payout first.
          </p>
          <p style={{ fontSize: 14 }}>{allAccepted ? '✓ Everyone accepted' : '○ Waiting on acceptances'}</p>
          <p style={{ fontSize: 14, marginTop: 4 }}>{allOnboarded ? "✓ Everyone's payout is set" : '○ Waiting on payout setup'}</p>
          <button className="btn block" style={{ marginTop: 12 }} onClick={lock} disabled={busy || !allAccepted || !allOnboarded}>
            {busy ? 'Locking…' : 'Lock deal & create payment link'}
          </button>
        </div>
      )}

      {(payUrl || deal.status === 'locked' || deal.status === 'paid') && deal.status !== 'distributed' && (
        <div className="card">
          <h2 className="display">Send this to the brand</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>When they pay, each share settles automatically. Already paid? Check the status below.</p>
          {payUrl
            ? <a className="btn gold block" href={payUrl} target="_blank" rel="noreferrer">Open payment link</a>
            : <p className="muted" style={{ fontSize: 13 }}>Reload to fetch the link, or re-lock if it didn&apos;t generate.</p>}
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => verifyPayment(false)} disabled={checking}>
            {checking ? 'Checking…' : 'Check payment status'}
          </button>
        </div>
      )}

      {deal.status === 'distributed' && (
        <div className="card">
          <p className="ok" style={{ marginTop: 0 }}>✓ Paid and distributed. Each share has been routed to its account.</p>
        </div>
      )}

      {/* Dev helper: share these accept links manually if email isn't set up yet. */}
      {isDraft && (
        <div className="card">
          <h2 className="display" style={{ fontSize: 16 }}>Invite links</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Share each person&apos;s link so they can accept and set up payout.</p>
          {splits.map((s) => (
            <p key={s.id} style={{ fontSize: 13, wordBreak: 'break-all', margin: '8px 0' }}>
              <strong>{s.creator_email}:</strong><br /><a href={s.accept_link}>{s.accept_link}</a>
            </p>
          ))}
        </div>
      )}

      {err && <p className="err">{err}</p>}
    </div>
  );
}
