-- Run after 0005. Lets the platform fee be capped at a maximum amount, so a percentage
-- fee doesn't become excessive on large deals (e.g. 7% but never more than ₦20,000).
-- Stored in minor units (kobo/pence). NULL = no cap.

alter table deals add column if not exists platform_fee_cap_minor int;
