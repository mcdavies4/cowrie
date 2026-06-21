// Flutterwave adapter (REST via fetch — no SDK dependency).
// KEY DIFFERENCE vs Stripe: FLW splits AT THE CHARGE. We bake each collaborator's
// exact amount into the payment via the `subaccounts` array, and FLW settles each
// party automatically. There is no separate "push transfers" step.
// NOTE: Flutterwave amounts are in MAJOR units (naira), not minor (kobo). We convert.

const BASE = 'https://api.flutterwave.com';
const KEY = () => process.env.FLW_SECRET_KEY;
const APP = () => process.env.NEXT_PUBLIC_APP_URL;

export const rail = 'flutterwave';

async function flw(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.status !== 'success') {
    throw new Error(`Flutterwave ${path}: ${json.message || 'request failed'}`);
  }
  return json.data;
}

// Resolve a bank account number to its registered name — call BEFORE locking a deal
// so money can't be sent to the wrong person.
// account_bank is the bank code (e.g. "044" Access Bank). country defaults to NG.
export async function resolveBank(account_number, account_bank) {
  const data = await flw('/v3/accounts/resolve', 'POST', { account_number, account_bank });
  return { account_name: data.account_name };
}

// Onboarding is a FORM, not a redirect. Create a subaccount under the platform account
// from the creator's bank details. split_value is a placeholder; we set exact amounts
// per charge using flat_subaccount, so this just needs to exist.
export async function createSubaccount({ account_bank, account_number, business_name, business_mobile, country }) {
  const data = await flw('/v3/subaccounts', 'POST', {
    account_bank,
    account_number,
    business_name,
    business_mobile: business_mobile || '0000000000',
    country: country || 'NG',
    split_type: 'percentage',
    split_value: 0, // overridden per-charge
  });
  return { providerAccountId: data.subaccount_id, label: `${business_name} ••${String(account_number).slice(-2)}` };
}

// Onboarding entrypoint used by the adapter interface. For FLW the UI collects bank
// details and calls /api/onboard/flutterwave directly, so this signals "use the form".
export async function onboardStart() {
  return { kind: 'form' };
}

// Build a hosted payment link with the split baked in. Each collaborator's exact
// amount (in MAJOR units) is attached as a flat_subaccount charge.
export async function createCollection(deal, splits) {
  const tx_ref = `cowrie_${deal.id}_${Date.now()}`;
  const subaccounts = splits.map((s) => ({
    id: s.provider_account_id,
    transaction_charge_type: 'flat_subaccount',
    transaction_charge: s.amount_minor / 100, // minor -> major
  }));

  const data = await flw('/v3/payments', 'POST', {
    tx_ref,
    amount: deal.total_amount_minor / 100, // minor -> major
    currency: (deal.currency || 'NGN').toUpperCase(),
    redirect_url: `${APP()}/deals/${deal.id}?paid=1`,
    customer: { email: `brand+${deal.id}@cowrie.app`, name: deal.brand_name || 'Brand' },
    meta: { deal_id: deal.id },
    subaccounts,
  });

  return { url: data.link, ref: tx_ref };
}

// FLW already split the money at settlement — nothing to push. Just acknowledge.
export async function distribute(deal, splits) {
  return splits.map((s) => ({ split_id: s.id, transfer_id: null, status: 'paid' }));
}
