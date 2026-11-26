-- RLS checks for saved_listings and listing_views. Rolled back; any broken rule raises an exception.
begin;

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('saved_listings', 'listing_views') and not c.relrowsecurity) then
    raise exception 'RLS is off on saved_listings or listing_views';
  end if;
end $$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'rls-owner2@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'rls-saver@example.com', 'authenticated', 'authenticated');
insert into public.listings (id, owner_id, is_demo, published, title, city, district, street, area_m2, floor, rent_monthly,
  service_charge_monthly, deposit, minimum_term_months, early_termination_allowed, indexation_kind, permitted_uses,
  tenant_pays_structural_repairs) values
  ('listing-rlsview', '00000000-0000-4000-8000-0000000000c1', false, true, 'Viewed test listing', 'Beograd', 'Vracar', 'Test', 40, 0, 900, 60, 1800, 24, false, 'cpi', array['office_studio'], false);

-- The server (service role) counts views; the function works only for it.
select public.record_listing_view('listing-rlsview');
select public.record_listing_view('listing-rlsview');
do $$ begin
  if (select views from public.listing_views where listing_id = 'listing-rlsview') <> 2 then raise exception 'views were not counted'; end if;
end $$;

-- anon: no access to either table, and cannot count views.
set local role anon;
do $$ begin
  begin perform 1 from public.saved_listings; raise exception 'anon can read saved_listings'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.listing_views; raise exception 'anon can read listing_views'; exception when insufficient_privilege then null; end;
  begin perform public.record_listing_view('listing-rlsview'); raise exception 'anon can count views'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The saver: saves for self only, sees only own saves, cannot see the owner's view counts or change them.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d2", "role": "authenticated"}';
do $$ begin
  insert into public.saved_listings (listing_id) values ('listing-rlsview');
  if (select count(*) from public.saved_listings) <> 1 then raise exception 'the saver does not see own save'; end if;
  begin
    insert into public.saved_listings (user_id, listing_id) values ('00000000-0000-4000-8000-0000000000c1', 'listing-rlsview');
    raise exception 'a user saved for someone else';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.listing_views) then raise exception 'a non-owner sees view counts'; end if;
  update public.listing_views set views = 999;
  begin perform public.record_listing_view('listing-rlsview'); raise exception 'a signed-in user can count views'; exception when insufficient_privilege then null; end;
end $$;

-- The owner: sees the count of their own listing, does not see the saver's saves.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
do $$ begin
  if (select views from public.listing_views where listing_id = 'listing-rlsview') <> 2 then raise exception 'the owner does not see the right count'; end if;
  if exists (select 1 from public.saved_listings) then raise exception 'the owner sees another user''s saves'; end if;
end $$;
reset role;

rollback;
