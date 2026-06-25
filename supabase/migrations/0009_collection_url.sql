-- Run after 0008. Persist the brand-facing payment link so it survives page reloads
-- (previously it only lived in memory after locking and was lost on refresh).

alter table deals add column if not exists collection_url text;
