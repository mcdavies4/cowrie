// Cowrie's platform fee — SET BY COWRIE, not by creators. This is the single source
// of truth. Change these values and redeploy to update pricing across the whole app.

export const PLATFORM_FEE_PERCENT = 3; // % Cowrie takes from every deal

// Maximum fee per currency, in MAJOR units (so a percentage fee never gets excessive
// on large deals). null = no cap. Caps differ by currency because amounts differ wildly.
// Tuned so Cowrie's fee comfortably clears the processor's cut at every deal size.
const FEE_CAPS_MAJOR = {
  ngn: 25000, // ₦25,000
  ghs: 350,
  kes: 3500,
  usd: 75,
  eur: 70,
  gbp: 60,
};

// Returns the fixed fee config for a currency: { percent, capMinor }.
export function platformFee(currency) {
  const c = (currency || '').toLowerCase();
  const capMajor = FEE_CAPS_MAJOR[c];
  return {
    percent: PLATFORM_FEE_PERCENT,
    capMinor: capMajor != null ? Math.round(capMajor * 100) : null,
  };
}
