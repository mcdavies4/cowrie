import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { allocate } from '../../../../../lib/money';
import { computePlatformFee } from '../../../../../lib/fees';
import { getProvider } from '../../../../../lib/providers';
import { payoutFor } from '../../../../../lib/payouts';

export const runtime = 'nodejs';

export async function POST(req, { params }) {
  const dealId = params.id;
  const db = serverClient();

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
  if (deal.created_by_email !== user.email) {
    return NextResponse.json({ error: 'Only the deal owner can lock this.' }, { status: 403 });
  }
  if (deal.status !== 'draft') {
    return NextResponse.json({ error: 'Deal is already locked.' }, { status: 409 });
  }

  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', dealId);

  // 1) Everyone must have accepted.
  const notAccepted = splits.filter((s) => !s.agreed_at);
  if (notAccepted.length) {
    return NextResponse.json(
      { error: `Waiting on acceptance from: ${notAccepted.map((s) => s.creator_email).join(', ')}` },
      { status: 409 }
    );
  }

  // 2) Pull each collaborator's payout destination for THIS deal's rail.
  const enriched = [];
  for (const s of splits) {
    const { data: creator } = await db.from('creators').select('*').eq('email', s.creator_email).single();
    const p = payoutFor(creator, deal.rail);
    if (!p.onboarded || !p.accountId) {
      return NextResponse.json(
        { error: `${s.creator_email} hasn't set up a ${deal.rail === 'stripe' ? 'Stripe' : 'bank'} payout for this currency yet.` },
        { status: 409 }
      );
    }
    enriched.push({ ...s, provider_account_id: p.accountId });
  }

  // 3) Freeze exact amounts. The platform fee comes off the top; collaborators split
  //    the remainder by their percentages (so a 40% share is 40% of the net).
  //    Largest-remainder ensures the parts sum exactly to the distributable amount.
  const fee_minor = computePlatformFee(deal.total_amount_minor, deal.platform_fee_percent, deal.platform_fee_cap_minor);
  const distributable = deal.total_amount_minor - fee_minor;

  const amounts = allocate(distributable, enriched.map((s) => ({ id: s.id, percent: s.percent })));
  for (const s of enriched) {
    s.amount_minor = amounts[s.id];
    await db.from('deal_splits').update({ amount_minor: s.amount_minor }).eq('id', s.id);
  }

  // 4) Create the brand-facing collection link on the right rail.
  const provider = getProvider(deal.rail);
  let collection;
  try {
    collection = await provider.createCollection(deal, enriched);
  } catch (e) {
    return NextResponse.json({ error: `Could not create payment link: ${e.message}` }, { status: 502 });
  }

  await db.from('deals').update({ status: 'locked', locked_at: new Date().toISOString(), collection_ref: collection.ref, fee_minor }).eq('id', dealId);

  return NextResponse.json({ ok: true, pay_url: collection.url });
}
