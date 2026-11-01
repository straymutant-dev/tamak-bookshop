-- STRAYMUTANT.DEV — Tamak Bookshop
-- Prevent browser/anon callers from invoking privileged stock mutations directly.
-- Stock decrements may only be performed by trusted server-side code using the
-- service-role client.

create or replace function public.decrement_book_stock(book_id uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if qty is null or qty <= 0 then
    raise exception 'Stock quantity must be a positive integer';
  end if;

  update public.books
  set stock_quantity = stock_quantity - qty
  where id = book_id and stock_quantity >= qty;

  if not found then
    raise exception 'Insufficient stock for book %', book_id;
  end if;
end;
$$;

revoke all on function public.decrement_book_stock(uuid, int) from public;
revoke all on function public.decrement_book_stock(uuid, int) from anon;
revoke all on function public.decrement_book_stock(uuid, int) from authenticated;
grant execute on function public.decrement_book_stock(uuid, int) to service_role;
