-- STRAYMUTANT.DEV — Tamak Bookshop Production Schema

-- Custom Enums
create type user_role as enum ('client', 'vendor', 'staff', 'admin');
create type vendor_approval as enum ('not_applicable', 'pending', 'approved', 'rejected');
create type class_grade_level as enum ('KG', 'Primary 1-3', 'Primary 4-6', 'JHS 1-3', 'SHS 1-3', 'Tertiary', 'General');
create type order_kind as enum ('storefront_client', 'storefront_vendor', 'counter_pos');
create type pay_method as enum ('cash', 'mobile_money', 'bank_transfer', 'credit');
create type pay_status as enum ('paid', 'credit_pending', 'credit_approved', 'partially_paid');
create type return_condition as enum ('resellable', 'damaged');

-- 1. Profiles & Authorization
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text,
  business_name text,
  role user_role default 'client' not null,
  vendor_status vendor_approval default 'not_applicable' not null,
  credit_limit_pesewas bigint default 0 not null check (credit_limit_pesewas >= 0),
  outstanding_balance_pesewas bigint default 0 not null check (outstanding_balance_pesewas >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Books & Catalog
create table public.books (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  author text not null,
  category text not null,
  class_level class_grade_level default 'General' not null,
  academic_year text default '2025/26' not null,
  cover_image_url text,
  buying_cost_pesewas bigint not null check (buying_cost_pesewas >= 0),
  customer_price_pesewas bigint not null check (customer_price_pesewas >= 0),
  vendor_price_pesewas bigint not null check (vendor_price_pesewas >= 0),
  stock_quantity int default 0 not null check (stock_quantity >= 0),
  damaged_quantity int default 0 not null check (damaged_quantity >= 0),
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_books_search on public.books (title, author, category, class_level) where is_active = true;

-- 3. Orders & Order Line Items
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  order_number text unique not null,
  client_operation_id uuid unique,
  user_id uuid references public.profiles(id) on delete set null,
  staff_id uuid references public.profiles(id) on delete set null,
  order_type order_kind not null,
  payment_method pay_method not null,
  payment_status pay_status default 'paid' not null,
  payment_reference text,
  subtotal_pesewas bigint not null check (subtotal_pesewas >= 0),
  total_pesewas bigint not null check (total_pesewas >= 0),
  created_at timestamptz default now() not null
);

create index idx_orders_lookup on public.orders (order_number);
create index idx_orders_staff on public.orders (staff_id, created_at);

create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete restrict not null,
  quantity int not null check (quantity > 0),
  unit_price_pesewas bigint not null check (unit_price_pesewas >= 0),
  line_total_pesewas bigint not null check (line_total_pesewas >= 0)
);

-- 4. Vendor Credit Debt Repayments
create table public.credit_repayments (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references public.profiles(id) on delete restrict not null,
  received_by_staff_id uuid references public.profiles(id) on delete restrict not null,
  amount_pesewas bigint not null check (amount_pesewas > 0),
  payment_method pay_method not null check (payment_method != 'credit'),
  payment_reference text,
  notes text,
  created_at timestamptz default now() not null
);

-- 5. Customer Returns & Damaged Stock
create table public.order_returns (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete restrict not null,
  book_id uuid references public.books(id) on delete restrict not null,
  staff_id uuid references public.profiles(id) on delete restrict not null,
  quantity int not null check (quantity > 0),
  condition return_condition not null,
  refund_pesewas bigint default 0 not null check (refund_pesewas >= 0),
  notes text,
  created_at timestamptz default now() not null
);

-- 6. Cashier Shift Reconciliations
create table public.cashier_shifts (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.profiles(id) on delete restrict not null,
  opened_at timestamptz default now() not null,
  closed_at timestamptz,
  opening_cash_pesewas bigint default 0 not null check (opening_cash_pesewas >= 0),
  actual_closing_cash_pesewas bigint check (actual_closing_cash_pesewas >= 0),
  expected_cash_pesewas bigint default 0 check (expected_cash_pesewas >= 0),
  expected_momo_pesewas bigint default 0 check (expected_momo_pesewas >= 0),
  expected_credit_pesewas bigint default 0 check (expected_credit_pesewas >= 0),
  shift_discrepancy_pesewas bigint default 0,
  notes text
);

-- 7. Audit Logging
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details_json jsonb,
  created_at timestamptz default now() not null
);

-- 8. Auto Profile Sync Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, vendor_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'),
    case 
      when (new.raw_user_meta_data->>'role') = 'vendor' then 'pending'::vendor_approval
      else 'not_applicable'::vendor_approval
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();