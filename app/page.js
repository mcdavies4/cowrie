import Link from 'next/link';

export default function Home() {
  // Static demo split for the hero visual.
  const demo = [
    { who: 'You', pct: 50, color: 'var(--jade)' },
    { who: 'Ada', pct: 30, color: 'var(--gold)' },
    { who: 'Tomi', pct: 20, color: 'var(--cream)' },
  ];

  return (
    <div className="wrap">
      <div className="brand">
        <span className="dot" />
        <b>Cowrie</b>
      </div>

      <p className="eyebrow">Revenue splits for collaborators</p>
      <h1 className="hero display">Split deals, not friendships.</h1>
      <p className="hero-sub">
        Agree the split up front. When the brand pays, everyone&apos;s share lands in their own account
        automatically. No one has to wait for someone else to do the right thing.
      </p>

      <div className="card">
        <div className="sharebar" aria-hidden>
          {demo.map((d) => (
            <span key={d.who} style={{ width: `${d.pct}%`, background: d.color }} />
          ))}
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
      <p className="eyebrow">How it works</p>
      <ol className="steps">
        <li>You set the deal and each person&apos;s percentage.</li>
        <li>Each collaborator gets a link, sees the terms, and accepts their share.</li>
        <li>Everyone sets up where their money lands — a bank account or Stripe.</li>
        <li>You lock the deal. Terms can&apos;t change after anyone has accepted.</li>
        <li>The brand pays once. Each share settles to each person automatically.</li>
      </ol>
      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        Pounds, dollars and euros run on Stripe. Naira, cedis and other African currencies run on Flutterwave.
        The deal&apos;s currency picks the rail.
      </p>
    </div>
  );
}
