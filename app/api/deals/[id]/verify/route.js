import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { settleFlutterwaveDeal } from '../../../../../lib/settle';
import { toMajor } from '../../../../../lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Confirms payment by asking Flutterwave directly, so status updates even if the
// webhook never arrives. Verifies by transaction_id (from the redirect) or, failing
// that, by the deal's stored tx_ref.
export async function POST(req, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const transaction_id = body.transaction_id || null;

  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  if (deal.created_by_email !== user.email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (deal.status === 'distributed') return NextResponse.json({ ok: true, status: 'distributed' });

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
    Number(d?.amount) >= toMajor(deal.total_amount_minor, deal.currency) &&
    String(d?.currency || '').toLowerCase() === deal.currency;

  if (!paid) {
    return NextResponse.json({ ok: false, status: deal.status, detail: d?.status || json?.message || 'not confirmed' });
  }

  await settleFlutterwaveDeal(db, deal, d?.tx_ref || String(transaction_id));
  return NextResponse.json({ ok: true, status: 'distributed' });
}
