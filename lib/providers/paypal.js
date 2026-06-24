// PayPal adapter (REST via fetch). Like mobile money, PayPal is COLLECT-THEN-PAYOUT:
// the brand pays into the platform's PayPal balance (Orders v2), then we batch-pay each
// collaborator by email (Payouts API). Recipients just need a PayPal email — no Stripe
// onboarding. Amounts are MAJOR units (dollars) as decimal strings.
//
// Requires PAYPAL_CLIENT_ID, PAYPAL_SECRET, and PAYPAL_ENV ('sandbox' | 'live').
// Payouts must be enabled on the PayPal Business account (requested separately).

const ENV = () => (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const BASE = () => (ENV() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
const APP = () => process.env.NEXT_PUBLIC_APP_URL;

export const rail = 'paypal';

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`PayPal auth failed: ${json.error_description || json.error || 'no token'}`);
  return json.access_token;
}

const money = (minor) => (minor / 100).toFixed(2);

// Onboarding is just a PayPal email — the UI collects it and calls /api/onboard/paypal.
export async function onboardStart() {
  return { kind: 'form' };
}

// Collection: create an order for the full amount; return the approval link for the brand.
export async function createCollection(deal) {
  const t = await token();
  const res = await fetch(`${BASE()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: deal.id,
        custom_id: deal.id,
        description: (deal.title || 'Cowrie deal').slice(0, 120),
        amount: { currency_code: (deal.currency || 'USD').toUpperCase(), value: money(deal.total_amount_minor) },
      }],
      application_context: {
        brand_name: 'Cowrie',
        user_action: 'PAY_NOW',
        return_url: `${APP()}/api/paypal/capture?deal=${deal.id}`,
        cancel_url: `${APP()}/deals/${deal.id}`,
      },
    }),
  });
  const json = await res.json();
  if (!json.id) throw new Error(`PayPal order failed: ${json.message || json.name || 'unknown'}`);
  const approve = (json.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
  return { url: approve?.href, ref: json.id };
}

// Capture an approved order — money lands in the platform's PayPal balance.
export async function captureOrder(orderId) {
  const t = await token();
  const res = await fetch(`${BASE()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `cap_${orderId}` },
  });
  const json = await res.json();
  return { status: json.status, raw: json }; // "COMPLETED" on success
}

// Payout: batch-send each collaborator's share to their PayPal email.
// sender_item_id = split id, so the payout webhook can match each item back to a split.
export async function createPayout(deal, splits) {
  const t = await token();
  const items = splits.map((s) => ({
    recipient_type: 'EMAIL',
    receiver: s.paypal_email,
    amount: { value: money(s.amount_minor), currency: (deal.currency || 'USD').toUpperCase() },
    sender_item_id: s.id,
    note: `Your share of "${deal.title}"`,
  }));
  const res = await fetch(`${BASE()}/v1/payments/payouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `payout_${deal.id}_${Date.now()}` },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `cowrie_${deal.id}_${Date.now()}`,
        email_subject: 'You have a payout from Cowrie',
        email_message: 'Your share of a collaboration has been paid.',
      },
      items,
    }),
  });
  const json = await res.json();
  const batch = json.batch_header?.payout_batch_id;
  if (!batch) throw new Error(`PayPal payout failed: ${json.message || json.name || 'unknown'}`);
  return { batchId: batch };
}

// No automatic split — payouts happen via createPayout after collection.
export async function distribute() {
  return [];
}

// Verify a webhook really came from PayPal (signature check against PAYPAL_WEBHOOK_ID).
export async function verifyWebhook(headers, event) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return false;
  const t = await token();
  const res = await fetch(`${BASE()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  const json = await res.json();
  return json.verification_status === 'SUCCESS';
}
