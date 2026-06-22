-- Run after 0004. Lets a creator hold a payout destination on BOTH rails, so a
-- GBP (Stripe) deal and an NGN (Flutterwave) deal can both pay the same person.
-- Previously a creator had one provider/destination, which blocked cross-rail deals.

alter table creators add column if not exists stripe_account_id  text;
alter table creators add column if not exists stripe_onboarded   boolean default false;
alter table creators add column if not exists flw_subaccount_id  text;
alter table creators add column if not exists flw_label          text;
alter table creators add column if not exists flw_onboarded      boolean default false;

-- Migrate any existing single-rail setups into the new per-rail columns.
update creators
  set flw_subaccount_id = provider_account_id,
      flw_label = payout_label,
      flw_onboarded = coalesce(onboarding_complete, false)
  where provider = 'flutterwave' and flw_subaccount_id is null;

update creators
  set stripe_account_id = provider_account_id,
      stripe_onboarded = coalesce(onboarding_complete, false)
  where provider = 'stripe' and stripe_account_id is null;

-- The old provider / provider_account_id / onboarding_complete columns are left in
-- place for safety but are no longer the source of truth.
