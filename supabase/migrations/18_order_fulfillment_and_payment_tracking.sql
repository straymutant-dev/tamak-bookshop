-- STRAYMUTANT.DEV — Tamak Bookshop
-- Fulfilment + payment tracking columns on orders.
-- Idempotent: safe on the live DB (types/columns already exist)
-- and on a fresh database (creates them).

do $$ begin
  create type public.fulfillment_type as enum ('pickup', 'delivery');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'in_transit', 'completed');
exception when duplicate_object then null;
end $$;

alter table public.orders
  add column if not exists fulfillment_type public.fulfillment_type not null default 'pickup',
  add column if not exists order_status public.order_status not null default 'pending',
  add column if not exists discount_pesewas integer not null default 0,
  add column if not exists cheque_number text,
  add column if not exists cheque_cleared boolean;

do $$ begin
  alter table public.orders
    add constraint order_status_fulfillment_check
    check (order_status != 'in_transit' or fulfillment_type = 'delivery');
exception when duplicate_object then null;
end $$;