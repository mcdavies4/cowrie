// ROUGH ESTIMATES of payment-processor fees. Real fees vary by card type, country,
// and your negotiated rate — treat these as guidance for pricing your platform fee,
// not exact figures. Amounts are minor units (pence/kobo).
const RATES = {
  stripe: { pct: 2.5, fixed_minor: 20, cap_minor: null }, // ~2.5% + 20p (UK/intl card mix)
  flutterwave: { pct: 1.4, fixed_minor: 0, cap_minor: 200000 }, // ~1.4%, capped ₦2,000 local
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
