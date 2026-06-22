import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', params.id).single();
  if (!deal) return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });

  const user = await currentUser();
  if (!user || user.email !== deal.created_by_email) {
    return NextResponse.json({ error: 'Only the deal owner can cancel this.' }, { status: 403 });
  }

  // Only cancellable before money is collected. Once paid/distributed it's a refund, not a cancel.
  if (deal.status !== 'draft' && deal.status !== 'locked') {
    return NextResponse.json(
      { error: `This deal is "${deal.status}" and can no longer be cancelled. A paid deal needs a refund, not a cancellation.` },
      { status: 409 }
    );
  }

  await db.from('deals').update({ status: 'cancelled' }).eq('id', deal.id);
  return NextResponse.json({ ok: true, status: 'cancelled' });
}
