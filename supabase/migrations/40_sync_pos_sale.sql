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
-- Run once. If you already have a migration numbered 37, rename this file to the next number.

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