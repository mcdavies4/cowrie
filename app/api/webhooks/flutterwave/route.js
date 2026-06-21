import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { claimEvent, releaseEvent } from '../../../../lib/webhooks';
import { sendSettlementEmail } from '../../../../lib/email';

export const runtime = 'nodejs';

export async function POST(req) {
  // Verify the request really came from Flutterwave.
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== process.env.FLW_SECRET_HASH) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const payload = await req.json();
  const db = serverClient();

  const eventKey = `flw_${payload.data?.id || payload.data?.tx_ref || payload['event.type'] || Date.now()}`;
  if (!(await claimEvent(db, eventKey))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // Successful charge -> the split already happened at settlement; record + mark distributed.
    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      const dealId = payload.data?.meta?.deal_id || payload.meta?.deal_id;
      if (dealId) {
        const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
        if (deal && deal.status !== 'distributed') {
          await db.from('transactions').insert({
            deal_id: dealId,
            kind: 'payment_received',
            amount_minor: deal.total_amount_minor,
            provider_ref: payload.data?.tx_ref || payload.data?.flw_ref,
          });

          const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', dealId);
          for (const s of splits) {
            await db.from('deal_splits').update({ transfer_status: 'paid' }).eq('id', s.id);
            await db.from('transactions').insert({ deal_id: dealId, kind: 'split_settled', amount_minor: s.amount_minor, provider_ref: payload.data?.tx_ref });
          }
          await db.from('deals').update({ status: 'distributed' }).eq('id', dealId);
          await sendSettlementEmail(deal, splits.map((s) => ({ email: s.creator_email, amount_minor: s.amount_minor })));
        }
      }
    }
  } catch (e) {
    await releaseEvent(db, eventKey);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
