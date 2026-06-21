import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';
import { claimEvent, releaseEvent } from '../../../../lib/webhooks';
import { sendSettlementEmail } from '../../../../lib/email';

export const runtime = 'nodejs';

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text(); // raw body required for signature check

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: `Signature check failed: ${e.message}` }, { status: 400 });
  }

  const db = serverClient();
  const eventKey = `stripe_${event.id}`;
  if (!(await claimEvent(db, eventKey))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // Connected account finished KYC -> mark creator onboarded.
    if (event.type === 'account.updated') {
      const acct = event.data.object;
      if (acct.payouts_enabled && acct.charges_enabled) {
        await db
          .from('creators')
          .update({ onboarding_complete: true, payout_label: 'Stripe payout account' })
          .eq('provider_account_id', acct.id);
      }
    }

    // Brand paid -> push transfers to each collaborator.
    if (event.type === 'checkout.session.completed') {
      const dealId = event.data.object.metadata?.deal_id;
      if (dealId) {
        const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
        if (deal && deal.status !== 'distributed') {
          await db.from('transactions').insert({
            deal_id: dealId,
            kind: 'payment_received',
            amount_minor: deal.total_amount_minor,
            provider_ref: event.data.object.id,
          });
          await db.from('deals').update({ status: 'paid' }).eq('id', dealId);

          const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', dealId);
          const enriched = [];
          for (const s of splits) {
            const { data: creator } = await db.from('creators').select('provider_account_id').eq('email', s.creator_email).single();
            enriched.push({ ...s, provider_account_id: creator?.provider_account_id });
          }

          const provider = getProvider('stripe');
          const results = await provider.distribute(deal, enriched);
          for (const r of results) {
            await db.from('deal_splits').update({ transfer_id: r.transfer_id, transfer_status: 'paid' }).eq('id', r.split_id);
            const amt = enriched.find((s) => s.id === r.split_id)?.amount_minor;
            await db.from('transactions').insert({ deal_id: dealId, kind: 'transfer_sent', amount_minor: amt, provider_ref: r.transfer_id });
          }
          await db.from('deals').update({ status: 'distributed' }).eq('id', dealId);
          await sendSettlementEmail(deal, enriched.map((s) => ({ email: s.creator_email, amount_minor: s.amount_minor })));
        }
      }
    }
  } catch (e) {
    // Let the claim go so Stripe's retry can re-attempt.
    await releaseEvent(db, eventKey);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
