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

  const isMomo = deal.payout_kind === 'momo';

  // 2) Pull each collaborator's payout destination for THIS deal's rail.
  const enriched = [];
  for (const s of splits) {
    const { data: creator } = await db.from('creators').select('*').eq('email', s.creator_email).single();
    if (isMomo) {
      if (!creator?.flw_onboarded || !creator?.momo_phone || !creator?.momo_network) {
        return NextResponse.json(
          { error: `${s.creator_email} hasn't set up a mobile money payout yet.` },
          { status: 409 }
        );
      }
      enriched.push({ ...s, momo_phone: creator.momo_phone, momo_network: creator.momo_network, beneficiary_name: creator.name || creator.email });
    } else {
      const p = payoutFor(creator, deal.rail);
      if (!p.onboarded || !p.accountId) {
        const what = deal.rail === 'stripe' ? 'Stripe' : deal.rail === 'paypal' ? 'PayPal' : 'bank';
        return NextResponse.json(
          { error: `${s.creator_email} hasn't set up a ${what} payout yet.` },
          { status: 409 }
        );
      }
      enriched.push({ ...s, provider_account_id: p.accountId });
    }
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
  const isPaypal = deal.rail === 'paypal';
  const provider = getProvider(deal.rail);
  let collection;
  try {
    collection = isMomo
      ? await provider.createCollectionNoSplit(deal)   // FLW: collect to balance, pay out later
      : isPaypal
        ? await provider.createCollection(deal)        // PayPal: order, then payout later
        : await provider.createCollection(deal, enriched); // stripe/flw-bank: split at charge
  } catch (e) {
    return NextResponse.json({ error: `Could not create payment link: ${e.message}` }, { status: 502 });
  }

  await db.from('deals').update({ status: 'locked', locked_at: new Date().toISOString(), collection_ref: collection.ref, collection_url: collection.url, fee_minor }).eq('id', dealId);

  return NextResponse.json({ ok: true, pay_url: collection.url });
}
