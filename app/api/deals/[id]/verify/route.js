import { NextResponse } from 'next/server';
import { serverClient } from '../../../../../lib/supabase';
import { settleFlutterwaveDeal } from '../../../../../lib/settle';
import { getProvider } from '../../../../../lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Confirms payment by asking Flutterwave directly, so status updates even if the
// webhook never arrives. Verifies by transaction_id (from the redirect) or, failing
// that, by the deal's stored tx_ref.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const transaction_id = body.transaction_id || null;

  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  if (deal.status === 'distributed') return NextResponse.json({ ok: true, status: 'distributed' });

  // PayPal: check the order; capture it if the brand approved but the redirect didn't land.
  if (deal.rail === 'paypal') {
    if (!deal.collection_ref) return NextResponse.json({ ok: false, status: deal.status, error: 'No order to check yet.' }, { status: 400 });
    try {
      const paypal = getProvider('paypal');
      const order = await paypal.getOrder(deal.collection_ref);
      let status = order?.status;
      if (status === 'APPROVED') {
        const cap = await paypal.captureOrder(deal.collection_ref);
        status = cap.status;
      }
      if (status === 'COMPLETED') {
        if (deal.status !== 'paid' && deal.status !== 'cancelled') {
          await db.from('transactions').insert({ deal_id: deal.id, kind: 'payment_received', amount_minor: deal.total_amount_minor, provider_ref: deal.collection_ref });
          await db.from('deals').update({ status: 'paid' }).eq('id', deal.id);
        }
        return NextResponse.json({ ok: true, status: 'paid' });
      }
      return NextResponse.json({ ok: false, status: deal.status, detail: status || 'not approved yet' });
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Could not check PayPal: ${e.message}` }, { status: 502 });
    }
  }

  if (deal.rail !== 'flutterwave') {
    return NextResponse.json({ ok: false, status: deal.status, note: 'Stripe deals confirm via their webhook.' });
  }

  // Pick how to verify: by Flutterwave transaction id, else by our tx_ref.
  let url;
  if (transaction_id) {
    url = `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`;
  } else if (deal.collection_ref) {
    url = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(deal.collection_ref)}`;
  } else {
    return NextResponse.json({ ok: false, status: deal.status, error: 'Nothing to verify yet.' }, { status: 400 });
  }

  let json;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }, cache: 'no-store' });
    json = await res.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Could not reach Flutterwave: ${e.message}` }, { status: 502 });
  }

  const d = json?.data;
  const paid =
    json?.status === 'success' &&
    d?.status === 'successful' &&
    Number(d?.amount) >= deal.total_amount_minor / 100 &&
    String(d?.currency || '').toLowerCase() === deal.currency;

  if (!paid) {
    return NextResponse.json({ ok: false, status: deal.status, detail: d?.status || json?.message || 'not confirmed' });
  }

  await settleFlutterwaveDeal(db, deal, d?.tx_ref || String(transaction_id));
  return NextResponse.json({ ok: true, status: 'distributed' });
}
