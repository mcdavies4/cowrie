import { NextResponse } from 'next/server';
import { serverClient, currentUser } from '../../../lib/supabase';
import { railForCurrency } from '../../../lib/money';
import { sendEmail } from '../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List the signed-in owner's deals (newest first) with a collaborator count.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const db = serverClient();
  const { data: deals } = await db
    .from('deals')
    .select('*')
    .eq('created_by_email', user.email)
    .order('created_at', { ascending: false });

  const ids = (deals || []).map((d) => d.id);
  const counts = {};
  if (ids.length) {
    const { data: splits } = await db.from('deal_splits').select('deal_id').in('deal_id', ids);
    (splits || []).forEach((s) => { counts[s.deal_id] = (counts[s.deal_id] || 0) + 1; });
  }

  return NextResponse.json({
    email: user.email,
    deals: (deals || []).map((d) => ({ ...d, collaborator_count: counts[d.id] || 0 })),
  });
}

export async function POST(req) {
  // Owner must be signed in. Their email is the deal owner — not something the body can spoof.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await req.json();
  const { title, brand_name, currency, total, splits, platform_fee_percent } = body;

  if (!title || !currency || !total || !Array.isArray(splits) || splits.length === 0) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const rail = railForCurrency(currency);
  if (!rail) {
    return NextResponse.json({ error: `Currency ${currency} is not supported on either rail yet.` }, { status: 400 });
  }

  const sumPercent = splits.reduce((s, x) => s + Number(x.percent || 0), 0);
  if (Math.round(sumPercent * 100) !== 10000) {
    return NextResponse.json({ error: `Splits must total 100%. They total ${sumPercent}%.` }, { status: 400 });
  }

  const total_amount_minor = Math.round(parseFloat(total) * 100);
  const feePct = platform_fee_percent != null && platform_fee_percent !== ''
    ? Number(platform_fee_percent)
    : Number(process.env.PLATFORM_FEE_PERCENT || 0);

  const db = serverClient();

  const { data: deal, error: dealErr } = await db
    .from('deals')
    .insert({
      title,
      brand_name,
      currency: currency.toLowerCase(),
      rail,
      total_amount_minor,
      platform_fee_percent: feePct,
      created_by_email: user.email,
    })
    .select()
    .single();
  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 });

  const rows = splits.map((s) => ({ deal_id: deal.id, creator_email: s.email.toLowerCase(), percent: Number(s.percent) }));
  const { data: created, error: splitErr } = await db.from('deal_splits').insert(rows).select();
  if (splitErr) return NextResponse.json({ error: splitErr.message }, { status: 500 });

  for (const s of splits) {
    await db.from('creators').upsert({ email: s.email.toLowerCase(), name: s.name || null }, { onConflict: 'email' });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const links = [];
  for (const sp of created) {
    const link = `${appUrl}/accept/${sp.accept_token}`;
    links.push({ email: sp.creator_email, percent: sp.percent, link });
    await sendEmail({
      to: sp.creator_email,
      subject: `You've got a ${sp.percent}% share on "${title}"`,
      text: `${user.email} added you to a deal on Cowrie.\n\nYour share: ${sp.percent}%\nReview and accept: ${link}`,
    });
  }

  return NextResponse.json({ deal_id: deal.id, links });
}
