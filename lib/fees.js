// ROUGH ESTIMATES of payment-processor fees. Real fees vary by card type, country,
// and your negotiated rate — treat these as guidance for pricing your platform fee,
// not exact figures. Amounts are minor units (pence/kobo).
const RATES = {
  stripe: { pct: 2.5, fixed_minor: 20, cap_minor: null }, // ~2.5% + 20p (UK/intl card mix)
  flutterwave: { pct: 1.4, fixed_minor: 0, cap_minor: 200000 }, // ~1.4%, capped ₦2,000 local
  paypal: { pct: 3.5, fixed_minor: 30, cap_minor: null }, // ~3.5% + fixed (cross-border common)
};

export function processorRate(rail) {
  return RATES[rail] || { pct: 0, fixed_minor: 0, cap_minor: null };
}

export function estimateProcessorFee(totalMinor, rail) {
  const r = processorRate(rail);
  let pctPart = Math.round((totalMinor * r.pct) / 100);
  if (r.cap_minor != null) pctPart = Math.min(pctPart, r.cap_minor);
  return pctPart + r.fixed_minor;
}

// Your platform fee: a percentage, optionally capped at a maximum amount (minor units).
// e.g. 7% but never more than ₦20,000.
export function computePlatformFee(totalMinor, pct, capMinor) {
  const raw = Math.round((totalMinor * Number(pct || 0)) / 100);
  if (capMinor != null && capMinor > 0) return Math.min(raw, capMinor);
  return raw;
}

// Cowrie's own platform fee: a percentage, but capped at a maximum so big deals
// aren't charged an absurd amount. capMinor of 0/null means no cap.
export function platformFee(totalMinor, percent, capMinor) {
  const pct = Math.round((totalMinor * Number(percent || 0)) / 100);
  if (capMinor != null && Number(capMinor) > 0) return Math.min(pct, Number(capMinor));
  return pct;
}

// Sensible default fee caps per currency, in MAJOR units (for form prefill).
const FEE_CAP_DEFAULTS = { gbp: 25, usd: 30, eur: 30, ngn: 10000, ghs: 300, kes: 3000 };
export function defaultFeeCapMajor(currency) {
  const v = FEE_CAP_DEFAULTS[(currency || '').toLowerCase()];
  return v == null ? '' : v;
}
