import { NextResponse } from 'next/server';
import { routeClient } from '../../../lib/supabase';

export const runtime = 'nodejs';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') || '/deals/new';

  const supa = routeClient();

  // Magic-link token-hash flow (reliable for server-side / SSR apps).
  if (token_hash && type) {
    const { error } = await supa.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    // PKCE code-exchange flow.
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // Anything else failed — bounce back to login with a flag.
  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
