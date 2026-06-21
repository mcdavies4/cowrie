-- Run after 0001. Adds platform-fee support.

alter table deals add column if not exists platform_fee_percent numeric(5,2) default 0;
alter table deals add column if not exists fee_minor int default 0;

-- The platform fee is taken off the top at lock time; collaborators split the
-- remainder. On both rails the platform account keeps the fee automatically
-- (Stripe: transfers only sum to the net; Flutterwave: subaccounts only get the net).
