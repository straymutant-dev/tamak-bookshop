-- STRAYMUTANT.DEV — Tamak Bookshop
-- Lets staff/admin delete a vendor's credit order only while it's still
-- pending approval — rejecting a request that was never fulfilled, so
-- nothing else needs to be undone. The existing orders UPDATE policy
-- (19) already covers approving one.

create policy "Staff and Admins can reject pending credit orders"
  on public.orders for delete
  using (
    payment_status = 'credit_pending'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );