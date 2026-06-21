import { NextResponse } from 'next/server';
import { serverClient } from '../../../../../lib/supabase';

export const runtime = 'nodejs';

// [id] here is the accept_token (we route by token, not split uuid, for the magic link).
export async function POST(req, { params }) {
  const token = params.id;
  const db = serverClient();

  const { data: split, error } = await db
    .from('deal_splits')
    .select('*')
    .eq('accept_token', token)
    .single();
  if (error || !split) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 });

  const { data: deal } = await db.from('deals').select('status').eq('id', split.deal_id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  // Can't accept terms after the deal is locked — acceptance must be on frozen terms.
  if (deal.status !== 'draft') {
    return NextResponse.json({ error: 'This deal is already locked and can no longer be changed.' }, { status: 409 });
  }
  if (split.agreed_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Bind acceptance to the creator row for this email.
  const { data: creator } = await db.from('creators').select('id').eq('email', split.creator_email).single();

  const { error: upErr } = await db
    .from('deal_splits')
    .update({ agreed_at: new Date().toISOString(), creator_id: creator?.id || null })
    .eq('id', split.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
