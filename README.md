# Cowrie

Revenue-split tool for collaborating creators. Agree the split up front; when the brand pays, every
collaborator's share settles to their own account automatically. No one has to trust anyone else to pay them.

Two rails, chosen by the deal's currency:
- **GBP / USD / EUR → Stripe Connect.** Money lands on your platform account, then transfers push out per split.
- **NGN / GHS / KES … → Flutterwave.** The split is baked into the charge; Flutterwave settles each party at source.

The provider difference is hidden behind one adapter (`lib/providers/`). The rest of the app doesn't care
which rail a deal runs on.

---

## What's in here

```
app/                     Next.js App Router (UI + API routes)
  page.js                landing
  deals/new              create a deal
  deals/[id]             deal dashboard: status, lock, payment link
  accept/[token]         collaborator magic-link: accept + set up payout
  api/                   route handlers (deals, splits, onboard, pay, webhooks)
lib/
  providers/             stripe.js, flutterwave.js, index.js  ← the adapter
  money.js               rail routing + largest-remainder allocation (no stranded pennies)
  supabase.js            browser + server clients
  email.js               Resend, or console-log fallback if no key
supabase/migrations/     0001_init.sql  ← run this in the SQL Editor
```

---

## Setup (Windows / CMD)

### 1. Install
```
cd cowrie
npm install
```

### 2. Database
In your Supabase project: **SQL Editor → New query**, run `0001_init.sql`, then `0002_platform_fee.sql`,
then `0003_rls.sql`, then `0004_webhook_dedup.sql` (in `supabase/migrations/`). Run them in order.

### 2b. Auth (owner sign-in)
In Supabase → **Authentication → Providers**, make sure **Email** is enabled (magic link is on by default).
Under **Authentication → URL Configuration**, set the **Site URL** to your app URL and add redirect URLs:
`http://localhost:3000/auth/callback` and `https://YOUR.vercel.app/auth/callback`.
Collaborators never sign in — only deal owners do.

### 3. Environment
```
copy .env.example .env
```
Fill in `.env`:
- **Supabase** — Settings → API: project URL, anon key, and the **service role** key (server-only).
- **Stripe** — test secret key. Enable **Connect** in the dashboard (test mode is fine).
- **Flutterwave** — your test secret key. Set a **secret hash** under Settings → Webhooks and put the same value in `FLW_SECRET_HASH`.
- **NEXT_PUBLIC_APP_URL** — `http://localhost:3000` locally; your Vercel URL in prod.
- **Resend** — optional. Leave blank and accept links get logged to the server console so you can still test.

### 4. Run
```
npm run dev
```
Open http://localhost:3000.

### 5. Webhooks (local testing)
Stripe (separate terminal, needs Stripe CLI):
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

Flutterwave can't reach localhost — test webhooks after deploying, or use a tunnel (ngrok) and set the
URL + secret hash in the FLW dashboard.

---

## Deploy (your usual flow)

```
git init
git add .
git commit -m "Cowrie v0"
git branch -M main
git remote add origin https://github.com/mcdavies4/cowrie.git
git push -u origin main
```

In Vercel: **New Project → import the repo**. Add every var from `.env` to **Settings → Environment Variables**
(set `NEXT_PUBLIC_APP_URL` to the Vercel domain). Deploy.

Then register the production webhooks:
- **Stripe** → Developers → Webhooks → add `https://YOUR.vercel.app/api/webhooks/stripe`, listen for
  `checkout.session.completed` and `account.updated`. Put its signing secret in the env var and redeploy.
- **Flutterwave** → Settings → Webhooks → `https://YOUR.vercel.app/api/webhooks/flutterwave`, set the secret hash.

---

## The end-to-end flow

1. Owner signs in (magic link), then creates a deal (`/deals/new`) — title, currency, total, optional platform
   fee %, and each person's %. The owner's email comes from their session.
2. Each collaborator opens their accept link, **accepts** their share (timestamped — the "signature").
3. Each collaborator **sets up payout**: Stripe redirect (GBP/USD/EUR) or a bank form with name-check (FLW).
4. Owner **locks** the deal. This validates 100% allocated, everyone accepted, everyone onboarded on the
   right rail; freezes exact amounts; and generates the brand payment link. Terms can't change after lock.
5. Brand pays. Webhook fires. Stripe pushes transfers; Flutterwave has already split at settlement. Status → distributed.

### Watch a full Stripe deal settle (test mode)

1. Sign in, create a GBP deal with two collaborators (use two emails you control). Add a fee like `10`.
2. Open each accept link, accept, and complete Stripe Express onboarding. In test mode use SSN `000-00-0000`,
   any future expiry, and the test bank routing/account Stripe shows. `account.updated` flips them to ready.
3. Lock the deal — you'll get a Checkout link.
4. Pay it with test card `4242 4242 4242 4242`, any future date, any CVC.
5. With `stripe listen` running, `checkout.session.completed` fires, the webhook pushes a transfer to each
   collaborator, and the dashboard flips to **Distributed**. Check the transfers under Stripe → Connect.
   Flutterwave test mode works the same way using their test bank accounts (e.g. `0690000037`, bank `044`).

---

## Money correctness

- Stored as integer minor units everywhere (pence/kobo). Stripe uses minor directly; the FLW adapter converts
  to major units at the API boundary.
- `allocate()` uses the largest-remainder method, so split parts always sum **exactly** to the total — no
  stranded penny (£100 three ways = 33.34 / 33.33 / 33.33).
- Stripe transfers use `idempotencyKey: transfer_<split_id>`, so webhook retries never double-pay.

---

## Before this goes live (hardening)

This is a working v0. In place now: **owner sign-in**, a **platform fee**, **row-level security**, a
**My deals** list, **webhook de-duplication** (migration 0004 — duplicate Stripe/FLW deliveries are claimed
once and skipped; the FLW `tx_ref` is stored on the deal as `collection_ref`), and an **owner settlement
email** when a deal fully pays out. Still worth doing before real scale:

1. **Fee vs processor cost.** The platform fee keeps money on your account, but Stripe/FLW still take their
   processing cut from that same balance. Set the fee high enough to cover it (and your margin), or you can
   still net negative on small deals.
2. **Chargeback exposure.** On both rails the marketplace/platform owner is liable for disputes. Vet who you
   onboard; consider holding a reserve.
3. **FCA perimeter.** v0 splits on arrival and holds nothing. If you ever add escrow ("hold until content goes
   live"), you may be handling client money and brushing the FCA payment-services perimeter — get advice first.

Not legal advice — the FCA note especially is a flag to check, not a ruling.
