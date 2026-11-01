-- STRAYMUTANT.DEV — Tamak Bookshop
-- Security follow-up: serialize offline POS retries by operation UUID and
-- lock the account row during self-deletion.

-- STRAYMUTANT.DEV — Tamak Bookshop
-- Offline POS: one atomic, idempotent function that records a counter sale made on a till,
-- possibly while it was offline.
--  * Idempotent: the till gives every sale a client UUID (orders.client_operation_id is UNIQUE),
--    so sending the same sale twice never creates a second order.
--  * Atomic: order, items, stock and audit log all succeed together or not at all.
--  * The customer already paid the price on the printed receipt, so the sale is recorded at the
--    quoted price. A difference from today's database price is written to the audit log.
--  * If another sale took the last copies while this till was offline, the sale is still recorded
--    (the books already left the shop). Stock is set to 0 and the shortfall goes to the audit log.
--  * The sale keeps the time it was really made (not the time it synced), so daily totals are right.
create or replace function public.sync_pos_sale(
  p_client_uuid uuid,
  p_order_number text,
  p_sold_at timestamptz,
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
  v_quoted bigint;
  v_book record;
  v_take integer;
  v_line bigint;
  v_lines jsonb := '[]'::jsonb;
  v_short jsonb := '[]'::jsonb;
  v_price jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_order_id uuid;
  v_order_number text;
  v_created timestamptz;
  v_when timestamptz;
begin
  if p_client_uuid is null then raise exception 'Missing sale id'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_uuid::text, 0));
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The sale has no items';
  end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer') then
    raise exception 'Choose cash, mobile money or bank transfer';
  end if;

  -- Already recorded? Then this is a retry: hand back the existing order.
  select id, order_number, created_at into v_order_id, v_order_number, v_created
  from public.orders where client_operation_id = p_client_uuid;
  if found then
    return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
                              'created_at', v_created, 'already_synced', true,
                              'shortfalls', '[]'::jsonb, 'price_changes', '[]'::jsonb);
  end if;

  -- Keep the time of the sale unless it is clearly wrong (in the future, or over 30 days old).
  v_when := case
    when p_sold_at is null or p_sold_at > now() + interval '5 minutes'
      or p_sold_at < now() - interval '30 days' then now()
    else p_sold_at end;

  v_order_number := case
    when p_order_number ~ '^TB-POS-[A-Z0-9]{6,16}-[A-Z0-9]{4}$' then p_order_number
    else 'TB-POS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)) end;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    v_quoted := (v_el->>'unitPricePesewas')::bigint;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    if v_quoted is null or v_quoted < 0 then raise exception 'Invalid price'; end if;

    select id, title, customer_price_pesewas, stock_quantity into v_book
    from public.books where id = (v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this sale no longer exists'; end if;

    v_take := least(v_book.stock_quantity, v_qty);
    update public.books set stock_quantity = stock_quantity - v_take where id = v_book.id;
    if v_take < v_qty then
      v_short := v_short || jsonb_build_array(jsonb_build_object(
        'title', v_book.title, 'sold', v_qty, 'inStock', v_take, 'short', v_qty - v_take));
    end if;
    if v_quoted <> v_book.customer_price_pesewas then
      v_price := v_price || jsonb_build_array(jsonb_build_object(
        'title', v_book.title, 'quoted', v_quoted, 'current', v_book.customer_price_pesewas));
    end if;

    v_line := v_quoted * v_qty;
    v_total := v_total + v_line;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'book_id', v_book.id, 'title', v_book.title, 'quantity', v_qty,
      'unit_price_pesewas', v_quoted, 'line_total_pesewas', v_line));
  end loop;

  begin
    insert into public.orders
      (order_number, order_type, staff_id, user_id, contact_name, payment_method, payment_reference,
       payment_status, order_status, subtotal_pesewas, total_pesewas, client_operation_id, created_at)
    values
      (v_order_number, 'counter_pos', v_staff, null, v_name, p_method, v_ref,
       'paid', 'completed', v_total, v_total, p_client_uuid, v_when)
    returning id, created_at into v_order_id, v_created;
  exception when unique_violation then
    -- Two copies of the same sale arrived at once. The other one won; return it.
    select id, order_number, created_at into v_order_id, v_order_number, v_created
    from public.orders where client_operation_id = p_client_uuid;
    if not found then raise exception 'That order number is already in use'; end if;
    return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
                              'created_at', v_created, 'already_synced', true,
                              'shortfalls', '[]'::jsonb, 'price_changes', '[]'::jsonb);
  end;

  insert into public.order_items (order_id, book_id, quantity, unit_price_pesewas, line_total_pesewas)
  select v_order_id, (l->>'book_id')::uuid, (l->>'quantity')::integer,
         (l->>'unit_price_pesewas')::integer, (l->>'line_total_pesewas')::integer
  from jsonb_array_elements(v_lines) l;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'pos_sale_created', 'orders', v_order_id,
          jsonb_build_object('orderNumber', v_order_number, 'totalPesewas', v_total,
                             'itemCount', jsonb_array_length(v_lines),
                             'viaOfflineQueue', true, 'soldAt', v_when,
                             'priceChanges', v_price, 'stockShortfalls', v_short));

  if jsonb_array_length(v_short) > 0 then
    insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
    values (v_staff, 'pos_offline_oversell', 'orders', v_order_id,
            jsonb_build_object('orderNumber', v_order_number, 'shortfalls', v_short));
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
                            'created_at', v_created, 'already_synced', false,
                            'shortfalls', v_short, 'price_changes', v_price);
