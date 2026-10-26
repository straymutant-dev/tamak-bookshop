-- STRAYMUTANT.DEV — Tamak Bookshop
-- 34: delivery details on orders
--
-- Reuses the existing fulfillment_type enum (pickup/delivery) and the
-- existing contact_phone column — this only adds what's genuinely new:
-- where to take a delivery, and anything the rider should know.
-- No CHECK constraint requiring an address on delivery orders: that's
-- enforced in the checkout server actions instead, so staff can still
-- flip an order's fulfillment in the admin edit modal without being
-- hard-blocked mid-edit.

alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_notes text;

comment on column public.orders.delivery_address is
  'Exact delivery location. Required at checkout when fulfillment_type = delivery; null for pickup orders.';
comment on column public.orders.delivery_notes is
  'Optional notes for the delivery rider (landmark, gate code, preferred time, etc).';