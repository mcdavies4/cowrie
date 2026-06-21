import { NextResponse } from 'next/server';
import { routeClient } from '../../../lib/supabase';

export const runtime = 'nodejs';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/deals/new';

  if (code) {
    const supa = routeClient();
    await supa.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
