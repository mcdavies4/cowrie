// Resolve a creator's payout destination for a specific rail.
// A creator can be set up on Stripe, Flutterwave, both, or neither.
export function payoutFor(creator, rail) {
  if (!creator) return { accountId: null, onboarded: false, label: null };
  if (rail === 'stripe') {
    return { accountId: creator.stripe_account_id || null, onboarded: !!creator.stripe_onboarded, label: 'Stripe payout account' };
  }
  if (rail === 'flutterwave') {
    return { accountId: creator.flw_subaccount_id || null, onboarded: !!creator.flw_onboarded, label: creator.flw_label || 'Bank account' };
  }
  return { accountId: null, onboarded: false, label: null };
}
