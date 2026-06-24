import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';

export const runtime = 'nodejs';

export async function POST(req) {
  const { creator_id, paypal_email } = await req.json();
  if (!creator_id || !paypal_email || !paypal_email.includes('@')) {
    return NextResponse.json({ error: 'A valid PayPal email is required.' }, { status: 400 });
  }
  const db = serverClient();
  const { data: creator } = await db.from('creators').select('id').eq('id', creator_id).single();
  if (!creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  await db.from('creators').update({ paypal_email: paypal_email.trim() }).eq('id', creator.id);
  return NextResponse.json({ ok: true, payout_label: `PayPal: ${paypal_email.trim()}` });
}
