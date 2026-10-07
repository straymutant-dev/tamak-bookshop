-- STRAYMUTANT.DEV — Tamak Bookshop
-- Fix: approving a vendor order as PICKUP failed with
--   violates check constraint "order_status_fulfillment_check"
-- when the order had already been marked "in transit" (which requires delivery).
--
-- 1. Approve / confirm-payment now reset an in-transit order to pending when
--    pickup is chosen.
-- 2. A guard stops staff changing the delivery status of a vendor order that
--    hasn't been approved (or whose payment isn't confirmed) yet, so an
--    unapproved order can't be shipped by mistake.
-- CREATE OR REPLACE keeps the existing grants on both functions.

create or replace function public.approve_vendor_credit_order(
  p_order_id uuid,
  p_fulfillment public.fulfillment_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
  v_vendor public.profiles%rowtype;
  v_item record;
  v_title text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'storefront_vendor' then raise exception 'This is not a vendor order'; end if;
  if v_order.payment_status <> 'credit_pending' then raise exception 'This order has already been reviewed'; end if;
  if v_order.user_id is null then raise exception 'This order has no vendor attached'; end if;

  select * into v_vendor from public.profiles
  where id = v_order.user_id and role = 'vendor' for update;
  if not found then raise exception 'Vendor account not found'; end if;
  if v_vendor.vendor_status <> 'approved' then
    raise exception 'This vendor account is not approved';
  end if;
  if v_vendor.outstanding_balance_pesewas + v_order.total_pesewas > v_vendor.credit_limit_pesewas then
    raise exception 'Approving this order would put the vendor over their credit limit';
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

  update public.profiles
  set outstanding_balance_pesewas = outstanding_balance_pesewas + v_order.total_pesewas
  where id = v_vendor.id;

  -- An order that was already marked "in transit" can't become a pickup
  -- (order_status_fulfillment_check), so a pickup resets it to pending.
  update public.orders
  set payment_status = 'credit_approved',
      fulfillment_type = p_fulfillment,
      order_status = case
        when p_fulfillment = 'pickup' and order_status = 'in_transit' then 'pending'::public.order_status
        else order_status
      end
  where id = p_order_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_order_approved', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'fulfillment', p_fulfillment));
end;
$$;

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
  if v_order.order_type <> 'storefront_vendor' then raise exception 'This is not a vendor order'; end if;
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
  values (v_staff, 'vendor_order_payment_confirmed', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'method', p_method,
                             'reference', v_ref,
                             'fulfillment', p_fulfillment));
end;
$$;

create or replace function public.guard_unapproved_vendor_orders()
returns trigger
language plpgsql
as $$
begin
  if old.order_type = 'storefront_vendor'
     and old.payment_status in ('credit_pending', 'payment_pending')
     and new.payment_status = old.payment_status
     and new.order_status is distinct from old.order_status then
    raise exception 'Approve this order or confirm its payment before changing its delivery status';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_unapproved_vendor_orders on public.orders;
create trigger guard_unapproved_vendor_orders
  before update on public.orders
  for each row execute function public.guard_unapproved_vendor_orders();