-- Run after 0003. De-dupes webhook deliveries.
--
-- Stripe and Flutterwave both retry webhooks, and can deliver the same event more than
-- once. We claim each event's id here under a unique constraint; a duplicate claim fails
-- and we skip reprocessing. (The money paths are already idempotent — Stripe transfers use
-- per-split idempotency keys and a status guard — so this is belt-and-suspenders plus it
-- stops duplicate settlement emails and redundant work.)

create table if not exists webhook_events (
  provider_ref text primary key,         -- e.g. 'stripe_evt_123' or 'flw_456'
  created_at   timestamptz default now()
);

alter table webhook_events enable row level security;
-- No public policies: only the service role (server) touches this table.
