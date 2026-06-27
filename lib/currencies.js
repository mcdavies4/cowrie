// Single source of truth for the currencies Cowrie supports, the rail each uses,
// and — for Flutterwave countries — the country code used to look up the bank list.
//
// To add a Flutterwave country: add a row here with its country code, then add a
// matching fee cap in lib/platform-fee.js. The bank dropdown, rail routing, and
// payout flow pick it up automatically.
//
// payout: 'bank'  -> account number + bank (works with the current payout flow)
//         'momo'  -> mobile money is the norm; bank works but is not how most locals
//                    get paid. Mobile-money payout is a planned addition.

export const CURRENCIES = [
  // Stripe rail (cards, no bank dropdown needed)
  { code: 'gbp', label: 'GBP £ · UK (Stripe)', rail: 'stripe' },
  { code: 'usd', label: 'USD $ (Stripe)', rail: 'stripe' },
  { code: 'eur', label: 'EUR € (Stripe)', rail: 'stripe' },

  // Flutterwave rail — bank-account payout works cleanly
  { code: 'ngn', label: 'NGN ₦ · Nigeria (Flutterwave)', rail: 'flutterwave', country: 'NG', payout: 'bank' },
  { code: 'ghs', label: 'GHS ₵ · Ghana (Flutterwave)', rail: 'flutterwave', country: 'GH', payout: 'bank' },
  { code: 'zar', label: 'ZAR R · South Africa (Flutterwave)', rail: 'flutterwave', country: 'ZA', payout: 'bank' },

  // Flutterwave rail — bank works, but mobile money is the local norm (Phase 2)
  { code: 'kes', label: 'KES · Kenya (Flutterwave)', rail: 'flutterwave', country: 'KE', payout: 'momo' },
  { code: 'ugx', label: 'UGX · Uganda (Flutterwave)', rail: 'flutterwave', country: 'UG', payout: 'momo' },
  { code: 'tzs', label: 'TZS · Tanzania (Flutterwave)', rail: 'flutterwave', country: 'TZ', payout: 'momo' },
];

export function currencyMeta(code) {
  const c = (code || '').toLowerCase();
  return CURRENCIES.find((x) => x.code === c) || null;
}

export function countryForCurrency(code) {
  return currencyMeta(code)?.country || 'NG';
}

export function payoutKindForCurrency(code) {
  return currencyMeta(code)?.payout || 'bank';
}

// Mobile-money currencies (KES/UGX/TZS) are built but the payout leg to M-Pesa
// isn't confirmed live on the Flutterwave account yet. Flip to true to enable
// them across the create form and deal creation.
export const MOMO_ENABLED = false;

export function isComingSoon(code) {
  return !MOMO_ENABLED && payoutKindForCurrency(code) === 'momo';
}
