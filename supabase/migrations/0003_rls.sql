-- Run after 0002. Locks down direct table access.
--
-- WHY THIS MATTERS: the anon key ships in the browser bundle. Without RLS, anyone
-- could use it to read/write these tables directly through Supabase's REST API.
-- Enabling RLS denies that by default. The app keeps working because all server
-- routes use the SERVICE-ROLE key, which bypasses RLS. The policies below additionally
-- let a signed-in owner read their OWN data (useful if you later add client-side reads).

alter table deals        enable row level security;
alter table deal_splits  enable row level security;
alter table creators     enable row level security;
alter table transactions enable row level security;

-- Owners can read their own deals.
create policy "owner reads own deals" on deals
  for select to authenticated
  using ((auth.jwt() ->> 'email') = created_by_email);

-- Owners can read the splits on their own deals.
create policy "owner reads own splits" on deal_splits
  for select to authenticated
  using (exists (
    select 1 from deals d
    where d.id = deal_splits.deal_id
      and d.created_by_email = (auth.jwt() ->> 'email')
  ));

-- Owners can read transactions on their own deals.
create policy "owner reads own transactions" on transactions
  for select to authenticated
  using (exists (
    select 1 from deals d
    where d.id = transactions.deal_id
      and d.created_by_email = (auth.jwt() ->> 'email')
  ));

-- creators: no public policies on purpose. Onboarding and accept are token-based and
-- run server-side via the service role, so collaborators never need direct table access.
