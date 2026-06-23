import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns the list of banks (name + code) for a country, from Flutterwave.
// Default NG. The collaborator picks a bank by name; we use the code behind the scenes.
export async function GET(req) {
  const country = new URL(req.url).searchParams.get('country') || 'NG';
  try {
    const res = await fetch(`https://api.flutterwave.com/v3/banks/${country}`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.status !== 'success') {
      return NextResponse.json({ error: json.message || 'Could not load banks.' }, { status: 502 });
    }
    // Sort alphabetically and return only what the UI needs.
    const banks = (json.data || [])
      .map((b) => ({ code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ banks });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach Flutterwave: ${e.message}` }, { status: 502 });
  }
}
