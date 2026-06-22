import { toMajor } from './money';

// Sends via Resend if RESEND_API_KEY is set; otherwise logs to the server console
// and returns the link so you can test the full flow with no email provider configured.
export async function sendEmail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email:dev] to=${to}\n  subject: ${subject}\n  ${text}\n`);
    return { delivered: false, devLogged: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Cowrie <noreply@cowrie.app>', to, subject, text }),
  });
  return { delivered: res.ok };
}

// Format minor units as the deal's currency.
function fmtMoney(minor, currency) {
  const major = toMajor(minor, currency);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (currency || 'gbp').toUpperCase() }).format(major); }
  catch { return `${major.toFixed(2)} ${(currency || '').toUpperCase()}`; }
}

// Tell the deal owner the money has gone out, with the per-person breakdown.
export async function sendSettlementEmail(deal, rows) {
  const lines = rows.map((r) => `  • ${r.email}: ${fmtMoney(r.amount_minor, deal.currency)}`).join('\n');
  const feeLine = deal.fee_minor ? `\nPlatform fee kept: ${fmtMoney(deal.fee_minor, deal.currency)}` : '';
  await sendEmail({
    to: deal.created_by_email,
    subject: `Settled: "${deal.title}" — everyone's been paid`,
    text: `"${deal.title}" has settled. ${fmtMoney(deal.total_amount_minor, deal.currency)} came in and each share went out:\n\n${lines}${feeLine}\n\nNothing else to do — the money is on its way to each account.`,
  });
}

// Tell a single collaborator their own share has been paid.
export async function sendCollaboratorPaidEmail(deal, row) {
  await sendEmail({
    to: row.email,
    subject: `You've been paid — your share of "${deal.title}"`,
    text: `Good news: "${deal.title}"${deal.brand_name ? ` (from ${deal.brand_name})` : ''} has been paid.\n\nYour share of ${fmtMoney(row.amount_minor, deal.currency)} is on its way to your account — nothing for you to do.`,
  });
}
