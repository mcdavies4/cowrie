import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';

export const runtime = 'nodejs';

// Two-step from the UI:
//   action: 'resolve'  -> returns the account name to confirm (catches wrong-account mistakes)
//   action: 'create'   -> creates the subaccount and marks the creator onboarded
export async function POST(req) {
  const body = await req.json();
  const { creator_id, account_number, account_bank, business_name, action, momo_phone, momo_network } = body;

  const flw = getProvider('flutterwave');
  const db = serverClient();

  // Mobile money: store the wallet destination and mark the creator onboarded.
  if (action === 'momo') {
    if (!creator_id || !momo_phone || !momo_network) {
      return NextResponse.json({ error: 'Mobile money number and network are required.' }, { status: 400 });
    }
    const { data: creator } = await db.from('creators').select('id').eq('id', creator_id).single();
    if (!creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    await db
      .from('creators')
      .update({ momo_phone, momo_network, flw_label: `Mobile money ••${String(momo_phone).slice(-3)}`, flw_onboarded: true })
      .eq('id', creator.id);
    return NextResponse.json({ ok: true, payout_label: `Mobile money ••${String(momo_phone).slice(-3)}` });
  }

  if (!creator_id || !account_number || !account_bank) {
    return NextResponse.json({ error: 'Bank account number and bank code are required.' }, { status: 400 });
  }

  if (action === 'resolve') {
    try {
      const { account_name } = await flw.resolveBank(account_number, account_bank);
      return NextResponse.json({ account_name });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  const { data: creator } = await db.from('creators').select('*').eq('id', creator_id).single();
  if (!creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  try {
    const { providerAccountId, label } = await flw.createSubaccount({
      account_bank,
      account_number,
      business_name: business_name || creator.name || creator.email,
      business_email: creator.email,
    });
    await db
      .from('creators')
      .update({ flw_subaccount_id: providerAccountId, flw_label: label, flw_onboarded: true })
      .eq('id', creator.id);
    return NextResponse.json({ ok: true, payout_label: label });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
