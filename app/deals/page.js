'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

function money(minor, ccy) {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (ccy || 'gbp').toUpperCase() }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)} ${(ccy || '').toUpperCase()}`; }
}

const STATUS = {
  draft: { label: 'Draft', cls: 'pill' },
  locked: { label: 'Awaiting payment', cls: 'pill gold' },
  paid: { label: 'Settling', cls: 'pill go' },
  distributed: { label: 'Distributed', cls: 'pill go' },
};

export default function MyDeals() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/deals', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json();
      if (r.ok) setData(j); else setErr(j.error);
    });
  }, []);

  async function signOut() {
    await browserClient().auth.signOut();
    window.location.href = '/';
  }

  return (
    <div className="wrap">
      <div className="brand" style={{ justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link>
        <button className="btn ghost" style={{ padding: '8px 14px', fontSize: 13 }} onClick={signOut}>Sign out</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h1 className="hero display" style={{ fontSize: 30, margin: 0 }}>Your deals</h1>
        <Link className="btn" href="/deals/new" style={{ padding: '10px 16px' }}>New deal</Link>
      </div>
      {data?.email && <p className="muted" style={{ marginTop: 0 }}>{data.email}</p>}

      {err && <p className="err">{err}</p>}
      {!data && !err && <p className="muted">Loading…</p>}

      {data?.deals?.length === 0 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>No deals yet.</p>
          <p className="muted" style={{ fontSize: 14 }}>Create one, add each collaborator&apos;s share, and send the invites.</p>
          <Link className="btn" href="/deals/new">Create your first deal</Link>
        </div>
      )}

      {data?.deals?.map((d) => {
        const st = STATUS[d.status] || STATUS.draft;
        return (
          <Link key={d.id} href={`/deals/${d.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 className="display" style={{ margin: 0 }}>{d.title}</h2>
                <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
                  {d.brand_name ? `${d.brand_name} · ` : ''}{d.collaborator_count} {d.collaborator_count === 1 ? 'collaborator' : 'collaborators'} · {d.rail}
                </p>
              </div>
              <span className={st.cls}>{st.label}</span>
            </div>
            <p className="mono" style={{ fontSize: 20, margin: '12px 0 0' }}>{money(d.total_amount_minor, d.currency)}</p>
          </Link>
        );
      })}
    </div>
  );
}
