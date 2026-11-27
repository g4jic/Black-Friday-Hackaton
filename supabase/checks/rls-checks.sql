-- SuiteSpot RLS checks. Run after the migration (and after the seed). Read only: everything runs inside a
-- transaction that is rolled back. Each check raises an exception when the rule is broken, so a clean run means
-- every rule holds.
begin;

-- 1. RLS is on for both tables.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('listings', 'listing_contacts') and not c.relrowsecurity) then
    raise exception 'RLS is off on listings or listing_contacts';
  end if;
end $$;

-- Test data: two users, a published, an unpublished and a demo listing, each with a contact.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'rls-owner@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'rls-other@example.com', 'authenticated', 'authenticated');
insert into public.listings (id, owner_id, is_demo, published, title, city, district, street, area_m2, floor, rent_monthly,
  service_charge_monthly, deposit, minimum_term_months, early_termination_allowed, early_termination_notice_months,
  indexation_kind, permitted_uses, tenant_pays_structural_repairs) values
  ('listing-rlspub', '00000000-0000-4000-8000-0000000000a1', false, true,  'Published test listing', 'Novi Sad', 'Liman 1', 'Test', 60, 0, 700, 50, 1400, 36, true, 3, 'cpi', array['retail'], false),
  ('listing-rlsdraft', '00000000-0000-4000-8000-0000000000a1', false, false, 'Unpublished test listing', 'Novi Sad', 'Liman 1', 'Test', 60, 0, 700, 50, 1400, 36, true, 3, 'cpi', array['retail'], false),
  ('listing-rlsdemo', '00000000-0000-4000-8000-0000000000a1', true,  true,  'Demo test listing', 'Novi Sad', 'Liman 1', 'Test', 60, 0, 700, 50, 1400, 36, true, 3, 'cpi', array['retail'], false);
insert into public.listing_contacts (listing_id, name, phone, consent_to_publish) values
  ('listing-rlspub', 'Test', '+381 64 000 00 00', true), ('listing-rlsdemo', 'Test', '+381 64 000 00 01', true);

-- 2. anon sees published listings (also demo ones) and nothing unpublished; anon cannot read contacts at all.
set local role anon;
do $$
begin
  if not exists (select 1 from public.listings where id = 'listing-rlspub') then raise exception 'anon cannot see a published listing'; end if;
  if not exists (select 1 from public.listings where id = 'listing-rlsdemo') then raise exception 'anon cannot see a published demo listing'; end if;
  if exists (select 1 from public.listings where id = 'listing-rlsdraft') then raise exception 'anon sees an unpublished listing'; end if;
  begin
    perform 1 from public.listing_contacts;
    raise exception 'anon can read listing_contacts';
  exception when insufficient_privilege then null; -- expected: no table privilege
  end;
end $$;
reset role;

-- 3. Another logged-in user sees every published listing, not the owner's unpublished one, and no contacts.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}';
do $$
begin
  if (select count(*) from public.listings where id in ('listing-rlspub', 'listing-rlsdemo')) <> 2 then raise exception 'authenticated does not see all published listings'; end if;
  if exists (select 1 from public.listings where id = 'listing-rlsdraft') then raise exception 'authenticated sees someone else''s unpublished listing'; end if;
  if exists (select 1 from public.listing_contacts) then raise exception 'authenticated reads someone else''s contact'; end if;
  update public.listings set title = 'Hijacked title' where id = 'listing-rlspub';
  if (select title from public.listings where id = 'listing-rlspub') <> 'Published test listing' then raise exception 'a non-owner changed a listing'; end if;
end $$;

-- 4. The owner sees their own unpublished listing, but cannot change or delete a demo listing, nor create one.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
do $$
begin
  if not exists (select 1 from public.listings where id = 'listing-rlsdraft') then raise exception 'the owner cannot see their unpublished listing'; end if;
  update public.listings set title = 'Changed demo title' where id = 'listing-rlsdemo';
  delete from public.listings where id = 'listing-rlsdemo';
  update public.listing_contacts set phone = '+381 64 999 99 99' where listing_id = 'listing-rlsdemo';
  if (select title from public.listings where id = 'listing-rlsdemo') <> 'Demo test listing' then raise exception 'a demo listing was changed'; end if;
  if not exists (select 1 from public.listings where id = 'listing-rlsdemo') then raise exception 'a demo listing was deleted'; end if;
  if (select phone from public.listing_contacts where listing_id = 'listing-rlsdemo') <> '+381 64 000 00 01' then raise exception 'a demo contact was changed'; end if;
  update public.listings set is_demo = false where id = 'listing-rlsdemo';
  if not (select is_demo from public.listings where id = 'listing-rlsdemo') then raise exception 'is_demo was switched off'; end if;
  begin
    insert into public.listings (id, owner_id, is_demo, title, city, district, street, area_m2, floor, rent_monthly,
      service_charge_monthly, deposit, minimum_term_months, early_termination_allowed, indexation_kind, permitted_uses,
      tenant_pays_structural_repairs)
    values ('listing-rlsfake', '00000000-0000-4000-8000-0000000000a1', true, 'Fake demo listing', 'Novi Sad', 'Liman 1', 'Test', 60, 0, 700, 50, 1400, 36, false, 'none', array['retail'], false);
    raise exception 'a user created a demo listing';
  exception when insufficient_privilege then null; -- expected: RLS rejects it
  end;
