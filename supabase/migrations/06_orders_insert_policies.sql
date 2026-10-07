-- STRAYMUTANT.DEV — Tamak Bookshop
-- orders and order_items had SELECT policies but no INSERT policy,
-- meaning checkout inserts were being silently denied by RLS.
create policy "Anyone can create an order for themselves or as guest"
  on public.orders for insert
  with check (
    (auth.uid() is null and user_id is null)
    or auth.uid() = user_id
  );

create policy "Allow insert order items for own order"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and (
        (auth.uid() is null and orders.user_id is null)
        or auth.uid() = orders.user_id
      )
    )
  );