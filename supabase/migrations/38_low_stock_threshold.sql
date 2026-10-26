-- STRAYMUTANT.DEV — Tamak Bookshop
alter table public.books
  add column if not exists low_stock_threshold integer not null default 5
  check (low_stock_threshold >= 0);

-- A plain query can't compare two columns, so the dashboard count uses this.
create or replace function public.low_stock_count()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from public.books
  where is_active and stock_quantity <= low_stock_threshold;
$$;

grant execute on function public.low_stock_count() to authenticated;