end $$;
reset role;

-- 5. Deals (offers, tenancies, rent_payments): RLS on; written only by the server (service role, as here);
--    each party reads its own rows; a third user and anon read nothing; nobody signed in can write.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c3', 'rls-third@example.com', 'authenticated', 'authenticated');
insert into public.offers (id, listing_id, listing_title, is_demo_listing, tenant_id, tenant_name, landlord_id, rent_monthly,
  currency, start_date, term_months, message, status, created_at) values
  ('offer-rls', 'listing-rlspub', 'Published test listing', false, '00000000-0000-4000-8000-0000000000b2', 'Tenant',
   '00000000-0000-4000-8000-0000000000a1', 650, 'EUR', '2027-01-01', 12, '', 'accepted', now());
insert into public.tenancies (id, offer_id, listing_id, listing_title, is_demo_listing, tenant_id, tenant_name, landlord_id,
  rent_monthly, currency, start_date, term_months, created_at) values
  ('tenancy-rls', 'offer-rls', 'listing-rlspub', 'Published test listing', false, '00000000-0000-4000-8000-0000000000b2',
   'Tenant', '00000000-0000-4000-8000-0000000000a1', 650, 'EUR', '2027-01-01', 12, now());
insert into public.rent_payments (id, tenancy_id, period, amount, currency, method, reference, paid_at) values
  ('payment-rls', 'tenancy-rls', '2027-01', 650, 'EUR', 'simulated', 'simulated:rls', now());
do $
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('offers', 'tenancies', 'rent_payments') and not c.relrowsecurity) then
    raise exception 'RLS is off on a deals table';
  end if;
  begin
    insert into public.rent_payments (id, tenancy_id, period, amount, currency, method, reference, paid_at)
    values ('payment-live', 'tenancy-rls', '2027-02', 650, 'EUR', 'stripe_test', 'cs_live_x', now());
    raise exception 'a live Stripe reference was accepted';
  exception when check_violation then null; -- expected: test or simulated references only
  end;
end $;

set local role authenticated;
-- the tenant and the landlord each read the offer, the tenancy and the payment
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}';
do $
begin
  if (select count(*) from public.offers where id = 'offer-rls') <> 1 then raise exception 'the tenant cannot read their offer'; end if;
  if (select count(*) from public.tenancies where id = 'tenancy-rls') <> 1 then raise exception 'the tenant cannot read their tenancy'; end if;
  if (select count(*) from public.rent_payments where id = 'payment-rls') <> 1 then raise exception 'the tenant cannot read their payment'; end if;
  begin
    insert into public.rent_payments (id, tenancy_id, period, amount, currency, method, reference, paid_at)
    values ('payment-fake', 'tenancy-rls', '2027-03', 1, 'EUR', 'simulated', 'simulated:fake', now());
    raise exception 'a signed-in user recorded a payment directly';
  exception when insufficient_privilege then null; -- expected: only the server writes
  end;
  begin
    update public.offers set status = 'accepted' where id = 'offer-rls';
    raise exception 'a signed-in user changed an offer directly';
  exception when insufficient_privilege then null;
  end;
end $;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
do $
begin
  if (select count(*) from public.tenancies where id = 'tenancy-rls') <> 1 then raise exception 'the landlord cannot read the tenancy'; end if;
  if (select count(*) from public.rent_payments where id = 'payment-rls') <> 1 then raise exception 'the landlord cannot read the payment'; end if;
end $;
-- a third user reads nothing
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c3", "role": "authenticated"}';
do $
begin
  if exists (select 1 from public.offers) or exists (select 1 from public.tenancies) or exists (select 1 from public.rent_payments)
    then raise exception 'a third user reads someone else''s deal'; end if;
end $;
reset role;
set local role anon;
do $
begin
  begin
    perform 1 from public.offers;
    raise exception 'anon can read offers';
  exception when insufficient_privilege then null;
  end;
end $;
reset role;

select 'all RLS checks passed' as result;
rollback;
