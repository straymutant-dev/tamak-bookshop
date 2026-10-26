-- STRAYMUTANT.DEV — Tamak Bookshop
-- Manual payments, done properly (no payment gateway).
--
-- The shop's bank and Mobile Money details live in a table that admins manage.
-- Customers and vendors are shown those details at checkout, told to use their
-- ORDER NUMBER as the payment reference, and then enter the transaction ID after
-- they have paid. The order stays "awaiting payment confirmation" until staff
-- confirm the money arrived. Stock comes out at confirmation.
--
-- This also extends the vendor confirm / reject functions to ordinary online
-- (customer) orders, and stops staff shipping an unpaid online order.

-- 1. Where to pay -------------------------------------------------------------
create table if not exists public.payment_accounts (
  id uuid default gen_random_uuid() primary key,
  kind text not null check (kind in ('mobile_money', 'bank_transfer')),
  label text not null,
  account_name text not null,
  account_number text not null,
  details text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.payment_accounts enable row level security;

drop policy if exists "Anyone can view active payment accounts" on public.payment_accounts;
create policy "Anyone can view active payment accounts"
  on public.payment_accounts for select
  using (is_active);

drop policy if exists "Admins manage payment accounts" on public.payment_accounts;
create policy "Admins manage payment accounts"
  on public.payment_accounts for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- 2. When the customer said they paid ------------------------------------------
alter table public.orders add column if not exists payment_reported_at timestamptz;

create or replace function public.report_order_payment(p_order_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  if v_ref is null then raise exception 'Enter the payment reference or transaction ID'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id is distinct from auth.uid() then
    raise exception 'Order not found';
  end if;
  if v_order.payment_status <> 'payment_pending' then
    raise exception 'This order is not waiting for payment';
  end if;

  update public.orders
  set payment_reference = v_ref, payment_reported_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.report_order_payment(uuid, text) from public, anon;
grant execute on function public.report_order_payment(uuid, text) to authenticated;

-- 3. Staff confirm payment: vendor AND customer online orders ---------------------
create or replace function public.confirm_vendor_order_payment(
  p_order_id uuid,
  p_method public.pay_method,
  p_reference text,
  p_fulfillment public.fulfillment_type,
  p_cheque_cleared boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
  v_item record;
  v_title text;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if p_method = 'credit' then raise exception 'Choose how the payment was received'; end if;
  if p_method in ('mobile_money', 'bank_transfer', 'cheque') and v_ref is null then
    raise exception 'A payment reference is required';
  end if;
  if p_method = 'cheque' and not coalesce(p_cheque_cleared, false) then
    raise exception 'A cheque can only be confirmed once it has cleared';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type not in ('storefront_vendor', 'storefront_client') then raise exception 'This is not an online order'; end if;
  if v_order.payment_status <> 'payment_pending' then
    raise exception 'This order is not waiting for payment confirmation';
  end if;

  for v_item in
    select oi.book_id, oi.quantity from public.order_items oi
    where oi.order_id = p_order_id order by oi.book_id
  loop
    update public.books
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.book_id and stock_quantity >= v_item.quantity;
    if not found then
      select title into v_title from public.books where id = v_item.book_id;
      raise exception 'Not enough stock for "%"', coalesce(v_title, 'a book in this order');
    end if;
  end loop;

  update public.orders
  set payment_status = 'paid',
      payment_method = p_method,
      payment_reference = v_ref,
      fulfillment_type = p_fulfillment,
      order_status = case
        when p_fulfillment = 'pickup' and order_status = 'in_transit' then 'pending'::public.order_status
        else order_status
      end,
      cheque_number = case when p_method = 'cheque' then v_ref else cheque_number end,
      cheque_cleared = case when p_method = 'cheque' then true else cheque_cleared end
  where id = p_order_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff,
          case when v_order.order_type = 'storefront_vendor' then 'vendor_order_payment_confirmed' else 'online_order_payment_confirmed' end,
          'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'method', p_method,
                             'reference', v_ref,
                             'fulfillment', p_fulfillment));
end;
$$;

-- 4. Reject / cancel a waiting online order ---------------------------------------
create or replace function public.reject_vendor_order(
  p_order_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type not in ('storefront_vendor', 'storefront_client') then raise exception 'This is not an online order'; end if;
  if v_order.payment_status not in ('credit_pending', 'payment_pending') then
    raise exception 'This order has already been reviewed';
  end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_order_rejected', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'status', v_order.payment_status,
                             'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  if v_order.user_id is not null then
    perform public.notify_user(
      v_order.user_id, 'order_rejected', 'Order not accepted',
      v_order.order_number || ' was not accepted'
        || coalesce(': ' || nullif(btrim(coalesce(p_reason, '')), ''), '. Please contact the shop.')
        || ' Any credit reserved for it has been released.',
      case when v_order.order_type = 'storefront_vendor' then '/vendor/dashboard' else '/account/orders' end);
  end if;

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;

-- 5. Notifications (replaces the version from 32) -----------------------------------
create or replace function public.trg_notify_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text;
begin
  -- A customer or vendor told us they have paid (works for guests too).
  if new.payment_status = 'payment_pending'
     and new.payment_reported_at is not null
     and new.payment_reported_at is distinct from old.payment_reported_at
     and new.order_type in ('storefront_vendor', 'storefront_client') then
    perform public.notify_staff(
      'payment_reported', 'Payment reported',
      coalesce(new.contact_name, 'A customer') || ' says they paid ' || public.ghs(new.total_pesewas)
        || ' for ' || new.order_number || coalesce(' · ref ' || new.payment_reference, ''),
      '/admin/orders?tab=vendor');
  end if;

  if new.user_id is null or new.order_type = 'counter_pos' then
    return null;
  end if;

  if new.order_type = 'storefront_vendor' and old.payment_status = 'credit_pending' and new.payment_status = 'credit_approved' then
    perform public.notify_user(
      new.user_id, 'credit_approved', 'Credit order approved',
      new.order_number || ' · ' || public.ghs(new.total_pesewas) || ' is now on your account (' || new.fulfillment_type::text || ')',
      '/vendor/dashboard');
  elsif old.payment_status = 'payment_pending' and new.payment_status = 'paid' then
    perform public.notify_user(
      new.user_id, 'payment_confirmed', 'Payment confirmed',
      new.order_number || ' · payment received (' || new.fulfillment_type::text || ')',
      '/account/orders');
  end if;

  if new.order_status is distinct from old.order_status
     and new.payment_status not in ('credit_pending', 'payment_pending') then
    v_msg := case new.order_status
      when 'in_transit' then 'is on its way to you'
      when 'completed' then case when new.fulfillment_type = 'delivery' then 'has been delivered' else 'has been picked up' end
      else null end;
    if v_msg is not null then
      perform public.notify_user(new.user_id, 'order_status', 'Order update', new.order_number || ' ' || v_msg, '/account/orders');
    end if;
  end if;

  return null;
end;
$$;

-- 6. No shipping an unapproved / unpaid online order (extends the guard from 28) ---
create or replace function public.guard_unapproved_vendor_orders()
returns trigger
language plpgsql
as $$
begin
  if old.order_type in ('storefront_vendor', 'storefront_client')
     and old.payment_status in ('credit_pending', 'payment_pending')
     and new.payment_status = old.payment_status
     and new.order_status is distinct from old.order_status then
    raise exception 'Approve this order or confirm its payment before changing its delivery status';
  end if;
  return new;
end;
$$;