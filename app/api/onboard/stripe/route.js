import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';

export const runtime = 'nodejs';

// GET /api/onboard/stripe?creator=<creator_id>
export async function GET(req) {
  const creatorId = new URL(req.url).searchParams.get('creator');
  if (!creatorId) return NextResponse.json({ error: 'Missing creator id.' }, { status: 400 });

  const db = serverClient();
  const { data: creator, error } = await db.from('creators').select('*').eq('id', creatorId).single();
  if (error || !creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

  const stripe = getProvider('stripe');
  const { url, providerAccountId } = await stripe.onboardStart(creator);

  await db
    .from('creators')
    .update({ provider: 'stripe', provider_account_id: providerAccountId })
    .eq('id', creator.id);

  return NextResponse.redirect(url);
}
