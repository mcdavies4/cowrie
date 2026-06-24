-- Run after 0007. PayPal payout option: a collaborator just needs their PayPal email.
-- Deals using PayPal have rail='paypal' and payout_kind='paypal' (collect-then-payout).

alter table creators add column if not exists paypal_email text;