end;
$$;

revoke all on function public.sync_pos_sale(uuid, text, timestamptz, text, public.pay_method, text, jsonb) from public, anon;
grant execute on function public.sync_pos_sale(uuid, text, timestamptz, text, public.pay_method, text, jsonb) to authenticated;

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_outstanding bigint;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select role, outstanding_balance_pesewas into v_role, v_outstanding
  from public.profiles where id = v_actor for update;
  if v_role is null then raise exception 'Account profile not found'; end if;
  if v_role not in ('client', 'vendor') then raise exception 'Clients and vendors only can delete their own account'; end if;
  if v_role = 'vendor' and coalesce(v_outstanding, 0) <> 0 then
    raise exception 'Account deletion is blocked while your outstanding credit balance is not zero';
  end if;
  delete from public.profiles where id = v_actor;
  return jsonb_build_object('deleted_profile_id', v_actor, 'role', v_role);
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- Checkout idempotency RPC replacements (network-retry safe).
drop function if exists public.place_storefront_order(text, text, text, public.pay_method, public.fulfillment_type, text, text, jsonb);
create or replace function public.place_storefront_order(
  p_client_operation_id uuid, p_contact_name text, p_contact_phone text, p_contact_email text,
  p_method public.pay_method, p_fulfillment public.fulfillment_type,
  p_delivery_address text, p_delivery_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid(); v_profile public.profiles%rowtype;
  v_order record; v_el jsonb; v_qty integer; v_book record; v_unit bigint; v_line bigint;
  v_subtotal bigint := 0; v_order_id uuid; v_order_number text;
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
begin
  if p_client_operation_id is null then raise exception 'Missing checkout operation id'; end if;
  select id, order_number, total_pesewas into v_order from public.orders where client_operation_id = p_client_operation_id;
  if found then return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'total_pesewas', v_order.total_pesewas, 'already_created', true); end if;
  if v_name is null or v_phone is null then raise exception 'Name and phone are required'; end if;
  if p_method not in ('cash', 'mobile_money', 'bank_transfer') then raise exception 'Choose a valid payment method'; end if;
  if v_actor is not null then
    select * into v_profile from public.profiles where id = v_actor;
    if v_profile.role = 'vendor' then raise exception 'Wholesale accounts place orders from the wholesale cart'; end if;
    if v_profile.full_name is not null then v_name := v_profile.full_name; end if;
    if v_profile.phone is not null then v_phone := v_profile.phone; end if;
  end if;
  v_order_number := 'TB-' || upper(substr(md5(p_client_operation_id::text), 1, 8));
  insert into public.orders(order_number,order_type,user_id,contact_name,contact_phone,contact_email,payment_method,payment_status,fulfillment_type,delivery_address,delivery_notes,subtotal_pesewas,total_pesewas,client_operation_id)
  values(v_order_number,'storefront_client',v_actor,v_name,v_phone,nullif(btrim(coalesce(p_contact_email,'')),''),p_method,'payment_pending',p_fulfillment,p_delivery_address,p_delivery_notes,0,0,p_client_operation_id)
  returning id into v_order_id;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_el->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select id, title, customer_price_pesewas, stock_quantity into v_book from public.books where id=(v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists'; end if;
    if v_book.stock_quantity < v_qty then raise exception 'Not enough stock for "%"', v_book.title; end if;
    v_unit := v_book.customer_price_pesewas; v_line := v_unit*v_qty; v_subtotal := v_subtotal+v_line;
    insert into public.order_items(order_id,book_id,quantity,unit_price_pesewas,line_total_pesewas) values(v_order_id,v_book.id,v_qty,v_unit,v_line);
  end loop;
  update public.orders set subtotal_pesewas=v_subtotal,total_pesewas=v_subtotal where id=v_order_id;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'total_pesewas',v_subtotal,'already_created',false);
