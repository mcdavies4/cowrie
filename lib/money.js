// All money is integer minor units (pence/kobo/cents). No floats, ever.

// Which currencies route to which rail.
const STRIPE_CCY = ['gbp', 'usd', 'eur', 'cad', 'aud'];
const FLW_CCY = ['ngn', 'ghs', 'kes', 'ugx', 'tzs', 'zar', 'xof', 'xaf', 'rwf'];

export function railForCurrency(currency) {
  const c = (currency || '').toLowerCase();
  if (STRIPE_CCY.includes(c)) return 'stripe';
  if (FLW_CCY.includes(c)) return 'flutterwave';
  return null; // caller should reject
}

export function supportedCurrencies() {
  return { stripe: STRIPE_CCY, flutterwave: FLW_CCY };
}

// Split a total across percentage shares with the largest-remainder method,
// so the parts ALWAYS sum exactly to the total (no stranded penny).
// shares: [{ id, percent }]  ->  { [id]: amount_minor }
export function allocate(totalMinor, shares) {
  const raw = shares.map((s) => {
    const exact = (totalMinor * Number(s.percent)) / 100;
    return { id: s.id, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let assigned = raw.reduce((sum, r) => sum + r.floor, 0);
  let remainder = totalMinor - assigned; // whole minor units still to hand out

  // Give the leftover units to the largest fractional parts first.
  const order = [...raw].sort((a, b) => b.frac - a.frac);
  const out = {};
  for (const r of raw) out[r.id] = r.floor;
  for (let i = 0; i < remainder; i++) out[order[i % order.length].id] += 1;
  return out;
}

export function formatMoney(minor, currency) {
  const c = (currency || 'gbp').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: c }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${c}`;
  }
}
