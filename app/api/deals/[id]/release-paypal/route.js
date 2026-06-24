import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { getProvider } from '../../../../../lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sends a PayPal batch payout for a collected PayPal deal (status 'paid'). Owner only.
// Splits move to 'queued'; the PAYMENT.PAYOUTS-ITEM webhook confirms each as 'paid'/'failed'.
export async function POST(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (deal.rail !== 'paypal') return NextResponse.json({ error: 'This deal does not use PayPal.' }, { status: 409 });
  if (deal.status !== 'paid') return NextResponse.json({ error: `Nothing to release — deal is "${deal.status}".` }, { status: 409 });

  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', deal.id);

  // Only pay splits not already sent/paid. Attach each collaborator's PayPal email.
  const toPay = [];
  for (const s of splits) {
    if (s.transfer_status === 'paid' || s.transfer_status === 'queued') continue;
    const { data: creator } = await db.from('creators').select('paypal_email').eq('email', s.creator_email).single();
    if (!creator?.paypal_email) continue;
    toPay.push({ ...s, paypal_email: creator.paypal_email });
  }
  if (!toPay.length) return NextResponse.json({ ok: true, initiated: 0, note: 'Nothing left to send.' });

  try {
    const paypal = getProvider('paypal');
    const { batchId } = await paypal.createPayout(deal, toPay);
    for (const s of toPay) {
      await db.from('deal_splits').update({ transfer_status: 'queued', transfer_id: batchId }).eq('id', s.id);
    }
    return NextResponse.json({ ok: true, initiated: toPay.length, note: 'Payouts sent to PayPal. They confirm as paid once each completes.' });
  } catch (e) {
    const msg = /insufficient|balance/i.test(e.message)
      ? 'Not enough PayPal balance yet. If the brand just paid, it may take a moment to clear — try again shortly.'
      : e.message;
    return NextResponse.json({ ok: false, error: msg });
  }
}
