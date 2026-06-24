import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';
import { getProvider } from '../../../../../lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pushes each collaborator's share to their mobile wallet, from the platform balance.
// Used for momo deals after the brand has paid (status 'paid'). Owner only.
// Safe to re-run: splits already paid are skipped, and the FLW transfer reference is
// deterministic per split. If the balance hasn't settled yet, transfers fail and the
// deal stays 'paid' so the owner can retry once funds land (T+1).
export async function POST(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (deal.payout_kind !== 'momo') {
    return NextResponse.json({ error: 'This deal does not use mobile money.' }, { status: 409 });
  }
  if (deal.status !== 'paid') {
    return NextResponse.json({ error: `Nothing to release — deal is "${deal.status}".` }, { status: 409 });
  }

  const flw = getProvider('flutterwave');
  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', deal.id);

  let initiated = 0;
  let lastError = null;
  for (const s of splits) {
    if (s.transfer_status === 'paid' || s.transfer_status === 'queued') continue; // already sent / awaiting confirmation
    const { data: creator } = await db.from('creators').select('*').eq('email', s.creator_email).single();
    if (!creator?.momo_phone || !creator?.momo_network) { lastError = `${s.creator_email} has no mobile money set up.`; continue; }
    try {
      const { transfer_id } = await flw.transferMomo({
        network: creator.momo_network,
        phone: creator.momo_phone,
        amount_minor: s.amount_minor,
        currency: deal.currency,
        beneficiary_name: creator.name || creator.email,
        sender_name: 'Cowrie',
        sender_country: 'NG',
        reference: `cowrie_${deal.id}_${s.id}`,
      });
      // Queued, not confirmed. transfer.completed webhook flips this to 'paid' (or 'failed').
      await db.from('deal_splits').update({ transfer_id: String(transfer_id), transfer_status: 'queued' }).eq('id', s.id);
      initiated++;
    } catch (e) {
      lastError = e.message;
    }
  }

  // We deliberately do NOT mark the deal distributed here — that happens when the
  // transfer.completed webhook confirms every payout actually landed.
  if (lastError && initiated === 0) {
    return NextResponse.json({ ok: false, error: lastError.includes('balance') || lastError.toLowerCase().includes('insufficient')
      ? 'Not enough settled balance yet. If the brand just paid, funds settle next business day — try again then.'
      : lastError });
  }
  return NextResponse.json({ ok: true, initiated, note: 'Payouts sent to Flutterwave. They confirm as paid once each transfer completes.' });
}