end; $$;

create or replace function public.place_vendor_credit_order(
  p_client_operation_id uuid, p_phone text, p_fulfillment public.fulfillment_type,
  p_delivery_address text, p_delivery_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid:=auth.uid(); v_profile public.profiles%rowtype; v_order record; v_el jsonb; v_qty integer; v_book record;
  v_unit bigint; v_line bigint; v_subtotal bigint:=0; v_pending bigint:=0; v_order_id uuid; v_order_number text;
begin
  if p_client_operation_id is null then raise exception 'Missing checkout operation id'; end if;
  select id,order_number,total_pesewas into v_order from public.orders where client_operation_id=p_client_operation_id;
  if found then return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'total_pesewas',v_order.total_pesewas,'already_created',true); end if;
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from public.profiles where id=v_actor for update;
  if v_profile.role is distinct from 'vendor'::public.user_role then raise exception 'Only vendor accounts can place wholesale credit orders'; end if;
  if v_profile.vendor_status is distinct from 'approved'::public.vendor_approval then raise exception 'Your wholesale account is not approved'; end if;
  select coalesce(sum(total_pesewas),0) into v_pending from public.orders where user_id=v_actor and payment_status='credit_pending';
  v_order_number:='TB-'||upper(substr(md5(p_client_operation_id::text),1,8));
  insert into public.orders(order_number,order_type,user_id,contact_name,contact_phone,fulfillment_type,delivery_address,delivery_notes,payment_method,payment_status,subtotal_pesewas,total_pesewas,client_operation_id)
  values(v_order_number,'storefront_vendor',v_actor,v_profile.full_name,p_phone,p_fulfillment,p_delivery_address,p_delivery_notes,'credit','credit_pending',0,0,p_client_operation_id) returning id into v_order_id;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_el->>'quantity')::integer; if v_qty is null or v_qty<=0 then raise exception 'Invalid quantity'; end if;
    select id,title,vendor_price_pesewas,customer_price_pesewas,stock_quantity into v_book from public.books where id=(v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists'; end if;
    if v_book.stock_quantity<v_qty then raise exception 'Not enough stock for "%"',v_book.title; end if;
    v_unit:=coalesce(v_book.vendor_price_pesewas,v_book.customer_price_pesewas); v_line:=v_unit*v_qty; v_subtotal:=v_subtotal+v_line;
    insert into public.order_items(order_id,book_id,quantity,unit_price_pesewas,line_total_pesewas) values(v_order_id,v_book.id,v_qty,v_unit,v_line);
  end loop;
  if v_profile.outstanding_balance_pesewas+v_pending+v_subtotal>v_profile.credit_limit_pesewas then
    delete from public.orders where id=v_order_id; raise exception 'This order would exceed your available credit';
  end if;
  update public.orders set subtotal_pesewas=v_subtotal,total_pesewas=v_subtotal where id=v_order_id;
  if v_profile.phone is null then update public.profiles set phone=p_phone where id=v_actor; end if;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'total_pesewas',v_subtotal,'already_created',false);
end; $$;

