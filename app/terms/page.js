import Link from 'next/link';

export const metadata = { title: 'Terms of Service — Cowrie' };

export default function Terms() {
  return (
    <div className="wrap">
      <div className="brand"><Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link></div>
      <h1 className="hero display" style={{ fontSize: 30 }}>Terms of Service</h1>
      <p className="muted" style={{ fontSize: 13 }}>Last updated: 23 June 2026. This is a starting template — have it reviewed by a solicitor before relying on it.</p>

      <div className="card">
        <p><strong>1. Who we are.</strong> Cowrie is operated by The 36th Solutions Ltd ("Cowrie", "we", "us"), a company registered in Nigeria. By using Cowrie you agree to these terms.</p>

        <p><strong>2. What Cowrie does.</strong> Cowrie helps collaborators agree how to split the revenue from a piece of work, and routes a payment from a paying party to each collaborator according to that agreement. Cowrie is a technology platform, not a bank, and is not a party to the underlying agreement between collaborators or with the paying party.</p>

        <p><strong>3. Payments.</strong> Payments are processed by third-party providers (currently Stripe and Flutterwave). By setting up a payout, you agree to the relevant provider&apos;s terms. Funds are handled by these providers; Cowrie does not hold client money. Each provider runs its own identity and bank verification.</p>

        <p><strong>4. Splits are your responsibility.</strong> The percentages in a deal are set and accepted by the participants. Once a deal is locked, terms are frozen. Cowrie executes the agreed split but is not responsible for the fairness of, or any dispute about, the agreement itself.</p>

        <p><strong>5. Fees.</strong> Cowrie may charge a platform fee, shown before a deal is locked. Payment providers charge their own processing fees. You are responsible for any taxes on amounts you receive.</p>

        <p><strong>6. Refunds and chargebacks.</strong> If a paying party reverses a payment (for example a card chargeback), the disputed amount may be reclaimed by the payment provider. You agree to cooperate in resolving disputes and that amounts already paid to you may be subject to recovery.</p>

        <p><strong>7. Acceptable use.</strong> You must not use Cowrie for unlawful purposes, fraud, money laundering, or to move funds for anyone other than genuine collaborators on real work. We may suspend or close accounts we reasonably believe are misusing the service.</p>

        <p><strong>8. Liability.</strong> Cowrie is provided "as is". To the extent permitted by law, we are not liable for indirect or consequential losses, or for the acts of payment providers or other users. Nothing limits liability that cannot be limited by law.</p>

        <p><strong>9. Changes.</strong> We may update these terms; material changes will be notified in the app or by email.</p>

        <p><strong>10. Contact.</strong> support@odogwu.online</p>
      </div>

      <p className="muted" style={{ fontSize: 13 }}><Link href="/privacy">Privacy Policy</Link> · <Link href="/">Home</Link></p>
    </div>
  );
}
