-- STRAYMUTANT.DEV — Tamak Bookshop
-- Walk-in vendors (no account) can take books on CREDIT at the counter, then
-- bring a cheque later. The cheque is recorded when received, the debt is only
-- cleared once the cheque has cleared, and the team is reminded to tell the
-- customer.
--
-- A walk-in's debt is a counter order with payment_method = 'credit',
-- payment_status = 'credit_approved' and no user account (user_id is null),
-- grouped by phone number. There is NO credit limit for walk-ins: staff decide.

alter table public.orders
  add column if not exists cheque_received_at timestamptz,
  add column if not exists customer_notified_at timestamptz;

-- 1. Counter sale function: now also allows walk-in credit ----------------------
create or replace function public.pos_vendor_sale(
  p_vendor_id uuid,
  p_walkin_name text,
  p_walkin_phone text,
  p_items jsonb,
  p_method public.pay_method,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_vendor public.profiles%rowtype;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_name text;
  v_phone text;
  v_el jsonb;
  v_qty integer;
  v_book record;
  v_line bigint;
  v_lines jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_reserved bigint := 0;
  v_available bigint;
  v_credit boolean := (p_method = 'credit');
  v_status public.pay_status;
  v_order_id uuid;
  v_order_number text;
  v_created timestamptz;
  v_owed_after bigint := null;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty';
  end if;
  if p_method = 'cheque' then
    raise exception 'Cheques are not taken at the counter. Bill the sale to credit; record the cheque later (Repayments for account vendors, Orders > Walk-in credit for walk-ins)';
  end if;
  if p_method in ('mobile_money', 'bank_transfer') and v_ref is null then
    raise exception 'A payment reference is required';
  end if;

  if p_vendor_id is not null then
    select * into v_vendor from public.profiles
    where id = p_vendor_id and role = 'vendor' for update;
    if not found then raise exception 'Vendor account not found'; end if;
    if v_vendor.vendor_status <> 'approved' then raise exception 'This vendor account is not approved'; end if;
    v_name := coalesce(nullif(v_vendor.business_name, ''), v_vendor.full_name);
    v_phone := v_vendor.phone;
  else
    v_name := nullif(btrim(coalesce(p_walkin_name, '')), '');
    v_phone := nullif(btrim(coalesce(p_walkin_phone, '')), '');
    if v_name is null then raise exception 'Enter the vendor''s name'; end if;
    if v_phone is null then raise exception 'Enter a phone number we can reach the vendor on'; end if;
  end if;

  -- Price every line from the database and take the stock out
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select id, title, vendor_price_pesewas, is_active into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found or not v_book.is_active then
      raise exception 'One of the books is no longer available';
    end if;

    update public.books
    set stock_quantity = stock_quantity - v_qty
    where id = v_book.id and stock_quantity >= v_qty;
    if not found then raise exception 'Not enough stock for "%"', v_book.title; end if;

    v_line := v_book.vendor_price_pesewas::bigint * v_qty;
    v_total := v_total + v_line;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'book_id', v_book.id,
      'title', v_book.title,
      'quantity', v_qty,
      'unit_price_pesewas', v_book.vendor_price_pesewas,
      'line_total_pesewas', v_line
    ));
  end loop;

  if v_credit and p_vendor_id is not null then
    select coalesce(sum(total_pesewas), 0) into v_reserved
    from public.orders where user_id = v_vendor.id and payment_status = 'credit_pending';

    v_available := v_vendor.credit_limit_pesewas - v_vendor.outstanding_balance_pesewas - v_reserved;
    if v_total > v_available then
      raise exception 'This sale (GHS %) is more than the vendor''s available credit (GHS %)',
        to_char(v_total / 100.0, 'FM999999990.00'),
        to_char(greatest(v_available, 0) / 100.0, 'FM999999990.00');
    end if;
  end if;

  v_order_number := 'TB-POS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  v_status := case when v_credit then 'credit_approved'::public.pay_status else 'paid'::public.pay_status end;

  insert into public.orders
    (order_number, order_type, staff_id, user_id, contact_name, contact_phone,
     payment_method, payment_reference, payment_status, order_status,
     subtotal_pesewas, total_pesewas)
  values
    (v_order_number, 'counter_pos', v_staff, p_vendor_id, v_name, v_phone,
     p_method, v_ref, v_status, 'completed',
     v_total, v_total)
  returning id, created_at into v_order_id, v_created;

  insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
  select v_order_id,
         (l->>'book_id')::uuid,
         (l->>'quantity')::integer,
         (l->>'unit_price_pesewas')::integer,
         (l->>'line_total_pesewas')::integer
  from jsonb_array_elements(v_lines) l;

  if v_credit and p_vendor_id is not null then
    update public.profiles
    set outstanding_balance_pesewas = outstanding_balance_pesewas + v_total
    where id = v_vendor.id
    returning outstanding_balance_pesewas into v_owed_after;
  elsif p_vendor_id is not null then
    v_owed_after := v_vendor.outstanding_balance_pesewas;
  elsif v_credit then
    -- Walk-in on credit: what this person owes in total, found by phone number.
    select coalesce(sum(total_pesewas), 0) into v_owed_after
    from public.orders
    where order_type = 'counter_pos' and user_id is null
      and payment_method = 'credit' and payment_status = 'credit_approved'
      and contact_phone = v_phone;
  end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'pos_vendor_sale_created', 'orders', v_order_id,
          jsonb_build_object('orderNumber', v_order_number,
                             'totalPesewas', v_total,
                             'method', p_method,
                             'vendorId', p_vendor_id,
                             'customer', v_name,
                             'onCredit', v_credit));

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'created_at', v_created,
    'total_pesewas', v_total,
    'customer_name', v_name,
    'customer_phone', v_phone,
    'on_credit', v_credit,
    'balance_owed_pesewas', v_owed_after,
    'items', v_lines
  );
