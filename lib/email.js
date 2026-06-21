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

// Tell the deal owner the money has gone out, with the per-person breakdown.
export async function sendSettlementEmail(deal, rows) {
  function fmt(minor) {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (deal.currency || 'gbp').toUpperCase() }).format(minor / 100); }
    catch { return `${(minor / 100).toFixed(2)} ${(deal.currency || '').toUpperCase()}`; }
  }
  const lines = rows.map((r) => `  • ${r.email}: ${fmt(r.amount_minor)}`).join('\n');
  const feeLine = deal.fee_minor ? `\nPlatform fee kept: ${fmt(deal.fee_minor)}` : '';
  await sendEmail({
    to: deal.created_by_email,
    subject: `Settled: "${deal.title}" — everyone's been paid`,
    text: `"${deal.title}" has settled. ${fmt(deal.total_amount_minor)} came in and each share went out:\n\n${lines}${feeLine}\n\nNothing else to do — the money is on its way to each account.`,
  });
}
