-- STRAYMUTANT.DEV — Tamak Bookshop
-- Counter sale to a WHOLESALE (vendor) customer, done atomically.
-- Works for vendors who have an account (can be billed to their credit account)
-- and for walk-in vendors without an account (pay at the till).
--
-- One transaction: checks the caller is staff/admin, prices every book at the
-- vendor price from the database (never from the browser), takes stock out,
-- creates the order and its items, and — for a credit sale — raises the
-- vendor's balance. If anything fails, nothing is saved.
--
-- Cheques are not taken at the counter: bill the sale to the vendor's credit
-- account and record the cheque as a repayment (method: cheque) once it clears.

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
    raise exception 'Cheques are not taken at the counter. Bill the sale to the vendor''s credit account, then record the cheque as a repayment once it has cleared';
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
    if v_credit then
      raise exception 'A walk-in vendor without an account can''t buy on credit. Create their account first';
    end if;
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

  if v_credit then
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

  if v_credit then
    update public.profiles
    set outstanding_balance_pesewas = outstanding_balance_pesewas + v_total
    where id = v_vendor.id
    returning outstanding_balance_pesewas into v_owed_after;
  elsif p_vendor_id is not null then
    v_owed_after := v_vendor.outstanding_balance_pesewas;
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

revoke all on function public.pos_vendor_sale(uuid, text, text, jsonb, public.pay_method, text) from public, anon;
grant execute on function public.pos_vendor_sale(uuid, text, text, jsonb, public.pay_method, text) to authenticated;