end;
$$;

-- 2. A walk-in brings a cheque for one or more of their unpaid orders -----------
create or replace function public.receive_walkin_cheque(
  p_order_ids uuid[],
  p_cheque_number text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_no text := nullif(btrim(coalesce(p_cheque_number, '')), '');
  v_count integer;
  v_phones integer;
  v_total bigint;
begin
  if v_no is null then raise exception 'Enter the cheque number'; end if;
  if p_order_ids is null or coalesce(array_length(p_order_ids, 1), 0) = 0 then
    raise exception 'Select the orders this cheque pays for';
  end if;

  perform 1 from public.orders where id = any(p_order_ids) for update;

  select count(*), count(distinct contact_phone), coalesce(sum(total_pesewas), 0)
  into v_count, v_phones, v_total
  from public.orders
  where id = any(p_order_ids)
    and order_type = 'counter_pos' and user_id is null
    and payment_method = 'credit' and payment_status = 'credit_approved'
    and cheque_number is null;

  if v_count <> array_length(p_order_ids, 1) then
    raise exception 'One or more of these orders is not an unpaid walk-in credit order, or already has a cheque';
  end if;
  if v_phones <> 1 then raise exception 'These orders belong to different customers'; end if;

  update public.orders
  set cheque_number = v_no, cheque_cleared = false, cheque_received_at = now()
  where id = any(p_order_ids);

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'walkin_cheque_received', 'orders', p_order_ids[1],
          jsonb_build_object('chequeNumber', v_no, 'orderCount', v_count, 'amountPesewas', v_total));

  return v_total;
end;
$$;

-- 3. The cheque has cleared: the orders become paid -----------------------------
create or replace function public.clear_walkin_cheque(
  p_phone text,
  p_cheque_number text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_no text := nullif(btrim(coalesce(p_cheque_number, '')), '');
  v_count integer;
  v_total bigint;
begin
  if v_no is null then raise exception 'Cheque number missing'; end if;

  perform 1 from public.orders
  where order_type = 'counter_pos' and user_id is null and contact_phone = p_phone
    and cheque_number = v_no and cheque_cleared = false and payment_status = 'credit_approved'
  for update;

  with u as (
    update public.orders
    set payment_status = 'paid',
        payment_method = 'cheque',
        payment_reference = cheque_number,
        cheque_cleared = true
    where order_type = 'counter_pos' and user_id is null and contact_phone = p_phone
      and cheque_number = v_no and cheque_cleared = false and payment_status = 'credit_approved'
    returning total_pesewas
  )
  select count(*), coalesce(sum(total_pesewas), 0) into v_count, v_total from u;

  if v_count = 0 then raise exception 'No cheque waiting to clear with that number for this customer'; end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'walkin_cheque_cleared', 'orders', null,
          jsonb_build_object('chequeNumber', v_no, 'phone', p_phone, 'orderCount', v_count, 'amountPesewas', v_total));

  return v_total;
end;
$$;

-- 4. The cheque bounced: the debt is open again ---------------------------------
create or replace function public.bounce_walkin_cheque(
  p_phone text,
  p_cheque_number text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_no text := nullif(btrim(coalesce(p_cheque_number, '')), '');
  v_count integer;
begin
  if v_no is null then raise exception 'Cheque number missing'; end if;

  with u as (
    update public.orders
    set cheque_number = null, cheque_cleared = null, cheque_received_at = null
    where order_type = 'counter_pos' and user_id is null and contact_phone = p_phone
      and cheque_number = v_no and cheque_cleared = false and payment_status = 'credit_approved'
    returning id
  )
  select count(*) into v_count from u;

  if v_count = 0 then raise exception 'No cheque waiting to clear with that number for this customer'; end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'walkin_cheque_bounced', 'orders', null,
          jsonb_build_object('chequeNumber', v_no, 'phone', p_phone, 'orderCount', v_count,
                             'note', nullif(btrim(coalesce(p_note, '')), '')));
end;
$$;

-- 5. The customer has been told their cheque cleared ----------------------------
create or replace function public.mark_walkin_customer_notified(
  p_phone text,
  p_cheque_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_no text := nullif(btrim(coalesce(p_cheque_number, '')), '');
  v_count integer;
begin
  with u as (
    update public.orders
    set customer_notified_at = now()
    where order_type = 'counter_pos' and user_id is null and contact_phone = p_phone
      and cheque_number = v_no and payment_status = 'paid' and customer_notified_at is null
    returning id
  )
  select count(*) into v_count from u;

  if v_count = 0 then raise exception 'Nothing to mark for this cheque'; end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'walkin_customer_notified', 'orders', null,
          jsonb_build_object('chequeNumber', v_no, 'phone', p_phone));
end;
$$;

-- 6. Grants --------------------------------------------------------------------
revoke all on function public.receive_walkin_cheque(uuid[], text) from public, anon;
revoke all on function public.clear_walkin_cheque(text, text) from public, anon;
revoke all on function public.bounce_walkin_cheque(text, text, text) from public, anon;
revoke all on function public.mark_walkin_customer_notified(text, text) from public, anon;
grant execute on function public.receive_walkin_cheque(uuid[], text) to authenticated;
grant execute on function public.clear_walkin_cheque(text, text) to authenticated;
grant execute on function public.bounce_walkin_cheque(text, text, text) to authenticated;
grant execute on function public.mark_walkin_customer_notified(text, text) to authenticated;