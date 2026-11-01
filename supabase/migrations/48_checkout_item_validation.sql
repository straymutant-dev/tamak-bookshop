-- Tamak Bookshop: prevent zero-item checkout RPC calls.

alter function public.place_storefront_order(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb)
  rename to place_storefront_order_impl;
revoke all on function public.place_storefront_order_impl(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb) from public,anon,authenticated;

create or replace function public.place_storefront_order(
  p_client_operation_id uuid,p_contact_name text,p_contact_phone text,p_contact_email text,
  p_method public.pay_method,p_fulfillment public.fulfillment_type,p_delivery_address text,
  p_delivery_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'The order has no items';
  end if;
  return public.place_storefront_order_impl(
    p_client_operation_id,p_contact_name,p_contact_phone,p_contact_email,
    p_method,p_fulfillment,p_delivery_address,p_delivery_notes,p_items);
end; $$;
revoke all on function public.place_storefront_order(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_storefront_order(uuid,text,text,text,public.pay_method,public.fulfillment_type,text,text,jsonb) to anon,authenticated;

alter function public.place_vendor_credit_order(uuid,text,public.fulfillment_type,text,text,jsonb)
  rename to place_vendor_credit_order_impl;
revoke all on function public.place_vendor_credit_order_impl(uuid,text,public.fulfillment_type,text,text,jsonb) from public,anon,authenticated;

create or replace function public.place_vendor_credit_order(
  p_client_operation_id uuid,p_phone text,p_fulfillment public.fulfillment_type,
  p_delivery_address text,p_delivery_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'The order has no items';
  end if;
  return public.place_vendor_credit_order_impl(
    p_client_operation_id,p_phone,p_fulfillment,p_delivery_address,p_delivery_notes,p_items);
end; $$;
revoke all on function public.place_vendor_credit_order(uuid,text,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_vendor_credit_order(uuid,text,public.fulfillment_type,text,text,jsonb) to authenticated;

alter function public.place_vendor_immediate_order(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb)
  rename to place_vendor_immediate_order_impl;
revoke all on function public.place_vendor_immediate_order_impl(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb) from public,anon,authenticated;

create or replace function public.place_vendor_immediate_order(
  p_client_operation_id uuid,p_phone text,p_method public.pay_method,p_reference text,
  p_fulfillment public.fulfillment_type,p_delivery_address text,p_delivery_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'The order has no items';
  end if;
  return public.place_vendor_immediate_order_impl(
    p_client_operation_id,p_phone,p_method,p_reference,
    p_fulfillment,p_delivery_address,p_delivery_notes,p_items);
end; $$;
revoke all on function public.place_vendor_immediate_order(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb) from public;
grant execute on function public.place_vendor_immediate_order(uuid,text,public.pay_method,text,public.fulfillment_type,text,text,jsonb) to authenticated;