create or replace function public.place_vendor_immediate_order(
  p_client_operation_id uuid,p_phone text,p_method public.pay_method,p_reference text,
  p_fulfillment public.fulfillment_type,p_delivery_address text,p_delivery_notes text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid:=auth.uid();v_profile public.profiles%rowtype;v_order record;v_ref text:=nullif(btrim(coalesce(p_reference,'')),'');
  v_el jsonb;v_qty integer;v_book record;v_unit bigint;v_line bigint;v_subtotal bigint:=0;v_order_id uuid;v_order_number text;
begin
  if p_client_operation_id is null then raise exception 'Missing checkout operation id'; end if;
  select id,order_number,total_pesewas into v_order from public.orders where client_operation_id=p_client_operation_id;
  if found then return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'total_pesewas',v_order.total_pesewas,'already_created',true); end if;
  if v_actor is null then raise exception 'Not authenticated'; end if;
  select * into v_profile from public.profiles where id=v_actor for update;
  if v_profile.role is distinct from 'vendor'::public.user_role then raise exception 'Only vendor accounts can order here'; end if;
  if p_method not in ('cash','mobile_money','bank_transfer','cheque') then raise exception 'Choose a valid payment method'; end if;
  if p_method in ('mobile_money','bank_transfer','cheque') and v_ref is null then raise exception 'A payment reference is required'; end if;
  v_order_number:='TB-'||upper(substr(md5(p_client_operation_id::text),1,8));
  insert into public.orders(order_number,order_type,user_id,contact_name,contact_phone,fulfillment_type,delivery_address,delivery_notes,payment_method,payment_reference,payment_status,cheque_number,cheque_cleared,subtotal_pesewas,total_pesewas,client_operation_id)
  values(v_order_number,'storefront_vendor',v_actor,v_profile.full_name,p_phone,p_fulfillment,p_delivery_address,p_delivery_notes,p_method,v_ref,'payment_pending',case when p_method='cheque' then v_ref else null end,false,0,0,p_client_operation_id) returning id into v_order_id;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_el->>'quantity')::integer;if v_qty is null or v_qty<=0 then raise exception 'Invalid quantity';end if;
    select id,title,vendor_price_pesewas,customer_price_pesewas,stock_quantity into v_book from public.books where id=(v_el->>'bookId')::uuid for update;
    if not found then raise exception 'A book in this order no longer exists';end if;
    if v_book.stock_quantity<v_qty then raise exception 'Not enough stock for "%"',v_book.title;end if;
    v_unit:=coalesce(v_book.vendor_price_pesewas,v_book.customer_price_pesewas);v_line:=v_unit*v_qty;v_subtotal:=v_subtotal+v_line;
    insert into public.order_items(order_id,book_id,quantity,unit_price_pesewas,line_total_pesewas) values(v_order_id,v_book.id,v_qty,v_unit,v_line);
  end loop;
  update public.orders set subtotal_pesewas=v_subtotal,total_pesewas=v_subtotal where id=v_order_id;
  if v_profile.phone is null then update public.profiles set phone=p_phone where id=v_actor;end if;
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'total_pesewas',v_subtotal,'already_created',false);
end; $$;

revoke all on function public.place_storefront_order(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_storefront_order(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb) to anon,authenticated;
drop function if exists public.place_vendor_credit_order(text,public.fulfillment_type,text,text,jsonb);
revoke all on function public.place_vendor_credit_order(uuid,text,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_vendor_credit_order(uuid,text,public.fulfillment_type,text,text,jsonb) to authenticated;
drop function if exists public.place_vendor_immediate_order(text,public.pay_method,text,public.fulfillment_type,text,text,jsonb);
revoke all on function public.place_vendor_immediate_order(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_vendor_immediate_order(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb) to authenticated;

-- Atomic application login lockout updates (Supabase Auth hook configuration in the dashboard is still required for direct API enforcement).
create or replace function public.record_failed_login(p_identifier text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_failed int; v_locked_until timestamptz; v_row public.login_attempts%rowtype;
begin
  if nullif(btrim(coalesce(p_identifier,'')),'') is null then raise exception 'Missing login identifier'; end if;
  select * into v_row from public.login_attempts where email=p_identifier for update;
  v_failed := coalesce(v_row.failed_count,0)+1;
  if v_failed>=6 then v_locked_until:=now()+interval '15 minutes'; v_failed:=0;
  else v_locked_until:=null; end if;
  insert into public.login_attempts(email,failed_count,locked_until,last_attempt_at)
  values(p_identifier,v_failed,v_locked_until,now())
  on conflict(email) do update set failed_count=excluded.failed_count,locked_until=excluded.locked_until,last_attempt_at=excluded.last_attempt_at;
  return jsonb_build_object('failed_count',v_failed,'locked_until',v_locked_until);
end; $$;
revoke all on function public.record_failed_login(text) from public,anon,authenticated;
grant execute on function public.record_failed_login(text) to service_role;
