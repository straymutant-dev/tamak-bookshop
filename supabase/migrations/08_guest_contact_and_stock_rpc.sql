-- STRAYMUTANT.DEV — Tamak Bookshop
-- Guest checkout needs somewhere to store who placed the order.
alter table public.orders
  add column if not exists contact_name text,
  add column if not exists contact_phone text;

-- Customers have no RLS permission to touch books.stock_quantity
-- directly (only "Allow admins full access to books" exists). This
-- function runs with elevated privileges for this one narrow purpose,
-- and the `where stock_quantity >= qty` guard makes the deduction
-- atomic — it can't be tricked into going negative even under a race
-- between two people checking out the same low-stock book at once.
create or replace function public.decrement_book_stock(book_id uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.books
  set stock_quantity = stock_quantity - qty
  where id = book_id and stock_quantity >= qty;

  if not found then
    raise exception 'Insufficient stock for book %', book_id;
  end if;
end;
$$;

grant execute on function public.decrement_book_stock(uuid, int) to anon, authenticated;