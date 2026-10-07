-- STRAYMUTANT.DEV — Tamak Bookshop
-- orders had SELECT and INSERT policies but no UPDATE policy, so staff/
-- admin could view and create orders but not update fulfillment status,
-- discount, or payment details on an existing one. Mirrors the same
-- staff/admin check already used successfully by the existing
-- "Staff and Admins can view all orders" SELECT policy.

drop policy if exists "Staff and Admins can update orders" on public.orders;
create policy "Staff and Admins can update orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );