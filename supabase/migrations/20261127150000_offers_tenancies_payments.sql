-- SuiteSpot deals: offers on listings, tenancies (accepted offers) and rent payments.
-- Writes go through the SuiteSpot server only (service role), after the domain rules in src/domain/deal.ts.
-- Row Level Security lets a signed-in user read only the rows they are a party to; nobody else reads or writes.
-- No real money: a payment is a Stripe TEST payment (reference cs_test_...) or a simulated one (simulated:...).

-- ---------------------------------------------------------------- offers

create table public.offers (
  id              text primary key,
  listing_id      text not null references public.listings (id) on delete cascade,
  listing_title   text not null,
  is_demo_listing boolean not null,
  tenant_id       uuid not null references auth.users (id) on delete cascade,
  tenant_name     text not null,
  landlord_id     uuid not null references auth.users (id) on delete cascade,
  rent_monthly    integer not null check (rent_monthly > 0),
  currency        text not null check (currency = 'EUR'),
  start_date      date not null,
  term_months     integer not null check (term_months between 1 and 120),
  message         text not null default '' check (char_length(message) <= 1000),
  status          text not null check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at      timestamptz not null,
  decided_at      timestamptz,
  decided_by      text,
  check (tenant_id <> landlord_id)
);

comment on table public.offers is 'Offers a tenant made on a listing. Written by the server; the tenant and the landlord read their own.';

create index offers_listing_idx on public.offers (listing_id);
create index offers_tenant_idx on public.offers (tenant_id);
create index offers_landlord_idx on public.offers (landlord_id);
-- one open offer per tenant and listing (also checked by the domain)
create unique index offers_one_open_idx on public.offers (listing_id, tenant_id) where status = 'pending';

alter table public.offers enable row level security;

create policy "offers: parties read" on public.offers
  for select to authenticated
  using (tenant_id = (select auth.uid()) or landlord_id = (select auth.uid()));

revoke all on table public.offers from anon, authenticated;
grant select on table public.offers to authenticated;

-- ---------------------------------------------------------------- tenancies

create table public.tenancies (
  id              text primary key,
  offer_id        text not null unique references public.offers (id) on delete cascade,
  listing_id      text not null references public.listings (id) on delete cascade,
  listing_title   text not null,
  is_demo_listing boolean not null,
  tenant_id       uuid not null references auth.users (id) on delete cascade,
  tenant_name     text not null,
  landlord_id     uuid not null references auth.users (id) on delete cascade,
  rent_monthly    integer not null check (rent_monthly > 0),
  currency        text not null check (currency = 'EUR'),
  start_date      date not null,
  term_months     integer not null check (term_months between 1 and 120),
  created_at      timestamptz not null
);

comment on table public.tenancies is 'Accepted offers. Written by the server; the tenant and the landlord read their own.';

create index tenancies_listing_idx on public.tenancies (listing_id);
create index tenancies_tenant_idx on public.tenancies (tenant_id);
create index tenancies_landlord_idx on public.tenancies (landlord_id);

alter table public.tenancies enable row level security;

create policy "tenancies: parties read" on public.tenancies
  for select to authenticated
  using (tenant_id = (select auth.uid()) or landlord_id = (select auth.uid()));

revoke all on table public.tenancies from anon, authenticated;
grant select on table public.tenancies to authenticated;

-- ---------------------------------------------------------------- rent_payments

create table public.rent_payments (
  id          text primary key,
  tenancy_id  text not null references public.tenancies (id) on delete cascade,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),
  amount      integer not null check (amount > 0),
  currency    text not null check (currency = 'EUR'),
  method      text not null check (method in ('stripe_test', 'simulated')),
  reference   text not null unique check (reference like 'cs_test_%' or reference like 'simulated:%'),
  paid_at     timestamptz not null,
  unique (tenancy_id, period)
);

comment on table public.rent_payments is 'Rent payments: Stripe test mode or simulated, never real money. Written by the server; both parties read.';

alter table public.rent_payments enable row level security;

create policy "payments: parties read" on public.rent_payments
  for select to authenticated
  using (exists (
    select 1 from public.tenancies t
    where t.id = tenancy_id and (t.tenant_id = (select auth.uid()) or t.landlord_id = (select auth.uid()))
  ));

revoke all on table public.rent_payments from anon, authenticated;
grant select on table public.rent_payments to authenticated;
