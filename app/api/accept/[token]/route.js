import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { payoutFor } from '../../../../lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const db = serverClient();
  const { data: split } = await db.from('deal_splits').select('*').eq('accept_token', params.token).single();
  if (!split) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 });

  const { data: deal } = await db.from('deals').select('id,title,brand_name,currency,rail,total_amount_minor,platform_fee_percent,platform_fee_cap_minor,status').eq('id', split.deal_id).single();
  const { data: creator } = await db.from('creators').select('*').eq('email', split.creator_email).single();
  const { data: allRaw } = await db.from('deal_splits').select('creator_email,percent').eq('deal_id', split.deal_id).order('percent', { ascending: false });
  const all = (allRaw || []).map((s) => ({
    creator_email: s.creator_email === split.creator_email ? s.creator_email : s.creator_email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    percent: s.percent,
  }));

  const onboarded = payoutFor(creator, deal?.rail).onboarded;

  return NextResponse.json({
    deal,
    split: { id: split.id, percent: split.percent, agreed_at: split.agreed_at, creator_email: split.creator_email },
    creator: creator ? { id: creator.id, email: creator.email } : null,
    onboarded,
    all,
  });
}
