import Link from 'next/link';

export default function OnboardDone() {
  return (
    <div className="wrap">
      <div className="brand"><span className="dot" /><b>Cowrie</b></div>
      <h1 className="hero display" style={{ fontSize: 28 }}>Payout setup received</h1>
      <p className="muted">
        Stripe is verifying your details. Once it confirms (usually within a minute), your status updates to ready
        and the deal owner can lock the deal. You can close this tab.
      </p>
      <Link className="btn" href="/">Done</Link>
    </div>
  );
}
