import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { getProvider } from '../../../../../lib/providers';
import { sendSettlementEmail, sendCollaboratorPaidEmail } from '../../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Re-attempts Stripe transfers for a deal that was paid but couldn't fully distribute
// (usually because card funds hadn't settled to the available balance yet). Owner only.
export async function POST(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (deal.rail !== 'stripe') return NextResponse.json({ ok: true, note: 'Only Stripe deals distribute by transfer.' });
  if (deal.status !== 'paid') {
    return NextResponse.json({ ok: false, error: `Nothing to retry — deal is "${deal.status}".` }, { status: 409 });
  }

  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', deal.id);
  const enriched = [];
  for (const s of splits) {
    const { data: creator } = await db.from('creators').select('stripe_account_id').eq('email', s.creator_email).single();
    enriched.push({ ...s, provider_account_id: creator?.stripe_account_id });
  }

  const provider = getProvider('stripe');
  const results = await provider.distribute(deal, enriched);
  let allPaid = true;
  let stillPending = null;
  for (const r of results) {
    if (r.status === 'paid') {
      const split = enriched.find((s) => s.id === r.split_id);
      if (split?.transfer_status !== 'paid') {
        await db.from('deal_splits').update({ transfer_id: r.transfer_id, transfer_status: 'paid' }).eq('id', r.split_id);
        await db.from('transactions').insert({ deal_id: deal.id, kind: 'transfer_sent', amount_minor: split?.amount_minor, provider_ref: r.transfer_id });
        if (split) await sendCollaboratorPaidEmail(deal, { email: split.creator_email, amount_minor: split.amount_minor });
      }
    } else {
      allPaid = false;
      stillPending = r.error;
    }
  }

  if (allPaid) {
    await db.from('deals').update({ status: 'distributed' }).eq('id', deal.id);
    await sendSettlementEmail(deal, enriched.map((s) => ({ email: s.creator_email, amount_minor: s.amount_minor })));
    return NextResponse.json({ ok: true, status: 'distributed' });
  }

  return NextResponse.json({ ok: false, status: 'paid', pending: stillPending || 'funds_not_yet_available' });
}
