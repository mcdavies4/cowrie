import Link from 'next/link';

export default function Home() {
  const demo = [
    { who: 'You', pct: 50, color: 'var(--jade)' },
    { who: 'Ada', pct: 30, color: 'var(--gold)' },
    { who: 'Tomi', pct: 20, color: 'var(--cream)' },
  ];

  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /><b>Cowrie</b></div>

      <p className="eyebrow">Revenue splits for collaborators</p>
      <h1 className="hero display">Split deals, not friendships.</h1>
      <p className="hero-sub">
        Agree the split up front. When the brand pays, everyone&apos;s share lands in their own account
        automatically — your collaborator in Lagos gets paid in naira, straight to their own account, no international wire.
        No one has to trust the other to do the right thing.
      </p>

      <div className="card">
        <div className="sharebar" aria-hidden>
          {demo.map((d) => (<span key={d.who} style={{ width: `${d.pct}%`, background: d.color }} />))}
        </div>
        <div className="legend">
          {demo.map((d) => (
            <div className="item" key={d.who}>
              <span className="swatch" style={{ background: d.color }} />
              <span className="who">{d.who}</span>
              <span className="amt muted">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="row">
        <Link className="btn block" href="/deals/new">Create a deal</Link>
        <Link className="btn ghost block" href="/deals">My deals</Link>
      </div>

      <hr />
      <p className="eyebrow">Why it&apos;s safe</p>
      <div className="card">
        <p style={{ marginTop: 0 }}><strong>Nobody can cheat the split.</strong> Once a deal is locked, the percentages are frozen — they can&apos;t be changed after anyone has accepted.</p>
        <p><strong>Cowrie never holds your money.</strong> The payment goes straight to each person&apos;s account through regulated providers (Stripe and Flutterwave). We route it; we don&apos;t sit on it.</p>
        <p style={{ marginBottom: 0 }}><strong>Everyone gets paid at once.</strong> One payment in, every share out — automatically, in each person&apos;s own currency. No chasing, no "I&apos;ll send it next week."</p>
      </div>

      <p className="eyebrow">How it works</p>
      <ol className="steps">
        <li>You set the deal and each person&apos;s percentage.</li>
        <li>Each collaborator gets a link, sees the terms, and accepts their share.</li>
        <li>Everyone sets up where their money lands — a bank account or Stripe.</li>
        <li>You lock the deal. Terms can&apos;t change after anyone has accepted.</li>
        <li>The brand pays once. Each share settles to each person automatically.</li>
      </ol>

      <hr />
      <p className="muted" style={{ fontSize: 13 }}>
        Pounds, dollars and euros run on Stripe. Naira, cedis and other African currencies run on Flutterwave.
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · A product of The 36th Solutions Ltd
      </p>
    </div>
  );
}
