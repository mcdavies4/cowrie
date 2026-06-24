'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { computePlatformFee } from '../../../lib/fees';
import { countryForCurrency, payoutKindForCurrency } from '../../../lib/currencies';
import { networksForCountry, DIAL_CODE } from '../../../lib/momo';

const COLORS = ['var(--jade)', 'var(--gold)', 'var(--cream)', '#8b7fd6', '#e8765b'];

function money(minor, ccy) {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (ccy || 'gbp').toUpperCase() }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)}`; }
}

export default function AcceptPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // FLW bank form state
  const [acctNo, setAcctNo] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankQuery, setBankQuery] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [momoPhone, setMomoPhone] = useState('');
  const [momoNetwork, setMomoNetwork] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
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

  // Load the bank list for bank-payout Flutterwave deals (not mobile money).
  useEffect(() => {
    if (data?.deal?.rail === 'flutterwave' && payoutKindForCurrency(data.deal.currency) !== 'momo' && banks.length === 0) {
      const country = countryForCurrency(data.deal.currency);
      fetch(`/api/banks?country=${country}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => { if (j.banks) setBanks(j.banks); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.deal?.rail]);

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
        action: 'resolve', creator_id: data.creator.id, account_number: acctNo, account_bank: bankCode,
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
        action: 'create', creator_id: data.creator.id, account_number: acctNo, account_bank: bankCode, business_name: resolvedName,
      });
      if (!ok) { setErr(json.error || 'Could not save that account. Please try again.'); return; }
      setDone(true); await load();
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function saveMomo() {
    setBusy(true); setErr('');
    try {
      const cc = countryForCurrency(deal.currency);
      const dial = DIAL_CODE[cc] || '';
      let phone = momoPhone.replace(/\s+/g, '');
      if (phone.startsWith('0')) phone = dial + phone.slice(1); // local 07.. -> 2547..
      const { ok, json } = await postJson('/api/onboard/flutterwave', {
        action: 'momo', creator_id: data.creator.id, momo_phone: phone, momo_network: momoNetwork,
      });
      if (!ok) { setErr(json.error || 'Could not save your mobile money details. Please try again.'); return; }
      setDone(true); await load();
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function savePaypal() {
    setBusy(true); setErr('');
    try {
      const { ok, json } = await postJson('/api/onboard/paypal', {
        creator_id: data.creator.id, paypal_email: paypalEmail.trim(),
      });
      if (!ok) { setErr(json.error || 'Could not save your PayPal email. Please try again.'); return; }
      setDone(true); await load();
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  async function startStripe() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/onboard/stripe?creator=${data.creator.id}`, { cache: 'no-store' });
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
  const myShareMinor = Math.round(distributable * (split.percent / 100));
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
          {deal.rail === 'paypal' ? (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Enter the PayPal email where your share should land. If you don&apos;t have PayPal yet, you can claim the money once it arrives.</p>
              <label className="label">PayPal email</label>
              <input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="off" />
              <button className="btn block" style={{ marginTop: 14 }} onClick={savePaypal} disabled={busy || !paypalEmail.includes('@')}>
                {busy ? 'Saving…' : 'Save PayPal email'}
              </button>
            </>
          ) : deal.rail === 'stripe' ? (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>You&apos;ll verify your identity and add a bank account with Stripe. Takes a couple of minutes.</p>
              <button className="btn block" onClick={startStripe} disabled={busy}>{busy ? 'Starting…' : 'Set up payout with Stripe'}</button>
            </>
          ) : payoutKindForCurrency(deal.currency) === 'momo' ? (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Enter the mobile money wallet where your share should land.</p>
              <label className="label">Network</label>
              <select value={momoNetwork} onChange={(e) => setMomoNetwork(e.target.value)}>
                <option value="">Select your network…</option>
                {networksForCountry(countryForCurrency(deal.currency)).map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
              <label className="label">Mobile money number</label>
              <input className="mono" value={momoPhone} onChange={(e) => setMomoPhone(e.target.value)} placeholder="0700000000" inputMode="tel" />
              <button className="btn block" style={{ marginTop: 14 }} onClick={saveMomo} disabled={busy || !momoPhone || !momoNetwork}>
                {busy ? 'Saving…' : 'Save mobile money'}
              </button>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Double-check the number — payouts go to exactly what you enter.</p>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Enter your bank account. We&apos;ll check the name before saving.</p>
              <label className="label">Account number</label>
              <input className="mono" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} placeholder="0690000037" inputMode="numeric" />
              <label className="label">Bank</label>
              <div className="combo">
                <input
                  value={bankQuery}
                  onChange={(e) => { setBankQuery(e.target.value); setBankOpen(true); setBankCode(''); }}
                  onFocus={() => setBankOpen(true)}
                  placeholder={banks.length ? 'Type your bank name…' : 'Loading banks…'}
                  autoComplete="off"
                />
                {bankOpen && banks.length > 0 && (
                  <div className="combo-list">
                    {banks
                      .filter((b) => b.name.toLowerCase().includes(bankQuery.trim().toLowerCase()))
                      .slice(0, 40)
                      .map((b) => (
                        <button
                          type="button"
                          key={`${b.code}-${b.name}`}
                          className="combo-item"
                          onClick={() => { setBankCode(b.code); setBankQuery(b.name); setBankOpen(false); }}
                        >
                          {b.name}
                        </button>
                      ))}
                    {banks.filter((b) => b.name.toLowerCase().includes(bankQuery.trim().toLowerCase())).length === 0 && (
                      <div className="combo-empty">No bank matches “{bankQuery}”.</div>
                    )}
                  </div>
                )}
              </div>
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
