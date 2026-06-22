import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';

export const runtime = 'nodejs';

// Two-step from the UI:
//   action: 'resolve'  -> returns the account name to confirm (catches wrong-account mistakes)
//   action: 'create'   -> creates the subaccount and marks the creator onboarded
export async function POST(req) {
  const { creator_id, account_number, account_bank, business_name, action, token } = await req.json();
  if (!creator_id || !account_number || !account_bank) {
    return NextResponse.json({ error: 'Bank account number and bank code are required.' }, { status: 400 });
  }

  const db = serverClient();

  const { data: creator } = await db.from('creators').select('*').eq('id', creator_id).single();
  if (!creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  if (token) {
    const { data: split } = await db.from('deal_splits').select('creator_email').eq('accept_token', token).single();
    if (!split || split.creator_email !== creator.email) {
      return NextResponse.json({ error: 'Not authorized for this creator.' }, { status: 403 });
    }
  } else {
    const { currentUser } = await import('../../../../lib/supabase');
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Please sign in or provide an accept token.' }, { status: 401 });
  }

  const flw = getProvider('flutterwave');

  if (action === 'resolve') {
    try {
      const { account_name } = await flw.resolveBank(account_number, account_bank);
      return NextResponse.json({ account_name });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

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
