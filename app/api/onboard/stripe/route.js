import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';

export const runtime = 'nodejs';

// GET /api/onboard/stripe?creator=<creator_id>&token=<accept_token>
export async function GET(req) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get('creator');
  const token = url.searchParams.get('token');
  if (!creatorId) return NextResponse.json({ error: 'Missing creator id.' }, { status: 400 });

  const db = serverClient();
  const { data: creator, error } = await db.from('creators').select('*').eq('id', creatorId).single();
  if (error || !creator) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });

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

  try {
    const stripe = getProvider('stripe');
    const { url, providerAccountId } = await stripe.onboardStart(creator);
    await db
      .from('creators')
      .update({ stripe_account_id: providerAccountId })
      .eq('id', creator.id);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: `Stripe setup failed: ${e.message}` }, { status: 502 });
  }
}
