'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { railForCurrency } from '../../../lib/money';
import { computePlatformFee } from '../../../lib/fees';
import { platformFee } from '../../../lib/platform-fee';
import { CURRENCIES } from '../../../lib/currencies';

const COLORS = ['var(--jade)', 'var(--gold)', 'var(--cream)', '#8b7fd6', '#e8765b'];
export default function NewDeal() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [currency, setCurrency] = useState('gbp');
  const [total, setTotal] = useState('');
  const [splits, setSplits] = useState([{ email: '', percent: '' }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const sum = useMemo(() => splits.reduce((s, x) => s + Number(x.percent || 0), 0), [splits]);

  function update(i, field, val) {
    setSplits((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  }
  function addRow() { setSplits((p) => [...p, { email: '', percent: '' }]); }
  function removeRow(i) { setSplits((p) => p.filter((_, idx) => idx !== i)); }

  async function submit() {
    setErr('');
    if (Math.round(sum * 100) !== 10000) { setErr(`Splits must total 100%. They total ${sum}%.`); return; }
    setBusy(true);
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, brand_name: brand, currency, total, splits }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error || 'Something went wrong.'); return; }
    router.push(`/deals/${data.deal_id}`);
  }

  return (
    <div className="wrap">
      <div className="brand" style={{ justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link>
        <Link href="/deals" className="muted" style={{ fontSize: 14 }}>← All deals</Link>
      </div>
      <p className="eyebrow">New deal</p>
      <h1 className="hero display" style={{ fontSize: 32 }}>Set the terms</h1>

      <div className="card">
        <label className="label">Deal title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sponsored reel — summer campaign" />

        <div className="row" style={{ marginTop: 4 }}>
          <div>
            <label className="label">Brand (optional)</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" />
          </div>
        </div>

        <div className="row">
          <div>
            <label className="label">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Total amount</label>
            <input className="mono" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="1000.00" inputMode="decimal" />
          </div>
        </div>

        <label className="label">Cowrie fee (set by Cowrie)</label>
        {(() => {
          const { percent, capMinor } = platformFee(currency);
          const totalMinor = Math.round((parseFloat(total) || 0) * 100);
          const feeMinor = computePlatformFee(totalMinor, percent, capMinor);
          const fmt = (m) => `${currency.toUpperCase()} ${(m / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          return (
            <div className="card" style={{ margin: '6px 0 0', padding: 14 }}>
              <p className="mono" style={{ margin: 0, fontSize: 15 }}>
                {percent}%{capMinor ? ` · max ${fmt(capMinor)}` : ''}
              </p>
              {totalMinor > 0 && (
                <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  Fee on this deal: <span className="mono" style={{ color: 'var(--gold)' }}>{fmt(feeMinor)}</span>
                  {capMinor && feeMinor === capMinor ? ' (capped)' : ''} · collaborators split <span className="mono">{fmt(totalMinor - feeMinor)}</span>
                </p>
              )}
            </div>
          );
        })()}
      </div>

      <div className="card">
        <h2 className="display">Who gets what</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Add everyone — including yourself if you take a share.</p>

        {splits.map((s, i) => (
          <div className="split-row" key={i}>
            <input className="email" placeholder="collaborator@email.com" value={s.email} onChange={(e) => update(i, 'email', e.target.value)} type="email" />
            <input className="pct mono" placeholder="%" value={s.percent} onChange={(e) => update(i, 'percent', e.target.value)} inputMode="decimal" />
            {splits.length > 1 && <button className="btn ghost" onClick={() => removeRow(i)} style={{ flex: '0 0 auto', padding: '11px 14px' }}>×</button>}
          </div>
        ))}
        <button className="btn ghost" onClick={addRow} style={{ marginTop: 4 }}>+ Add collaborator</button>

        <div className="sharebar" style={{ marginTop: 18 }} aria-hidden>
          {splits.map((s, i) => <span key={i} style={{ width: `${Math.min(Number(s.percent || 0), 100)}%`, background: COLORS[i % COLORS.length] }} />)}
        </div>
        <p className="mono" style={{ fontSize: 13, color: Math.round(sum * 100) === 10000 ? 'var(--jade)' : 'var(--muted)' }}>
          {sum}% allocated {Math.round(sum * 100) === 10000 ? '✓' : `(need ${100 - sum}% more)`}
        </p>
      </div>

      {err && <p className="err">{err}</p>}
      <button className="btn block" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create deal & send invites'}</button>
    </div>
  );
}
