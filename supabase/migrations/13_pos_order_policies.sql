-- STRAYMUTANT.DEV — Tamak Bookshop
create policy "Staff and admins can create POS orders"
  on public.orders for insert
  with check (
    staff_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and admins can insert POS order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.staff_id = auth.uid()
    )
  );