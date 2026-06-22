import Link from 'next/link';

export const metadata = { title: 'Privacy Policy — Cowrie' };

export default function Privacy() {
  return (
    <div className="wrap">
      <div className="brand"><Link href="/" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit' }}><span className="dot" /><b>Cowrie</b></Link></div>
      <h1 className="hero display" style={{ fontSize: 30 }}>Privacy Policy</h1>
      <p className="muted" style={{ fontSize: 13 }}>Last updated: 22 June 2026. This is a starting template — have it reviewed before relying on it. The 36th Company Ltd is the data controller.</p>

      <div className="card">
        <p><strong>What we collect.</strong> Account email addresses; deal details (titles, amounts, splits); collaborator email addresses and payout identifiers. Bank and identity details for payouts are collected and held by our payment providers (Stripe, Flutterwave), not by Cowrie.</p>

        <p><strong>Why we use it.</strong> To operate the service: create and manage deals, send invitations and notifications, route payments, and meet legal and anti-fraud obligations. Our lawful bases are performance of a contract and our legitimate interests in running and securing the service.</p>

        <p><strong>Who we share it with.</strong> Payment providers (Stripe, Flutterwave) to process payouts; infrastructure providers (e.g. hosting and database); email delivery providers. We do not sell your data or use it for advertising.</p>

        <p><strong>International transfers.</strong> Some providers process data outside the UK. Where they do, appropriate safeguards (such as standard contractual clauses) are relied upon.</p>

        <p><strong>How long we keep it.</strong> For as long as needed to provide the service and meet legal/accounting obligations, then we delete or anonymise it.</p>

        <p><strong>Your rights.</strong> Under UK GDPR you can request access to, correction of, or deletion of your personal data, and object to certain processing. Contact us to exercise these rights. You can also complain to the ICO (ico.org.uk).</p>

        <p><strong>Security.</strong> We use access controls and encryption in transit, and rely on our providers&apos; security for sensitive payment data. No system is perfectly secure.</p>

        <p><strong>Contact.</strong> support@cowrie.app.</p>
      </div>

      <p className="muted" style={{ fontSize: 13 }}><Link href="/terms">Terms of Service</Link> · <Link href="/">Home</Link></p>
    </div>
  );
}
