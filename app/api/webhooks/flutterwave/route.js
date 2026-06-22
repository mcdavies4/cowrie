import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { claimEvent, releaseEvent } from '../../../../lib/webhooks';
import { settleFlutterwaveDeal } from '../../../../lib/settle';

export const runtime = 'nodejs';

export async function POST(req) {
  // Verify the request really came from Flutterwave.
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== process.env.FLW_SECRET_HASH) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const payload = await req.json();
  const db = serverClient();

  const rawKey = payload.data?.id || payload.data?.tx_ref;
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing event identifier.' }, { status: 400 });
  }
  const eventKey = `flw_${rawKey}`;
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
          await settleFlutterwaveDeal(db, deal, txRef || payload.data?.flw_ref);
        }
      }
    }
  } catch (e) {
    await releaseEvent(db, eventKey);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
