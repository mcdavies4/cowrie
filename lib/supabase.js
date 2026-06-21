import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Auth-aware server client bound to the request cookies. Use in route handlers
// when you need to know WHO is calling (the logged-in deal owner).
export function routeClient() {
  const cookieStore = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });
}

// Returns the logged-in user or null.
export async function currentUser() {
  const supa = routeClient();
  const { data } = await supa.auth.getUser();
  return data?.user || null;
}

// Service-role client — bypasses RLS. For admin writes (webhooks, token-based
// accept) and reads after we've already checked authorization ourselves.
// Never import this into the browser.
export function serverClient() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
