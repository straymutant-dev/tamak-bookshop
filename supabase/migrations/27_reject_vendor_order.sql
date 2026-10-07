-- STRAYMUTANT.DEV — Tamak Bookshop
-- Reject (cancel) a vendor order that is still waiting: either a credit order
-- awaiting approval, or a pay-now order awaiting payment confirmation.
-- Nothing has touched stock or the vendor's balance at that point, so the
-- order and its items are simply removed (and logged). Credit reserved for a
-- rejected order is released automatically, because reserved credit is
-- calculated from the pending orders that exist.

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
  if v_order.order_type <> 'storefront_vendor' then raise exception 'This is not a vendor order'; end if;
  if v_order.payment_status not in ('credit_pending', 'payment_pending') then
    raise exception 'This order has already been reviewed';
  end if;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_order_rejected', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'status', v_order.payment_status,
                             'reason', nullif(btrim(coalesce(p_reason, '')), '')));

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.reject_vendor_order(uuid, text) from public, anon;
grant execute on function public.reject_vendor_order(uuid, text) to authenticated;