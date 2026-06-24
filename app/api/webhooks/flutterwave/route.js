import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { claimEvent, releaseEvent } from '../../../../lib/webhooks';
import { settleFlutterwaveDeal } from '../../../../lib/settle';
import { sendSettlementEmail, sendCollaboratorPaidEmail } from '../../../../lib/email';

export const runtime = 'nodejs';

export async function POST(req) {
  // Verify the request really came from Flutterwave.
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== process.env.FLW_SECRET_HASH) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const payload = await req.json();
  const db = serverClient();

  const eventKey = `flw_${payload.data?.id || payload.data?.tx_ref || Date.now()}`;
  if (!(await claimEvent(db, eventKey))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      // Find the deal id: prefer meta, fall back to parsing our tx_ref (cowrie_<dealId>_<ts>).
      let dealId = payload.data?.meta?.deal_id || payload.meta?.deal_id;
      const txRef = payload.data?.tx_ref;
      if (!dealId && typeof txRef === 'string' && txRef.startsWith('cowrie_')) {
        dealId = txRef.split('_')[1];
      }

      if (dealId) {
        const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
        if (deal) {
          if (deal.payout_kind === 'momo') {
            // Money landed in the platform balance. Mark collected; payouts are pushed
            // from the dashboard once the balance has settled (collect-then-payout).
            if (deal.status !== 'distributed' && deal.status !== 'cancelled') {
              await db.from('transactions').insert({
                deal_id: deal.id, kind: 'payment_received',
                amount_minor: deal.total_amount_minor, provider_ref: txRef || payload.data?.flw_ref,
              });
              await db.from('deals').update({ status: 'paid' }).eq('id', deal.id);
            }
          } else {
            await settleFlutterwaveDeal(db, deal, txRef || payload.data?.flw_ref);
          }
        }
      }
    }
    // Mobile money payout result: confirm (or fail) the matching split.
    if (payload.event === 'transfer.completed') {
      const ref = payload.data?.reference;
      const status = String(payload.data?.status || '').toUpperCase();
      const transferId = payload.data?.id;
      if (typeof ref === 'string' && ref.startsWith('cowrie_')) {
        const parts = ref.split('_'); // cowrie_<dealId>_<splitId> (UUIDs use hyphens, not underscores)
        const dealId = parts[1];
        const splitId = parts[2];
        const { data: split } = await db.from('deal_splits').select('*').eq('id', splitId).single();
        const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
        if (split && deal) {
          if (status === 'SUCCESSFUL' && split.transfer_status !== 'paid') {
            await db.from('deal_splits').update({ transfer_status: 'paid', transfer_id: String(transferId) }).eq('id', split.id);
            await db.from('transactions').insert({ deal_id: deal.id, kind: 'transfer_sent', amount_minor: split.amount_minor, provider_ref: String(transferId) });
            await sendCollaboratorPaidEmail(deal, { email: split.creator_email, amount_minor: split.amount_minor });

            // If every split has now landed, the deal is fully distributed.
            const { data: all } = await db.from('deal_splits').select('transfer_status,creator_email,amount_minor').eq('deal_id', deal.id);
            if (all && all.every((x) => x.transfer_status === 'paid') && deal.status !== 'distributed') {
              await db.from('deals').update({ status: 'distributed' }).eq('id', deal.id);
              await sendSettlementEmail(deal, all.map((x) => ({ email: x.creator_email, amount_minor: x.amount_minor })));
            }
          } else if (status === 'FAILED') {
            // Free it up so the owner can retry the payout.
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
