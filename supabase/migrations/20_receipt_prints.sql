-- STRAYMUTANT.DEV — Tamak Bookshop
-- Logs every time a receipt is printed or reprinted — who, and when.
-- Not a guarantee of a successful physical print, just a record of
-- the print action being triggered.

create table public.receipt_prints (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  staff_id uuid references public.profiles(id) on delete set null,
  printed_at timestamptz default now() not null
);

alter table public.receipt_prints enable row level security;

create policy "Staff and Admins can view receipt prints"
  on public.receipt_prints for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and Admins can log receipt prints"
  on public.receipt_prints for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );