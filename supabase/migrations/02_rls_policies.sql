-- STRAYMUTANT.DEV — Initial Row Level Security Policies (Safe Re-run)

-- 1. BOOKS: Anyone can view active books; only Admins can create/edit/delete
alter table public.books enable row level security;

drop policy if exists "Allow public read access to active books" on public.books;
create policy "Allow public read access to active books"
  on public.books for select
  using (is_active = true);

drop policy if exists "Allow admins full access to books" on public.books;
create policy "Allow admins full access to books"
  on public.books for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 2. PROFILES: Users read/edit their own; Staff and Admin can view all
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Staff and Admins can view all profiles" on public.profiles;
create policy "Staff and Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

-- 3. ORDERS: Users view their own orders; Staff and Admins view all
alter table public.orders enable row level security;

drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Staff and Admins can view all orders" on public.orders;
create policy "Staff and Admins can view all orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

-- 4. ORDER ITEMS: Access inherits from parent order visibility
alter table public.order_items enable row level security;

drop policy if exists "Allow view order items if order is visible" on public.order_items;
create policy "Allow view order items if order is visible"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and (orders.user_id = auth.uid() or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
      ))
    )
  );