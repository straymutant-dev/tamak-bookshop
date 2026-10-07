-- STRAYMUTANT.DEV — Tamak Bookshop
-- Continuation of 18_order_fulfillment_and_payment_tracking.sql —
-- fulfillment_type and order_status types already exist from the
-- partial first run; this picks up from the columns onward.

alter table public.orders
  add column if not exists fulfillment_type fulfillment_type not null default 'pickup',
  add column if not exists order_status order_status not null default 'pending',
  add column if not exists discount_pesewas integer not null default 0,
  add column if not exists cheque_number text,
  add column if not exists cheque_cleared boolean;

alter table public.orders
  add constraint order_status_fulfillment_check
  check (order_status != 'in_transit' or fulfillment_type = 'delivery');