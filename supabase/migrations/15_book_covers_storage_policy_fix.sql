-- STRAYMUTANT.DEV — Tamak Bookshop
-- Re-implements the book-covers storage policies using a SECURITY DEFINER
-- helper (same pattern as decrement_book_stock in 08), instead of an
-- inline subquery against public.profiles. The inline-subquery version
-- (09/10) kept failing in practice — profiles' own RLS interacting with
-- the cross-schema check at evaluation time is the likely cause — so
-- this resolves the role check with elevated privileges instead,
-- consistent with how the only other cross-schema privilege check in
-- this project already works.

drop policy if exists "Admins can upload book covers" on storage.objects;
drop policy if exists "Admins can update book covers" on storage.objects;

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  );
end;
$$;

grant execute on function public.is_admin() to authenticated;

create policy "Admins can upload book covers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'book-covers' and public.is_admin()
  );

create policy "Admins can update book covers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'book-covers' and public.is_admin())
  with check (bucket_id = 'book-covers' and public.is_admin());