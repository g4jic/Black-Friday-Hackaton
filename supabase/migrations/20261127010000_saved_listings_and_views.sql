-- SuiteSpot: a user's saved spaces (watchlist) and view counts for listings.

-- ---------------------------------------------------------------- saved_listings

create table public.saved_listings (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id text not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

comment on table public.saved_listings is 'Spaces a signed-in user saved (My spaces). Each user sees and changes only their own rows.';

create index saved_listings_listing_idx on public.saved_listings (listing_id);

alter table public.saved_listings enable row level security;

create policy "saved: user reads own" on public.saved_listings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "saved: user saves for self" on public.saved_listings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "saved: user removes own" on public.saved_listings
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.saved_listings from anon;

-- ---------------------------------------------------------------- listing_views

-- One counter per listing. Only the SuiteSpot server writes it (service role, through record_listing_view);
-- the owner of a listing reads the count of their own listings, nobody else reads anything.
create table public.listing_views (
  listing_id text primary key references public.listings (id) on delete cascade,
  views      bigint not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.listing_views is 'How often a listing page was opened. Written by the server only; the owner reads their own counts.';

alter table public.listing_views enable row level security;

create policy "views: owner reads own" on public.listing_views
  for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

revoke all on table public.listing_views from anon;

-- Counts one view of a published listing. Security invoker: it only works for a caller that may write the table,
-- which is the server's service role (RLS has no insert or update policy for anyone else).
create function public.record_listing_view(p_listing_id text) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.listing_views (listing_id, views)
  select p_listing_id, 1
  where exists (select 1 from public.listings l where l.id = p_listing_id and l.published)
  on conflict (listing_id) do update set views = public.listing_views.views + 1, updated_at = now();
$$;

revoke execute on function public.record_listing_view(text) from public, anon, authenticated;
grant execute on function public.record_listing_view(text) to service_role;
