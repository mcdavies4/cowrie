-- Run after 0006. Adds mobile-money payout support alongside the existing bank flow.
--
-- deals.payout_kind: 'bank' (subaccount split-at-charge, existing) or 'momo'
--   (collect to balance, then transfer to each wallet). Set at deal creation from currency.
-- creators.momo_*: a collaborator's mobile-money destination.

alter table deals add column if not exists payout_kind text not null default 'bank';

alter table creators add column if not exists momo_phone text;
alter table creators add column if not exists momo_network text;
