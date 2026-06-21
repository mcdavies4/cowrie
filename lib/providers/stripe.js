import Stripe from 'stripe';

const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);
const APP = () => process.env.NEXT_PUBLIC_APP_URL;

export const rail = 'stripe';

// Onboarding is a REDIRECT to Stripe-hosted Express KYC.
// Creates a connected account under the platform if the creator has none yet.
export async function onboardStart(creator) {
  const s = stripe();
  let acct = creator.provider_account_id;

  if (!acct) {
    const account = await s.accounts.create({
      type: 'express',
      email: creator.email,
      capabilities: { transfers: { requested: true } },
      metadata: { creator_id: creator.id },
    });
    acct = account.id;
  }

  const link = await s.accountLinks.create({
    account: acct,
    refresh_url: `${APP()}/api/onboard/stripe?creator=${creator.id}`,
    return_url: `${APP()}/onboard/done?creator=${creator.id}`,
    type: 'account_onboarding',
  });

  return { kind: 'redirect', url: link.url, providerAccountId: acct };
}

// Has this connected account finished KYC and can it receive transfers?
export async function isOnboarded(providerAccountId) {
  const account = await stripe().accounts.retrieve(providerAccountId);
  return {
    complete: !!account.payouts_enabled && !!account.charges_enabled,
    label: 'Stripe payout account',
  };
}

// Brand pays via a hosted Checkout page. Money lands on the PLATFORM account.
// Distribution happens later in the webhook (push model).
export async function createCollection(deal) {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: deal.currency,
          product_data: { name: `${deal.title}${deal.brand_name ? ' — ' + deal.brand_name : ''}` },
          unit_amount: deal.total_amount_minor,
        },
        quantity: 1,
      },
    ],
    metadata: { deal_id: deal.id },
    payment_intent_data: { metadata: { deal_id: deal.id }, transfer_group: deal.id },
    success_url: `${APP()}/deals/${deal.id}?paid=1`,
    cancel_url: `${APP()}/deals/${deal.id}`,
  });
  return { url: session.url, ref: session.id };
}

// Push each collaborator's share to their connected account.
// Idempotent: pass each split's id as the idempotency key so Stripe retries don't double-pay.
export async function distribute(deal, splits) {
  const s = stripe();
  const results = [];
  for (const split of splits) {
    if (split.transfer_status === 'paid') {
      results.push({ split_id: split.id, transfer_id: split.transfer_id, status: 'paid' });
      continue;
    }
    const transfer = await s.transfers.create(
      {
        amount: split.amount_minor,
        currency: deal.currency,
        destination: split.provider_account_id,
        transfer_group: deal.id,
        metadata: { deal_id: deal.id, split_id: split.id },
      },
      { idempotencyKey: `transfer_${split.id}` }
    );
    results.push({ split_id: split.id, transfer_id: transfer.id, status: 'paid' });
  }
  return results;
}
