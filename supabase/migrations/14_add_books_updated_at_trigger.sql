-- 14_add_books_updated_at_trigger.sql
-- Automatically bumps books.updated_at whenever a row is edited,
-- so recently-updated books can be surfaced first on the storefront.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_books_updated_at on public.books;

create trigger set_books_updated_at
before update on public.books
for each row
execute function public.set_updated_at();