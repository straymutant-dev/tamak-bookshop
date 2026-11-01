-- STRAYMUTANT.DEV — Tamak Bookshop
-- Closes direct client mutation paths and moves storefront/POS writes into
-- atomic, database-authoritative functions that derive prices and totals.

create or replace function public.place_storefront_order(
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_method public.pay_method,
  p_fulfillment public.fulfillment_type,
  p_delivery_address text,
  p_delivery_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_el jsonb;
  v_qty integer;
  v_book record;
  v_unit bigint;
  v_line bigint;
  v_subtotal bigint := 0;
  v_order_id uuid;
  v_order_number text;
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
begin
  if v_name is null or v_phone is null then raise exception 'Name and phone are required'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer') then raise exception 'Choose a valid payment method'; end if;
  if p_fulfillment = 'delivery' and nullif(btrim(coalesce(p_delivery_address, '')), '') is null then
    raise exception 'Enter the exact delivery location';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if v_actor is not null then
    select * into v_profile from public.profiles where id = v_actor;
    if v_profile.role = 'vendor' then raise exception 'Wholesale accounts place orders from the wholesale cart'; end if;
    if nullif(btrim(coalesce(v_profile.full_name, '')), '') is not null then v_name := v_profile.full_name; end if;
    if v_profile.phone is not null then v_phone := v_profile.phone; end if;
  end if;

  v_order_number := 'TB-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.orders (
    order_number, order_type, user_id, contact_name, contact_phone, contact_email,
    payment_method, payment_status, fulfillment_type, delivery_address, delivery_notes,
    subtotal_pesewas, total_pesewas
  ) values (
    v_order_number, 'storefront_client', v_actor, v_name, v_phone, v_email,
    p_method, 'payment_pending', p_fulfillment, p_delivery_address, p_delivery_notes,
    0, 0
  ) returning id into v_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select id, title, customer_price_pesewas, stock_quantity into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists'; end if;
    if v_book.stock_quantity < v_qty then raise exception 'Not enough stock for "%"', v_book.title; end if;
    v_unit := v_book.customer_price_pesewas;
    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;

    insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
    values (v_order_id, v_book.id, v_qty, v_unit, v_line);
  end loop;

  update public.orders set subtotal_pesewas = v_subtotal, total_pesewas = v_subtotal where id = v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_pesewas', v_subtotal);
end;
$$;

create or replace function public.place_vendor_credit_order(
  p_phone text,
  p_fulfillment public.fulfillment_type,
  p_delivery_address text,
  p_delivery_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_pending bigint;
  v_el jsonb;
  v_qty integer;
  v_book record;
  v_unit bigint;
  v_line bigint;
  v_subtotal bigint := 0;
  v_order_id uuid;
  v_order_number text;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from public.profiles where id = v_actor for update;
  if v_profile.role is distinct from 'vendor'::public.user_role then raise exception 'Only vendor accounts can place wholesale credit orders'; end if;
  if v_profile.vendor_status is distinct from 'approved'::public.vendor_approval then raise exception 'Your wholesale account is not yet approved for credit orders'; end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is null then raise exception 'Enter a valid contact phone number'; end if;
  if p_fulfillment = 'delivery' and nullif(btrim(coalesce(p_delivery_address, '')), '') is null then raise exception 'Enter the exact delivery location'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;

  v_order_number := 'TB-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.orders (order_number, order_type, user_id, contact_name, contact_phone,
    fulfillment_type, delivery_address, delivery_notes, payment_method, payment_status,
    subtotal_pesewas, total_pesewas)
  values (v_order_number, 'storefront_vendor', v_actor, v_profile.full_name, p_phone,
    p_fulfillment, p_delivery_address, p_delivery_notes, 'credit', 'credit_pending', 0, 0)
  returning id into v_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select id, title, vendor_price_pesewas, customer_price_pesewas, stock_quantity into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists'; end if;
    if v_book.stock_quantity < v_qty then raise exception 'Not enough stock for "%"', v_book.title; end if;
    v_unit := coalesce(v_book.vendor_price_pesewas, v_book.customer_price_pesewas);
    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
    values (v_order_id, v_book.id, v_qty, v_unit, v_line);
  end loop;

  update public.orders set subtotal_pesewas = v_subtotal, total_pesewas = v_subtotal where id = v_order_id;
  select coalesce(sum(total_pesewas), 0) into v_pending from public.orders
  where user_id = v_actor and payment_status = 'credit_pending';
  if v_pending > v_profile.credit_limit_pesewas then
    delete from public.orders where id = v_order_id;
    raise exception 'This order would exceed your available credit';
  end if;
  if coalesce(v_profile.outstanding_balance_pesewas, 0) + v_pending > v_profile.credit_limit_pesewas then
    delete from public.orders where id = v_order_id;
    raise exception 'This order would exceed your available credit';
  end if;
  if v_profile.phone is null then
    update public.profiles set phone = p_phone where id = v_actor;
  end if;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_pesewas', v_subtotal);
end;
$$;

