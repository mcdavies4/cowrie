import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { getProvider } from '../../../../../lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Re-checks each collaborator's payout status by asking the provider directly,
// so a missed account.updated webhook doesn't block locking. Owner only.
export async function POST(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  // Only Stripe needs reconciliation; Flutterwave marks ready at save time.
  if (deal.rail !== 'stripe') return NextResponse.json({ ok: true, rail: deal.rail });

  const stripe = getProvider('stripe');
  const { data: splits } = await db.from('deal_splits').select('creator_email').eq('deal_id', deal.id);

  let updated = 0;
  for (const s of splits) {
    const { data: creator } = await db.from('creators').select('*').eq('email', s.creator_email).single();
    if (!creator?.stripe_account_id || creator.stripe_onboarded) continue;
    try {
      const { complete } = await stripe.isOnboarded(creator.stripe_account_id);
      if (complete) {
        await db.from('creators').update({ stripe_onboarded: true }).eq('id', creator.id);
        updated++;
      }
    } catch (e) {
      // skip this one
    }
  }

  return NextResponse.json({ ok: true, updated });
}
