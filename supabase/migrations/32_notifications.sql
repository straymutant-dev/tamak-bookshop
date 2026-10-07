-- STRAYMUTANT.DEV — Tamak Bookshop
-- Notifications. Things that need your attention, or that happened to you, are
-- written to a notifications table by database triggers, so they appear no
-- matter which screen made the change.
--
--   Staff / admin hear about: new vendor orders, new online orders, vendor
--     payments to confirm, new vendor sign-ups (admins), low stock (admins).
--   Vendors / customers hear about: credit approved, payment confirmed, order
--     rejected, order on its way / delivered / picked up, account approved or
--     frozen, credit limit changes, payment confirmed or not accepted, counter
--     sales billed to their credit account.
-- Row Level Security: everyone reads only their own notifications.

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
-- No insert/update/delete policies: rows are created by the triggers below and
-- marked read through mark_notifications_read().

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (internal: only the triggers and functions below use them)
-- ---------------------------------------------------------------------------
create or replace function public.ghs(p_pesewas bigint)
returns text
language sql
immutable
as $$ select 'GHS ' || to_char(p_pesewas / 100.0, 'FM999999990.00') $$;

create or replace function public.notify_user(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;

create or replace function public.notify_staff(
  p_kind text, p_title text, p_body text, p_link text, p_admins_only boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, p_title, p_body, p_link
  from public.profiles
  where role = 'admin' or (not p_admins_only and role = 'staff');
$$;

revoke all on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_staff(text, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mark as read (the signed-in user's own notifications only)
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Orders: created
-- ---------------------------------------------------------------------------
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
      '/admin/orders');
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

-- ---------------------------------------------------------------------------
-- Orders: approved / paid / on its way / delivered
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text;
begin
  if new.user_id is null or new.order_type = 'counter_pos' then
    return null;
  end if;

  if new.order_type = 'storefront_vendor' and old.payment_status = 'credit_pending' and new.payment_status = 'credit_approved' then
    perform public.notify_user(
      new.user_id, 'credit_approved', 'Credit order approved',
      new.order_number || ' · ' || public.ghs(new.total_pesewas) || ' is now on your account (' || new.fulfillment_type::text || ')',
      '/vendor/dashboard');
  elsif new.order_type = 'storefront_vendor' and old.payment_status = 'payment_pending' and new.payment_status = 'paid' then
    perform public.notify_user(
      new.user_id, 'payment_confirmed', 'Payment confirmed',
      new.order_number || ' · payment received (' || new.fulfillment_type::text || ')',
      '/account/orders');
  end if;

  if new.order_status is distinct from old.order_status
     and new.payment_status not in ('credit_pending', 'payment_pending') then
    v_msg := case new.order_status
      when 'in_transit' then 'is on its way to you'
      when 'completed' then case when new.fulfillment_type = 'delivery' then 'has been delivered' else 'has been picked up' end
      else null end;
    if v_msg is not null then
      perform public.notify_user(new.user_id, 'order_status', 'Order update', new.order_number || ' ' || v_msg, '/account/orders');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists notify_order_update on public.orders;
create trigger notify_order_update
  after update on public.orders
  for each row execute function public.trg_notify_order_update();

-- ---------------------------------------------------------------------------
-- Vendor repayment requests: submitted / confirmed / not accepted
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_repayment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_balance bigint;
  v_amount bigint;
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(business_name, ''), full_name) into v_name from public.profiles where id = new.vendor_id;
    perform public.notify_staff(
      'repayment_request', 'Payment to confirm',
      coalesce(v_name, 'A vendor') || ' says they paid ' || public.ghs(new.amount_pesewas)
        || ' by ' || replace(new.payment_method::text, '_', ' ')
        || coalesce(' · ref ' || new.payment_reference, ''),
      '/admin/repayments');
  elsif old.status = 'pending' and new.status = 'confirmed' then
    select outstanding_balance_pesewas into v_balance from public.profiles where id = new.vendor_id;
    select coalesce((select amount_pesewas from public.credit_repayments where id = new.repayment_id), new.amount_pesewas)
      into v_amount;
    perform public.notify_user(
      new.vendor_id, 'repayment_confirmed', 'Payment confirmed',
      public.ghs(v_amount) || ' received. You now owe ' || public.ghs(coalesce(v_balance, 0)),
      '/vendor/dashboard');
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.notify_user(
      new.vendor_id, 'repayment_rejected', 'Payment not accepted',
      public.ghs(new.amount_pesewas) || coalesce(': ' || new.review_note, '. Please contact the shop.'),
      '/vendor/dashboard');
  end if;
  return null;
end;
$$;

drop trigger if exists notify_repayment_request on public.repayment_requests;
create trigger notify_repayment_request
  after insert or update on public.repayment_requests
  for each row execute function public.trg_notify_repayment_request();

-- ---------------------------------------------------------------------------
-- Vendor accounts: new sign-up (admins) / approved / frozen / credit limit
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'vendor' then
      perform public.notify_staff(
        'vendor_signup', 'New vendor awaiting approval',
        coalesce(nullif(new.business_name, ''), new.full_name, 'A vendor') || ' has signed up for a wholesale account',
        '/admin/vendors', true);
    end if;
    return null;
  end if;

  if new.role = 'vendor' then
    if old.vendor_status is distinct from new.vendor_status then
      if new.vendor_status = 'approved' then
        perform public.notify_user(new.id, 'vendor_approved', 'Your wholesale account is approved',
          'You can now order at wholesale prices. Credit limit: ' || public.ghs(new.credit_limit_pesewas), '/vendor/dashboard');
      elsif new.vendor_status = 'frozen' then
        perform public.notify_user(new.id, 'vendor_frozen', 'Your wholesale account has been frozen',
          'Please contact the shop for details.', '/vendor/dashboard');
      elsif new.vendor_status = 'rejected' then
        perform public.notify_user(new.id, 'vendor_rejected', 'Your wholesale application was not approved',
          'Please contact the shop for details.', '/vendor/dashboard');
      end if;
    end if;

    if new.vendor_status = 'approved'
       and old.credit_limit_pesewas is distinct from new.credit_limit_pesewas then
      perform public.notify_user(new.id, 'credit_limit', 'Your credit limit changed',
        'Your credit limit is now ' || public.ghs(new.credit_limit_pesewas), '/vendor/dashboard');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists notify_profile on public.profiles;
create trigger notify_profile
  after insert or update on public.profiles
  for each row execute function public.trg_notify_profile();

-- ---------------------------------------------------------------------------
-- Books: running low (admins). Fires once, when stock drops to 5 or below.
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and old.stock_quantity > 5 and new.stock_quantity <= 5 then
    perform public.notify_staff('low_stock', 'Low stock',
      new.title || ' — ' || new.stock_quantity || ' left', '/admin/inventory', true);
  end if;
  return null;
end;
$$;

drop trigger if exists notify_low_stock on public.books;
create trigger notify_low_stock
  after update of stock_quantity on public.books
  for each row execute function public.trg_notify_low_stock();

-- ---------------------------------------------------------------------------
-- Rejecting a vendor order now tells the vendor why (replaces the version from 27)
-- ---------------------------------------------------------------------------
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

  if v_order.user_id is not null then
    perform public.notify_user(
      v_order.user_id, 'order_rejected', 'Order not accepted',
      v_order.order_number || ' was not accepted'
        || coalesce(': ' || nullif(btrim(coalesce(p_reason, '')), ''), '. Please contact the shop.')
        || ' Any credit reserved for it has been released.',
      '/vendor/dashboard');
  end if;

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;-- STRAYMUTANT.DEV — Tamak Bookshop
-- Notifications. Things that need your attention, or that happened to you, are
-- written to a notifications table by database triggers, so they appear no
-- matter which screen made the change.
--
--   Staff / admin hear about: new vendor orders, new online orders, vendor
--     payments to confirm, new vendor sign-ups (admins), low stock (admins).
--   Vendors / customers hear about: credit approved, payment confirmed, order
--     rejected, order on its way / delivered / picked up, account approved or
--     frozen, credit limit changes, payment confirmed or not accepted, counter
--     sales billed to their credit account.
-- Row Level Security: everyone reads only their own notifications.

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
-- No insert/update/delete policies: rows are created by the triggers below and
-- marked read through mark_notifications_read().

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (internal: only the triggers and functions below use them)
-- ---------------------------------------------------------------------------
create or replace function public.ghs(p_pesewas bigint)
returns text
language sql
immutable
as $$ select 'GHS ' || to_char(p_pesewas / 100.0, 'FM999999990.00') $$;

create or replace function public.notify_user(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;

create or replace function public.notify_staff(
  p_kind text, p_title text, p_body text, p_link text, p_admins_only boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, p_title, p_body, p_link
  from public.profiles
  where role = 'admin' or (not p_admins_only and role = 'staff');
$$;

revoke all on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_staff(text, text, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mark as read (the signed-in user's own notifications only)
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Orders: created
-- ---------------------------------------------------------------------------
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
      '/admin/orders');
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

-- ---------------------------------------------------------------------------
-- Orders: approved / paid / on its way / delivered
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text;
begin
  if new.user_id is null or new.order_type = 'counter_pos' then
    return null;
  end if;

  if new.order_type = 'storefront_vendor' and old.payment_status = 'credit_pending' and new.payment_status = 'credit_approved' then
    perform public.notify_user(
      new.user_id, 'credit_approved', 'Credit order approved',
      new.order_number || ' · ' || public.ghs(new.total_pesewas) || ' is now on your account (' || new.fulfillment_type::text || ')',
      '/vendor/dashboard');
  elsif new.order_type = 'storefront_vendor' and old.payment_status = 'payment_pending' and new.payment_status = 'paid' then
    perform public.notify_user(
      new.user_id, 'payment_confirmed', 'Payment confirmed',
      new.order_number || ' · payment received (' || new.fulfillment_type::text || ')',
      '/account/orders');
  end if;

  if new.order_status is distinct from old.order_status
     and new.payment_status not in ('credit_pending', 'payment_pending') then
    v_msg := case new.order_status
      when 'in_transit' then 'is on its way to you'
      when 'completed' then case when new.fulfillment_type = 'delivery' then 'has been delivered' else 'has been picked up' end
      else null end;
    if v_msg is not null then
      perform public.notify_user(new.user_id, 'order_status', 'Order update', new.order_number || ' ' || v_msg, '/account/orders');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists notify_order_update on public.orders;
create trigger notify_order_update
  after update on public.orders
  for each row execute function public.trg_notify_order_update();

-- ---------------------------------------------------------------------------
-- Vendor repayment requests: submitted / confirmed / not accepted
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_repayment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_balance bigint;
  v_amount bigint;
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(business_name, ''), full_name) into v_name from public.profiles where id = new.vendor_id;
    perform public.notify_staff(
      'repayment_request', 'Payment to confirm',
      coalesce(v_name, 'A vendor') || ' says they paid ' || public.ghs(new.amount_pesewas)
        || ' by ' || replace(new.payment_method::text, '_', ' ')
        || coalesce(' · ref ' || new.payment_reference, ''),
      '/admin/repayments');
  elsif old.status = 'pending' and new.status = 'confirmed' then
    select outstanding_balance_pesewas into v_balance from public.profiles where id = new.vendor_id;
    select coalesce((select amount_pesewas from public.credit_repayments where id = new.repayment_id), new.amount_pesewas)
      into v_amount;
    perform public.notify_user(
      new.vendor_id, 'repayment_confirmed', 'Payment confirmed',
      public.ghs(v_amount) || ' received. You now owe ' || public.ghs(coalesce(v_balance, 0)),
      '/vendor/dashboard');
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.notify_user(
      new.vendor_id, 'repayment_rejected', 'Payment not accepted',
      public.ghs(new.amount_pesewas) || coalesce(': ' || new.review_note, '. Please contact the shop.'),
      '/vendor/dashboard');
  end if;
  return null;
end;
$$;

drop trigger if exists notify_repayment_request on public.repayment_requests;
create trigger notify_repayment_request
  after insert or update on public.repayment_requests
  for each row execute function public.trg_notify_repayment_request();

-- ---------------------------------------------------------------------------
-- Vendor accounts: new sign-up (admins) / approved / frozen / credit limit
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'vendor' then
      perform public.notify_staff(
        'vendor_signup', 'New vendor awaiting approval',
        coalesce(nullif(new.business_name, ''), new.full_name, 'A vendor') || ' has signed up for a wholesale account',
        '/admin/vendors', true);
    end if;
    return null;
  end if;

  if new.role = 'vendor' then
    if old.vendor_status is distinct from new.vendor_status then
      if new.vendor_status = 'approved' then
        perform public.notify_user(new.id, 'vendor_approved', 'Your wholesale account is approved',
          'You can now order at wholesale prices. Credit limit: ' || public.ghs(new.credit_limit_pesewas), '/vendor/dashboard');
      elsif new.vendor_status = 'frozen' then
        perform public.notify_user(new.id, 'vendor_frozen', 'Your wholesale account has been frozen',
          'Please contact the shop for details.', '/vendor/dashboard');
      elsif new.vendor_status = 'rejected' then
        perform public.notify_user(new.id, 'vendor_rejected', 'Your wholesale application was not approved',
          'Please contact the shop for details.', '/vendor/dashboard');
      end if;
    end if;

    if new.vendor_status = 'approved'
       and old.credit_limit_pesewas is distinct from new.credit_limit_pesewas then
      perform public.notify_user(new.id, 'credit_limit', 'Your credit limit changed',
        'Your credit limit is now ' || public.ghs(new.credit_limit_pesewas), '/vendor/dashboard');
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists notify_profile on public.profiles;
create trigger notify_profile
  after insert or update on public.profiles
  for each row execute function public.trg_notify_profile();

-- ---------------------------------------------------------------------------
-- Books: running low (admins). Fires once, when stock drops to 5 or below.
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and old.stock_quantity > 5 and new.stock_quantity <= 5 then
    perform public.notify_staff('low_stock', 'Low stock',
      new.title || ' — ' || new.stock_quantity || ' left', '/admin/inventory', true);
  end if;
  return null;
end;
$$;

drop trigger if exists notify_low_stock on public.books;
create trigger notify_low_stock
  after update of stock_quantity on public.books
  for each row execute function public.trg_notify_low_stock();

-- ---------------------------------------------------------------------------
-- Rejecting a vendor order now tells the vendor why (replaces the version from 27)
-- ---------------------------------------------------------------------------
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

  if v_order.user_id is not null then
    perform public.notify_user(
      v_order.user_id, 'order_rejected', 'Order not accepted',
      v_order.order_number || ' was not accepted'
        || coalesce(': ' || nullif(btrim(coalesce(p_reason, '')), ''), '. Please contact the shop.')
        || ' Any credit reserved for it has been released.',
      '/vendor/dashboard');
  end if;

  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;