create or replace function public.place_vendor_immediate_order(
  p_phone text,
  p_method public.pay_method,
  p_reference text,
  p_fulfillment public.fulfillment_type,
  p_delivery_address text,
  p_delivery_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_el jsonb;
  v_qty integer;
  v_book record;
  v_unit bigint;
  v_line bigint;
  v_subtotal bigint := 0;
  v_order_id uuid;
  v_order_number text;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from public.profiles where id = v_actor for update;
  if v_profile.role is distinct from 'vendor'::public.user_role then raise exception 'Only vendor accounts can order here'; end if;
  if v_profile.vendor_status is distinct from 'approved'::public.vendor_approval then raise exception 'Your wholesale account is not yet approved'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer', 'cheque') then raise exception 'Choose a valid payment method'; end if;
  if p_method in ('mobile_money', 'bank_transfer', 'cheque') and v_ref is null then raise exception 'A payment reference is required'; end if;
  if p_method = 'cheque' and nullif(btrim(coalesce(p_reference, '')), '') is null then raise exception 'A cheque number is required'; end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is null then raise exception 'Enter a valid contact phone number'; end if;
  if p_fulfillment = 'delivery' and nullif(btrim(coalesce(p_delivery_address, '')), '') is null then raise exception 'Enter the exact delivery location'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;

  v_order_number := 'TB-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.orders (
    order_number, order_type, user_id, contact_name, contact_phone, fulfillment_type,
    delivery_address, delivery_notes, payment_method, payment_reference, payment_status,
    cheque_number, cheque_cleared, subtotal_pesewas, total_pesewas
  ) values (
    v_order_number, 'storefront_vendor', v_actor, v_profile.full_name, p_phone,
    p_fulfillment, p_delivery_address, p_delivery_notes, p_method, v_ref, 'payment_pending',
    case when p_method = 'cheque' then v_ref else null end,
    case when p_method = 'cheque' then false else null end, 0, 0
  ) returning id into v_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select id, title, vendor_price_pesewas, customer_price_pesewas, stock_quantity into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists'; end if;
    if v_book.stock_quantity < v_qty then raise exception 'Not enough stock for "%"', v_book.title; end if;
    v_unit := coalesce(v_book.vendor_price_pesewas, v_book.customer_price_pesewas);
    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
    values (v_order_id, v_book.id, v_qty, v_unit, v_line);
  end loop;

  update public.orders set subtotal_pesewas = v_subtotal, total_pesewas = v_subtotal where id = v_order_id;
  if v_profile.phone is null then update public.profiles set phone = p_phone where id = v_actor; end if;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_pesewas', v_subtotal);
end;
$$;

create or replace function public.create_pos_sale(
  p_customer_name text,
  p_method public.pay_method,
  p_reference text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_el jsonb;
  v_qty integer;
  v_book record;
  v_line bigint;
  v_subtotal bigint := 0;
  v_order_id uuid;
  v_order_number text := 'TB-POS-' || upper(substr(md5(gen_random_uuid()::text), 1, 12));
begin
  if p_method not in ('cash', 'mobile_money', 'bank_transfer') then raise exception 'Choose a valid payment method'; end if;
  if p_method in ('mobile_money', 'bank_transfer') and v_ref is null then raise exception 'A payment reference is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  insert into public.orders (
    order_number, order_type, staff_id, user_id, contact_name, payment_method,
    payment_reference, payment_status, order_status, subtotal_pesewas, total_pesewas
  ) values (
    v_order_number, 'counter_pos', v_staff, null, v_name, p_method,
    v_ref, 'paid', 'completed', 0, 0
  ) returning id into v_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select id, title, customer_price_pesewas, stock_quantity into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this sale no longer exists'; end if;
    if v_book.stock_quantity < v_qty then raise exception 'Not enough stock for "%"', v_book.title; end if;
    update public.books set stock_quantity = stock_quantity - v_qty where id = v_book.id;
    v_line := v_book.customer_price_pesewas * v_qty;
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
    values (v_order_id, v_book.id, v_qty, v_book.customer_price_pesewas, v_line);
  end loop;

  update public.orders set subtotal_pesewas = v_subtotal, total_pesewas = v_subtotal where id = v_order_id;
  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'pos_sale_created', 'orders', v_order_id,
          jsonb_build_object('orderNumber', v_order_number, 'totalPesewas', v_subtotal));
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_pesewas', v_subtotal);
end;
$$;

-- Direct browser inserts are no longer permitted. These checkout and POS RPCs
-- are the only supported mutation paths and enforce the trusted database state.
drop policy if exists "Anyone can create an order for themselves or as guest" on public.orders;
drop policy if exists "Allow insert order items for own order" on public.order_items;
drop policy if exists "Staff and admins can create POS orders" on public.orders;
drop policy if exists "Staff and admins can insert POS order items" on public.order_items;

revoke all on function public.place_storefront_order(text, text, text, public.pay_method, public.fulfillment_type, text, text, jsonb) from public;
revoke all on function public.place_vendor_credit_order(text, public.fulfillment_type, text, text, jsonb) from public;
revoke all on function public.place_vendor_immediate_order(text, public.pay_method, text, public.fulfillment_type, text, text, jsonb) from public;
revoke all on function public.create_pos_sale(text, public.pay_method, text, jsonb) from public;
grant execute on function public.place_storefront_order(text, text, text, public.pay_method, public.fulfillment_type, text, text, jsonb) to anon, authenticated;
grant execute on function public.place_vendor_credit_order(text, public.fulfillment_type, text, text, jsonb) to authenticated;
grant execute on function public.place_vendor_immediate_order(text, public.pay_method, text, public.fulfillment_type, text, text, jsonb) to authenticated;
grant execute on function public.create_pos_sale(text, public.pay_method, text, jsonb) to authenticated;
