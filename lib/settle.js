import { sendSettlementEmail, sendCollaboratorPaidEmail } from './email';

// Marks a Flutterwave deal distributed, records the split, emails the owner.
// Safe to call more than once — it no-ops if the deal is already distributed.
export async function settleFlutterwaveDeal(db, deal, providerRef) {
  if (deal.status === 'distributed' || deal.status === 'cancelled') return false;

  await db.from('transactions').insert({
    deal_id: deal.id,
    kind: 'payment_received',
    amount_minor: deal.total_amount_minor,
    provider_ref: providerRef,
  });

  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', deal.id);
  for (const s of splits) {
    await db.from('deal_splits').update({ transfer_status: 'paid' }).eq('id', s.id);
    await db.from('transactions').insert({
      deal_id: deal.id, kind: 'split_settled', amount_minor: s.amount_minor, provider_ref: providerRef,
    });
    await sendCollaboratorPaidEmail(deal, { email: s.creator_email, amount_minor: s.amount_minor });
  }

  await db.from('deals').update({ status: 'distributed' }).eq('id', deal.id);
  await sendSettlementEmail(deal, (splits || []).map((s) => ({ email: s.creator_email, amount_minor: s.amount_minor })));
  return true;
}
