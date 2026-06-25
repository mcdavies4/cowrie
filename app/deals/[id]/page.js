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
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [releasing, setReleasing] = useState(false);

  async function releaseMomo() {
    setReleasing(true); setErr('');
    try {
      const res = await fetch(`/api/deals/${id}/release-momo`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.ok) { await load(); }
      else { setErr(json.error || 'Could not release payouts yet. If the brand just paid, the balance may still be settling — try again shortly.'); }
    } catch { setErr('Network error releasing payouts.'); }
    finally { setReleasing(false); }
  }

  async function releasePaypal() {
    setReleasing(true); setErr('');
    try {
      const res = await fetch(`/api/deals/${id}/release-paypal`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.ok) { await load(); }
      else { setErr(json.error || 'Could not release payouts yet. Try again shortly.'); }
    } catch { setErr('Network error releasing payouts.'); }
    finally { setReleasing(false); }
  }
  const [cancelling, setCancelling] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [copied, setCopied] = useState(false);

  async function copyPayLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Could not copy — long-press the link to copy it manually.');
    }
  }

  async function retryDistribution() {
    setRetrying(true); setErr('');
    try {
      const res = await fetch(`/api/deals/${id}/retry-distribution`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.ok) { await load(); }
      else { setErr(json.error || 'Funds may not have settled yet. In test mode, top up your Stripe available balance, then retry.'); }
    } catch { setErr('Network error retrying distribution.'); }
    finally { setRetrying(false); }
  }

  async function cancelDeal() {
    if (typeof window !== 'undefined' && !window.confirm('Cancel this deal? Collaborators will no longer be paid through it.')) return;
    setCancelling(true); setErr('');
    try {
      const res = await fetch(`/api/deals/${id}/cancel`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || 'Could not cancel.'); return; }
      await load();
    } catch { setErr('Network error cancelling the deal.'); }
    finally { setCancelling(false); }
  }

  async function syncPayouts() {
    setSyncing(true); setErr('');
    try {
      const res = await fetch(`/api/deals/${id}/sync-payouts`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || 'Could not refresh payout status.'); return; }
      await load();
    } catch { setErr('Network error refreshing payout status.'); }
    finally { setSyncing(false); }
  }

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
    cancelled: <span className="pill">Cancelled</span>,
  }[deal.status];

  return (
    <div className="wrap">
      <div className="brand" style={{ justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link>
        <Link href="/deals" className="muted" style={{ fontSize: 14 }}>← All deals</Link>
      </div>

      <p className="eyebrow">{deal.rail === 'stripe' ? 'Stripe rail' : deal.rail === 'paypal' ? 'PayPal rail' : 'Flutterwave rail'} · {deal.currency.toUpperCase()}</p>
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
            Cowrie fee: {deal.platform_fee_percent}%{deal.platform_fee_cap_minor ? ` capped at ${money(deal.platform_fee_cap_minor, deal.currency)}` : ''}{deal.fee_minor ? ` · ${money(deal.fee_minor, deal.currency)}` : ''} — taken off the top before the split.
          </p>
        )}
      </div>

      {data.breakdown && (
        <div className="card">
          <h2 className="display" style={{ fontSize: 18 }}>Money breakdown</h2>
          <div className="legend" style={{ marginTop: 12 }}>
            <div className="item"><span className="who">Brand pays (gross)</span><span className="amt mono">{money(data.breakdown.gross, deal.currency)}</span></div>
            <div className="item"><span className="who muted">Est. {deal.rail === 'stripe' ? 'Stripe' : deal.rail === 'paypal' ? 'PayPal' : 'Flutterwave'} fee</span><span className="amt mono muted">−{money(data.breakdown.processor_minor, deal.currency)}</span></div>
            <div className="item"><span className="who">Cowrie fee</span><span className="amt mono">{money(data.breakdown.platform_fee_minor, deal.currency)}</span></div>
            <div className="item" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <span className="who" style={{ color: data.breakdown.you_keep_minor >= 0 ? 'var(--jade)' : 'var(--danger)' }}>
                Cowrie keeps (after processor)
              </span>
              <span className="amt mono" style={{ color: data.breakdown.you_keep_minor >= 0 ? 'var(--jade)' : 'var(--danger)' }}>
                {money(data.breakdown.you_keep_minor, deal.currency)}
              </span>
            </div>
            <div className="item"><span className="who">Collaborators split</span><span className="amt mono">{money(data.breakdown.net_to_collaborators, deal.currency)}</span></div>
          </div>
          {data.breakdown.you_keep_minor < 0 && (
            <p className="err" style={{ marginTop: 10 }}>
              On this deal Cowrie&apos;s fee is below the processor&apos;s cut — Cowrie would lose money here. The fee settings need adjusting.
            </p>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Processor fee is an estimate; actual varies by card and country.</p>
        </div>
      )}
      {isDraft && (
        <div className="card">
          <h2 className="display">Before you lock</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Locking freezes the terms — they can&apos;t change after anyone has accepted. Everyone must accept and set up their payout first.
          </p>
          <p style={{ fontSize: 14 }}>{allAccepted ? '✓ Everyone accepted' : '○ Waiting on acceptances'}</p>
          <p style={{ fontSize: 14, marginTop: 4 }}>{allOnboarded ? "✓ Everyone's payout is set" : '○ Waiting on payout setup'}</p>
          {!allOnboarded && deal.rail === 'stripe' && (
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={syncPayouts} disabled={syncing}>
              {syncing ? 'Checking Stripe…' : 'Refresh payout status'}
            </button>
          )}
          <button className="btn block" style={{ marginTop: 12 }} onClick={lock} disabled={busy || !allAccepted || !allOnboarded}>
            {busy ? 'Locking…' : 'Lock deal & create payment link'}
          </button>
        </div>
      )}

      {(payUrl || deal.status === 'locked' || deal.status === 'paid') && deal.status !== 'distributed' && (
        <div className="card">
          <h2 className="display">Send this to the brand</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            {deal.payout_kind === 'momo' || deal.rail === 'paypal'
              ? 'When they pay, the money is collected — then you release the payouts to everyone below.'
              : 'When they pay, each share settles to everyone automatically.'} Already paid? Check the status below.
          </p>
          {(() => {
            const link = payUrl || deal.collection_url;
            return link ? (
              <>
                <button className="btn gold block" onClick={() => copyPayLink(link)}>
                  {copied ? '✓ Copied — paste it to the brand' : 'Copy payment link'}
                </button>
                <a className="btn ghost block" style={{ marginTop: 8 }} href={link} target="_blank" rel="noreferrer">Open it myself</a>
                <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, wordBreak: 'break-all' }}>{link}</p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>Link not found — re-lock the deal to regenerate it.</p>
            );
          })()}
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => verifyPayment(false)} disabled={checking}>
            {checking ? 'Checking…' : 'Check payment status'}
          </button>
          {deal.status === 'paid' && deal.rail === 'stripe' && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={retryDistribution} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry distribution'}
            </button>
          )}
          {deal.status === 'paid' && deal.rail === 'paypal' && (() => {
            const needsRelease = splits.some((s) => s.transfer_status !== 'queued' && s.transfer_status !== 'paid');
            const anyQueued = splits.some((s) => s.transfer_status === 'queued');
            const anyFailed = splits.some((s) => s.transfer_status === 'failed');
            if (needsRelease) {
              return (
                <button className="btn block" style={{ marginTop: 10 }} onClick={releasePaypal} disabled={releasing}>
                  {releasing ? 'Sending payouts…' : anyFailed ? 'Retry failed payouts' : 'Release PayPal payouts'}
                </button>
              );
            }
            if (anyQueued) {
              return (
                <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                  Payouts sent to PayPal — confirming. Each share shows as paid once PayPal completes it.
                  <button className="btn ghost block" style={{ marginTop: 8 }} onClick={load}>Refresh status</button>
                </p>
              );
            }
            return null;
          })()}
          {deal.status === 'paid' && deal.payout_kind === 'momo' && (() => {
            const needsRelease = splits.some((s) => s.transfer_status !== 'queued' && s.transfer_status !== 'paid');
            const anyQueued = splits.some((s) => s.transfer_status === 'queued');
            const anyFailed = splits.some((s) => s.transfer_status === 'failed');
            if (needsRelease) {
              return (
                <button className="btn block" style={{ marginTop: 10 }} onClick={releaseMomo} disabled={releasing}>
                  {releasing ? 'Sending payouts…' : anyFailed ? 'Retry failed payouts' : 'Release mobile money payouts'}
                </button>
              );
            }
            if (anyQueued) {
              return (
                <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                  Payouts sent to Flutterwave — confirming. Each share shows as paid once the transfer completes.
                  <button className="btn ghost block" style={{ marginTop: 8 }} onClick={load}>Refresh status</button>
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      {(deal.status === 'draft' || deal.status === 'locked') && (
        <button className="btn ghost block" style={{ marginTop: 4, color: 'var(--danger)', borderColor: 'var(--line)' }} onClick={cancelDeal} disabled={cancelling}>
          {cancelling ? 'Cancelling…' : 'Cancel deal'}
        </button>
      )}

      {deal.status === 'cancelled' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>This deal was cancelled. No payments will be processed through it.</p>
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
