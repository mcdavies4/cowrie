import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../lib/supabase';
import { payoutFor } from '../../../../lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { data: splits } = await db.from('deal_splits').select('*').eq('deal_id', params.id).order('percent', { ascending: false });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const enriched = [];
  for (const s of splits) {
    const { data: creator } = await db.from('creators').select('*').eq('email', s.creator_email).single();
    const p = payoutFor(creator, deal.rail);
    enriched.push({
      ...s,
      onboarding_complete: p.onboarded,
      payout_label: p.label,
      accept_link: `${appUrl}/accept/${s.accept_token}`,
    });
  }

  return NextResponse.json({ deal, splits: enriched });
}
