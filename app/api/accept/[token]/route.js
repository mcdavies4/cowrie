import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';

export const runtime = 'nodejs';

export async function GET(req, { params }) {
  const db = serverClient();
  const { data: split } = await db.from('deal_splits').select('*').eq('accept_token', params.token).single();
  if (!split) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 });

  const { data: deal } = await db.from('deals').select('id,title,brand_name,currency,rail,total_amount_minor,platform_fee_percent,status').eq('id', split.deal_id).single();
  const { data: creator } = await db.from('creators').select('id,email,provider,onboarding_complete,payout_label').eq('email', split.creator_email).single();
  const { data: all } = await db.from('deal_splits').select('creator_email,percent').eq('deal_id', split.deal_id).order('percent', { ascending: false });

  return NextResponse.json({
    deal,
    split: { id: split.id, percent: split.percent, agreed_at: split.agreed_at, creator_email: split.creator_email },
    creator,
    all,
  });
}
