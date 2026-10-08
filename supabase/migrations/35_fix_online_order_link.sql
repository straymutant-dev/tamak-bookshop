-- STRAYMUTANT.DEV — Tamak Bookshop
-- 35: fix the "New online order" notification link
--
-- It was sending staff to the bare /admin/orders list instead of the
-- actionable tab that vendor orders and payment-reported notifications
-- already use. Same function as 32_notifications.sql, only the online_order
-- link line changed — everything else is reproduced exactly as-is.

create or replace function public.trg_notify_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_type = 'storefront_vendor' then
    perform public.notify_staff(
      'vendor_order', 'New vendor order',
      coalesce(new.contact_name, 'A vendor') || ' · ' || public.ghs(new.total_pesewas)
        || case when new.payment_status = 'credit_pending' then ' on credit'
                else ' (' || replace(new.payment_method::text, '_', ' ') || ')' end
        || ' · ' || new.order_number,
      '/admin/orders?tab=vendor');
  elsif new.order_type = 'storefront_client' then
    perform public.notify_staff(
      'online_order', 'New online order',
      coalesce(new.contact_name, 'A customer') || ' · ' || public.ghs(new.total_pesewas) || ' · ' || new.order_number,
      '/admin/orders?tab=vendor');
  elsif new.order_type = 'counter_pos' and new.user_id is not null and new.payment_method = 'credit' then
    perform public.notify_user(
      new.user_id, 'credit_charged', 'Billed to your credit account',
      new.order_number || ' · ' || public.ghs(new.total_pesewas) || ' was added to what you owe',
      '/vendor/dashboard');
  end if;
  return null;
end;
$$;

drop trigger if exists notify_order_insert on public.orders;
create trigger notify_order_insert
  after insert on public.orders
  for each row execute function public.trg_notify_order_insert();