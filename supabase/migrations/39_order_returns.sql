-- STRAYMUTANT.DEV — Tamak Bookshop
-- 38: customer returns.
--
-- One function does a whole return in a single step, so stock and money can
-- never drift apart: it puts the books back (resellable) or into damaged
-- stock, records the return, works out the refund from what was actually paid,
-- and takes credit-order refunds off what the customer owes.
--
-- Rules: staff and admins may process returns; only completed, payment-confirmed
-- orders; within 7 days of the sale (keep in sync with RETURN_WINDOW_DAYS in
-- src/lib/returns.ts).

alter table public.orders
  add column if not exists credit_returned_pesewas bigint not null default 0
  check (credit_returned_pesewas >= 0);

alter table public.order_returns
  add column if not exists credit_applied_pesewas bigint not null default 0
  check (credit_applied_pesewas >= 0);

create or replace function public.process_order_return(
  p_order_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_el jsonb;
  v_book_id uuid;
  v_qty integer;
  v_cond public.return_condition;
  v_sold integer;
  v_returned integer;
  v_paid_total numeric;
  v_title text;
  v_refund bigint;
  v_refund_so_far bigint;
  v_credit_room bigint := 0;
  v_credit_applied bigint;
  v_walkin boolean;
  v_account_credit boolean;
  v_total_refund bigint := 0;
  v_total_credit bigint := 0;
  v_lines jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one book to return';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.order_status <> 'completed' then
    raise exception 'Only completed orders can have returns';
  end if;
  if v_order.payment_status not in ('paid', 'credit_approved', 'partially_paid') then
    raise exception 'Payment has not been confirmed for this order yet';
  end if;
  if v_order.created_at < now() - interval '7 days' then
    raise exception 'Returns are only accepted within 7 days of the sale';
  end if;

  -- Walk-in customers (no account) on credit: their debt is this order itself.
  v_walkin := v_order.order_type = 'counter_pos'
              and v_order.user_id is null
              and v_order.payment_method = 'credit'
              and v_order.payment_status = 'credit_approved';
  -- Account vendors on credit: their debt is the balance on their profile.
  v_account_credit := v_order.user_id is not null and v_order.payment_method = 'credit';

  if v_walkin and v_order.cheque_number is not null then
    raise exception 'A cheque has been recorded for this order. Process the return once the cheque has cleared or bounced';
  end if;

  if v_walkin then
    v_credit_room := greatest(v_order.total_pesewas - v_order.credit_returned_pesewas, 0);
  elsif v_account_credit then
    select outstanding_balance_pesewas into v_credit_room
    from public.profiles where id = v_order.user_id for update;
    v_credit_room := coalesce(v_credit_room, 0);
  end if;

  select coalesce(sum(refund_pesewas), 0) into v_refund_so_far
  from public.order_returns where order_id = p_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_el->>'condition', '') not in ('resellable', 'damaged') then
      raise exception 'Choose resellable or damaged for each book';
    end if;
    v_cond := (v_el->>'condition')::public.return_condition;
    v_book_id := (v_el->>'bookId')::uuid;
    v_qty := (v_el->>'quantity')::integer;

    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    if v_book_id = any(v_seen) then raise exception 'List each book only once'; end if;
    v_seen := v_seen || v_book_id;

    select coalesce(sum(quantity), 0), coalesce(sum(line_total_pesewas), 0)
    into v_sold, v_paid_total
    from public.order_items where order_id = p_order_id and book_id = v_book_id;
    if v_sold = 0 then raise exception 'One of those books is not on this order'; end if;

    select coalesce(sum(quantity), 0) into v_returned
    from public.order_returns where order_id = p_order_id and book_id = v_book_id;

    select title into v_title from public.books where id = v_book_id for update;

    if v_qty > v_sold - v_returned then
      raise exception 'Only % of "%" can still be returned', v_sold - v_returned, v_title;
    end if;

    -- What was really paid per copy, after any order-level discount.
    if v_order.subtotal_pesewas > 0 then
      v_refund := round(v_paid_total / v_sold * v_qty * v_order.total_pesewas / v_order.subtotal_pesewas)::bigint;
    else
      v_refund := round(v_paid_total / v_sold * v_qty)::bigint;
    end if;
    -- Rounding must never push total refunds above what the customer paid.
    v_refund := greatest(least(v_refund, v_order.total_pesewas - v_refund_so_far - v_total_refund), 0);

    v_credit_applied := least(v_refund, v_credit_room);
    v_credit_room := v_credit_room - v_credit_applied;

    if v_cond = 'resellable' then
      update public.books set stock_quantity = stock_quantity + v_qty where id = v_book_id;
    else
      update public.books set damaged_quantity = damaged_quantity + v_qty where id = v_book_id;
    end if;

    insert into public.order_returns
      (order_id, book_id, staff_id, quantity, condition, refund_pesewas, credit_applied_pesewas, notes)
    values
      (p_order_id, v_book_id, v_staff, v_qty, v_cond, v_refund, v_credit_applied, v_notes);

    v_total_refund := v_total_refund + v_refund;
    v_total_credit := v_total_credit + v_credit_applied;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'title', v_title, 'quantity', v_qty, 'condition', v_cond, 'refundPesewas', v_refund));
  end loop;

  if v_total_credit > 0 then
    if v_walkin then
      update public.orders
      set credit_returned_pesewas = credit_returned_pesewas + v_total_credit
      where id = p_order_id;
    elsif v_account_credit then
      update public.profiles
      set outstanding_balance_pesewas = outstanding_balance_pesewas - v_total_credit
      where id = v_order.user_id;
    end if;
  end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'order_return_recorded', 'orders', p_order_id,
          jsonb_build_object(
            'orderNumber', v_order.order_number,
            'items', v_lines,
            'refundPesewas', v_total_refund,
            'creditAppliedPesewas', v_total_credit,
            'cashRefundPesewas', v_total_refund - v_total_credit,
            'notes', v_notes));

  return jsonb_build_object(
    'orderNumber', v_order.order_number,
    'refundPesewas', v_total_refund,
    'creditAppliedPesewas', v_total_credit,
    'cashRefundPesewas', v_total_refund - v_total_credit);
end;
$$;

revoke all on function public.process_order_return(uuid, jsonb, text) from public, anon;
grant execute on function public.process_order_return(uuid, jsonb, text) to authenticated;