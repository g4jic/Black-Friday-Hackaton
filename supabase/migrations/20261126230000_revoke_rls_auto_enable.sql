-- public.rls_auto_enable() came with the project (not from our migrations). It is SECURITY DEFINER and was callable
-- through /rest/v1/rpc by anon and signed-in users. Clients never need it, so only the owner and service_role keep it.
-- PUBLIC is revoked too: anon and authenticated inherit from PUBLIC, so revoking them alone would change nothing.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
