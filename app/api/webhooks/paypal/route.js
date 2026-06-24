import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { claimEvent, releaseEvent } from '../../../../lib/webhooks';
import { getProvider } from '../../../../lib/providers';
import { sendSettlementEmail, sendCollaboratorPaidEmail } from '../../../../lib/email';

export const runtime = 'nodejs';

export async function POST(req) {
  const raw = await req.text();
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }); }

  // Verify the signature with PayPal.
  const headers = {};
  for (const [k, v] of req.headers) headers[k.toLowerCase()] = v;
  const paypal = getProvider('paypal');
  let ok = false;
  try { ok = await paypal.verifyWebhook(headers, event); } catch { ok = false; }
  if (!ok) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });

  const db = serverClient();
  const eventKey = `pp_${event.id || Date.now()}`;
  if (!(await claimEvent(db, eventKey))) return NextResponse.json({ received: true, duplicate: true });

  try {
    const type = event.event_type;

    // Collection captured -> mark the deal collected (backup for the return-capture route).
    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      const dealId = event.resource?.custom_id || event.resource?.purchase_units?.[0]?.custom_id;
      if (dealId) {
        const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
        if (deal && deal.status !== 'distributed' && deal.status !== 'cancelled' && deal.status !== 'paid') {
          await db.from('transactions').insert({ deal_id: deal.id, kind: 'payment_received', amount_minor: deal.total_amount_minor, provider_ref: event.resource?.id });
          await db.from('deals').update({ status: 'paid' }).eq('id', deal.id);
        }
      }
    }

    // Payout item result -> confirm or fail the matching split (sender_item_id = split id).
    if (type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' || type === 'PAYMENT.PAYOUTS-ITEM.FAILED' ||
        type === 'PAYMENT.PAYOUTS-ITEM.BLOCKED' || type === 'PAYMENT.PAYOUTS-ITEM.RETURNED') {
      const splitId = event.resource?.payout_item?.sender_item_id;
      if (splitId) {
        const { data: split } = await db.from('deal_splits').select('*').eq('id', splitId).single();
        if (split) {
          const { data: deal } = await db.from('deals').select('*').eq('id', split.deal_id).single();
          if (type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' && split.transfer_status !== 'paid') {
            await db.from('deal_splits').update({ transfer_status: 'paid' }).eq('id', split.id);
            await db.from('transactions').insert({ deal_id: split.deal_id, kind: 'transfer_sent', amount_minor: split.amount_minor, provider_ref: event.resource?.payout_item_id });
            if (deal) await sendCollaboratorPaidEmail(deal, { email: split.creator_email, amount_minor: split.amount_minor });

            const { data: all } = await db.from('deal_splits').select('transfer_status,creator_email,amount_minor').eq('deal_id', split.deal_id);
            if (deal && all && all.every((x) => x.transfer_status === 'paid') && deal.status !== 'distributed') {
              await db.from('deals').update({ status: 'distributed' }).eq('id', deal.id);
              await sendSettlementEmail(deal, all.map((x) => ({ email: x.creator_email, amount_minor: x.amount_minor })));
            }
          } else if (type !== 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
            await db.from('deal_splits').update({ transfer_status: 'failed' }).eq('id', split.id);
          }
        }
      }
    }
  } catch (e) {
    await releaseEvent(db, eventKey);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
