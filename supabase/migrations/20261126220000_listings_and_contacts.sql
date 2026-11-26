-- SuiteSpot: listings and their contacts.
-- Landlords are Supabase Auth users. Tenants never need an account and never touch the database directly.
-- Rules mirror src/domain/space-listing.ts (the domain stays the first check; these constraints are the last line).

-- ---------------------------------------------------------------- listings

create table public.listings (
  id                              text primary key check (id ~ '^listing-[a-z0-9]{3,32}$'),
  owner_id                        uuid not null references auth.users (id) on delete cascade,
  is_demo                         boolean not null default false,
  published                       boolean not null default true,

  title                           text not null check (char_length(btrim(title)) between 5 and 120),
  city                            text not null check (city in ('Novi Sad', 'Beograd')),
  district                        text not null check (char_length(btrim(district)) between 1 and 200),
  street                          text not null check (char_length(btrim(street)) between 1 and 200),
  area_m2                         numeric(8, 2) not null check (area_m2 between 5 and 5000),
  floor                           smallint not null check (floor between -2 and 40),

  -- EUR per month (rent, monthly costs) or EUR once (deposit)
  rent_monthly                    numeric(12, 2) not null check (rent_monthly between 1 and 1000000),
  service_charge_monthly          numeric(12, 2) not null check (service_charge_monthly between 0 and 1000000),
  deposit                         numeric(12, 2) not null check (deposit between 0 and 1000000),

  minimum_term_months             smallint not null check (minimum_term_months between 1 and 360),
  early_termination_allowed       boolean not null,
  early_termination_notice_months smallint check (early_termination_notice_months between 0 and 36),
  indexation_kind                 text not null check (indexation_kind in ('none', 'cpi', 'fixed_rate', 'landlord_unilateral')),
  indexation_rate_percent         numeric(5, 2) check (indexation_rate_percent between 0 and 50),
  permitted_uses                  text[] not null check (
                                    cardinality(permitted_uses) between 1 and 4
                                    and permitted_uses <@ array['cafe_food', 'retail', 'office_studio', 'workshop']
                                  ),
  tenant_pays_structural_repairs  boolean not null,

  lease_draft                     text check (char_length(lease_draft) <= 20000),
  description                     text check (char_length(description) <= 4000),
  image_url                       text check (char_length(image_url) <= 2048 and image_url ~ '^https?://'),

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  -- notice months only (and always) when early exit is allowed; a rate only (and always) for a fixed increase
  constraint early_termination_shape check (
    (early_termination_allowed and early_termination_notice_months is not null)
    or (not early_termination_allowed and early_termination_notice_months is null)
  ),
  constraint indexation_shape check (
    (indexation_kind = 'fixed_rate' and indexation_rate_percent is not null)
    or (indexation_kind <> 'fixed_rate' and indexation_rate_percent is null)
  )
);

comment on table public.listings is 'Commercial spaces published on SuiteSpot. is_demo = synthetic seed data, labelled "Demo listing" in the UI.';

create index listings_owner_idx on public.listings (owner_id);
create index listings_published_city_idx on public.listings (city, created_at desc) where published;

-- ---------------------------------------------------------------- listing_contacts

-- Kept apart from listings so a public read of listings can never include a phone or an email.
create table public.listing_contacts (
  listing_id         text primary key references public.listings (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 200),
  phone              text check (char_length(phone) <= 40),
  email              text check (char_length(email) <= 254),
  consent_to_publish boolean not null check (consent_to_publish),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint contact_has_a_channel check (phone is not null or email is not null)
);

comment on table public.listing_contacts is 'How to reach the landlord. No anon access: revealed only by the SuiteSpot server on an explicit "Show contact".';

-- ---------------------------------------------------------------- updated_at

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_touch_updated_at before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger listing_contacts_touch_updated_at before update on public.listing_contacts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security

alter table public.listings enable row level security;
alter table public.listing_contacts enable row level security;

-- listings: anyone may read published listings; a landlord also reads their own unpublished ones.
create policy "listings: read published" on public.listings
  for select to anon, authenticated
  using (published);

create policy "listings: owner reads own" on public.listings
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A landlord creates listings only as themselves, never as demo data.
create policy "listings: owner inserts" on public.listings
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_demo);

-- Only the owner changes or deletes, and demo listings cannot be changed or deleted by anyone through the API.
create policy "listings: owner updates" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) and not is_demo)
  with check (owner_id = (select auth.uid()) and not is_demo);

create policy "listings: owner deletes" on public.listings
  for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_demo);

-- listing_contacts: NO policy for anon at all. A landlord manages only the contact of their own non-demo listing.
-- Revealing a contact to a tenant goes through the SuiteSpot server (service role, server side only).
create policy "contacts: owner reads own" on public.listing_contacts
  for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

create policy "contacts: owner inserts" on public.listing_contacts
  for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()) and not l.is_demo));

create policy "contacts: owner updates" on public.listing_contacts
  for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()) and not l.is_demo))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()) and not l.is_demo));

create policy "contacts: owner deletes" on public.listing_contacts
  for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()) and not l.is_demo));

-- Belt and braces: anon has no table privilege on contacts at all, so even a future careless policy cannot open it.
revoke all on table public.listing_contacts from anon;
