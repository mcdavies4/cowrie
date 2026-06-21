-- Cowrie schema — run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Money is ALWAYS stored as integer minor units (pence/kobo). Never floats.

create extension if not exists "pgcrypto";

-- ── Creators ─────────────────────────────────────────────
-- A creator is anyone who can receive a share. Identified by email.
-- Their payout destination lives on whichever rail the deal runs on.
create table if not exists creators (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  name                text,
  provider            text,                 -- 'stripe' | 'flutterwave' | null (not set up yet)
  provider_account_id text,                 -- Stripe acct_xxx  OR  FLW subaccount id (RS_xxx)
  payout_label        text,                 -- human-readable: "Access Bank ••89" or "Stripe (GBP)"
  onboarding_complete boolean default false,
  created_at          timestamptz default now()
);

-- ── Deals ────────────────────────────────────────────────
-- One collaboration. Locks before money can move. Currency picks the rail.
create table if not exists deals (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  brand_name         text,
  total_amount_minor int not null,          -- e.g. 100000 = £1,000.00 or ₦1,000.00
  currency           text not null,         -- 'gbp' | 'usd' | 'eur' | 'ngn' | 'ghs' | 'kes' ...
  rail               text not null,         -- 'stripe' | 'flutterwave' (derived from currency at creation)
  status             text default 'draft',  -- draft | locked | paid | distributed
  locked_at          timestamptz,
  created_by_email   text not null,         -- the deal owner (v0 has no full auth; see README)
  collection_ref     text,                  -- stripe session id / flw tx ref
  created_at         timestamptz default now()
);

-- ── Splits ───────────────────────────────────────────────
-- Each collaborator's share of one deal. Accepted via magic-link token.
create table if not exists deal_splits (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references deals(id) on delete cascade,
  creator_email   text not null,
  creator_id      uuid references creators(id),
  percent         numeric(5,2) not null,    -- 60.00
  amount_minor    int,                       -- computed & frozen at lock time
  accept_token    text unique not null default encode(gen_random_bytes(24), 'hex'),
  agreed_at       timestamptz,               -- their acceptance timestamp (the "signature")
  transfer_id     text,                      -- stripe tr_xxx (flw splits at settlement, so stays null)
  transfer_status text default 'pending'     -- pending | paid | failed
);

-- ── Transactions (immutable audit log) ───────────────────
create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid references deals(id),
  kind         text,                          -- payment_received | transfer_sent | split_settled
  amount_minor int,
  provider_ref text,
  created_at   timestamptz default now()
);

create index if not exists idx_splits_deal on deal_splits(deal_id);
create index if not exists idx_splits_token on deal_splits(accept_token);
create index if not exists idx_tx_deal on transactions(deal_id);

-- NOTE on security: v0 uses the service-role key on the server for all writes, so RLS is
-- bypassed by the API routes. Keep the service-role key server-only. Before going public,
-- add Supabase Auth for deal owners and tighten RLS. See README "Hardening".
