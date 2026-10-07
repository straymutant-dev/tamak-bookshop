-- STRAYMUTANT.DEV — Tamak Bookshop
-- Vendor order approval + payment confirmation, done atomically.
-- Each function below locks the rows it touches, checks everything, then makes
-- ALL its changes in one transaction, so an order, its stock, the vendor's
-- balance and the audit log can never end up out of step.
--
-- Purely additive: no existing table, function or policy is changed.
-- Staff/admin identity is checked INSIDE each function with auth.uid(), so the
-- app calls them with the signed-in user's own session (no service-role key).
-- Because of that, they can't be tested from the SQL editor (no signed-in user).

-- ---------------------------------------------------------------------------
-- 1. Vendor repayment requests (vendor says "I paid X", staff confirm)
-- ---------------------------------------------------------------------------
create table if not exists public.repayment_requests (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  amount_pesewas bigint not null check (amount_pesewas > 0),
  payment_method public.pay_method not null check (payment_method <> 'credit'),
  payment_reference text,
  contact_phone text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  repayment_id uuid references public.credit_repayments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_repayment_requests_status
  on public.repayment_requests (status, created_at);

alter table public.repayment_requests enable row level security;

drop policy if exists "Vendors can view own repayment requests" on public.repayment_requests;
create policy "Vendors can view own repayment requests"
  on public.repayment_requests for select
  using (vendor_id = auth.uid());

drop policy if exists "Vendors can create own repayment requests" on public.repayment_requests;
create policy "Vendors can create own repayment requests"
  on public.repayment_requests for insert
  with check (
    vendor_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'vendor' and p.vendor_status = 'approved'
    )
  );

drop policy if exists "Staff and admins can view repayment requests" on public.repayment_requests;
create policy "Staff and admins can view repayment requests"
  on public.repayment_requests for select
  using (public.current_user_role() in ('staff', 'admin'));

-- No UPDATE/DELETE policies on purpose: requests change only through the
-- confirm / reject functions below.

-- ---------------------------------------------------------------------------
-- 2. Shared guard: who is calling?
-- ---------------------------------------------------------------------------
create or replace function public.require_staff_or_admin()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role not in ('staff', 'admin') then
    raise exception 'Only staff or admin can do this';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Approve a vendor CREDIT order (stock out + balance up, together)
-- ---------------------------------------------------------------------------
create or replace function public.approve_vendor_credit_order(
  p_order_id uuid,
  p_fulfillment public.fulfillment_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
  v_vendor public.profiles%rowtype;
  v_item record;
  v_title text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'storefront_vendor' then raise exception 'This is not a vendor order'; end if;
  if v_order.payment_status <> 'credit_pending' then raise exception 'This order has already been reviewed'; end if;
  if v_order.user_id is null then raise exception 'This order has no vendor attached'; end if;

  select * into v_vendor from public.profiles
  where id = v_order.user_id and role = 'vendor' for update;
  if not found then raise exception 'Vendor account not found'; end if;
  if v_vendor.vendor_status <> 'approved' then
    raise exception 'This vendor account is not approved';
  end if;
  if v_vendor.outstanding_balance_pesewas + v_order.total_pesewas > v_vendor.credit_limit_pesewas then
    raise exception 'Approving this order would put the vendor over their credit limit';
  end if;

  for v_item in
    select oi.book_id, oi.quantity from public.order_items oi
    where oi.order_id = p_order_id order by oi.book_id
  loop
    update public.books
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.book_id and stock_quantity >= v_item.quantity;
    if not found then
      select title into v_title from public.books where id = v_item.book_id;
      raise exception 'Not enough stock for "%"', coalesce(v_title, 'a book in this order');
    end if;
  end loop;

  update public.profiles
  set outstanding_balance_pesewas = outstanding_balance_pesewas + v_order.total_pesewas
  where id = v_vendor.id;

  update public.orders
  set payment_status = 'credit_approved', fulfillment_type = p_fulfillment
  where id = p_order_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_order_approved', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'fulfillment', p_fulfillment));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Confirm payment for a vendor PAY-NOW order (cash / MoMo / bank / cheque)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_vendor_order_payment(
  p_order_id uuid,
  p_method public.pay_method,
  p_reference text,
  p_fulfillment public.fulfillment_type,
  p_cheque_cleared boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_order public.orders%rowtype;
  v_item record;
  v_title text;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if p_method = 'credit' then raise exception 'Choose how the payment was received'; end if;
  if p_method in ('mobile_money', 'bank_transfer', 'cheque') and v_ref is null then
    raise exception 'A payment reference is required';
  end if;
  if p_method = 'cheque' and not coalesce(p_cheque_cleared, false) then
    raise exception 'A cheque can only be confirmed once it has cleared';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.order_type <> 'storefront_vendor' then raise exception 'This is not a vendor order'; end if;
  if v_order.payment_status <> 'payment_pending' then
    raise exception 'This order is not waiting for payment confirmation';
  end if;

  for v_item in
    select oi.book_id, oi.quantity from public.order_items oi
    where oi.order_id = p_order_id order by oi.book_id
  loop
    update public.books
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.book_id and stock_quantity >= v_item.quantity;
    if not found then
      select title into v_title from public.books where id = v_item.book_id;
      raise exception 'Not enough stock for "%"', coalesce(v_title, 'a book in this order');
    end if;
  end loop;

  update public.orders
  set payment_status = 'paid',
      payment_method = p_method,
      payment_reference = v_ref,
      fulfillment_type = p_fulfillment,
      cheque_number = case when p_method = 'cheque' then v_ref else cheque_number end,
      cheque_cleared = case when p_method = 'cheque' then true else cheque_cleared end
  where id = p_order_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_order_payment_confirmed', 'orders', p_order_id,
          jsonb_build_object('orderNumber', v_order.order_number,
                             'amountPesewas', v_order.total_pesewas,
                             'method', p_method,
                             'reference', v_ref,
                             'fulfillment', p_fulfillment));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Record a vendor repayment (balance down + repayment row, together)
-- ---------------------------------------------------------------------------
create or replace function public.record_vendor_repayment(
  p_vendor_id uuid,
  p_amount_pesewas bigint,
  p_method public.pay_method,
  p_reference text,
  p_notes text default null,
  p_cheque_cleared boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_vendor public.profiles%rowtype;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_id uuid;
begin
  if p_amount_pesewas is null or p_amount_pesewas <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if p_method = 'credit' then raise exception 'Choose how the payment was received'; end if;
  if p_method in ('mobile_money', 'bank_transfer', 'cheque') and v_ref is null then
    raise exception 'A payment reference is required';
  end if;
  if p_method = 'cheque' and not coalesce(p_cheque_cleared, false) then
    raise exception 'A cheque can only be confirmed once it has cleared';
  end if;

  select * into v_vendor from public.profiles
  where id = p_vendor_id and role = 'vendor' for update;
  if not found then raise exception 'Vendor account not found'; end if;
  if p_amount_pesewas > v_vendor.outstanding_balance_pesewas then
    raise exception 'This is more than the vendor owes (balance: % pesewas)', v_vendor.outstanding_balance_pesewas;
  end if;

  insert into public.credit_repayments
    (vendor_id, received_by_staff_id, amount_pesewas, payment_method, payment_reference, notes)
  values (p_vendor_id, v_staff, p_amount_pesewas, p_method, v_ref, p_notes)
  returning id into v_id;

  update public.profiles
  set outstanding_balance_pesewas = outstanding_balance_pesewas - p_amount_pesewas
  where id = p_vendor_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'vendor_repayment_recorded', 'credit_repayments', v_id,
          jsonb_build_object('vendorId', p_vendor_id,
                             'amountPesewas', p_amount_pesewas,
                             'method', p_method,
                             'reference', v_ref));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Confirm / reject a repayment request a vendor submitted
-- ---------------------------------------------------------------------------
create or replace function public.confirm_repayment_request(
  p_request_id uuid,
  p_amount_pesewas bigint default null,
  p_method public.pay_method default null,
  p_reference text default null,
  p_cheque_cleared boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_req public.repayment_requests%rowtype;
  v_repayment_id uuid;
begin
  select * into v_req from public.repayment_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  -- Staff can correct the amount / method / reference to what was actually received.
  v_repayment_id := public.record_vendor_repayment(
    v_req.vendor_id,
    coalesce(p_amount_pesewas, v_req.amount_pesewas),
    coalesce(p_method, v_req.payment_method),
    coalesce(nullif(btrim(coalesce(p_reference, '')), ''), v_req.payment_reference),
    'Confirmed from vendor payment request',
    p_cheque_cleared
  );

  update public.repayment_requests
  set status = 'confirmed', reviewed_by = v_staff, reviewed_at = now(), repayment_id = v_repayment_id
  where id = p_request_id;
end;
$$;

create or replace function public.reject_repayment_request(
  p_request_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := public.require_staff_or_admin();
  v_req public.repayment_requests%rowtype;
begin
  select * into v_req from public.repayment_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  update public.repayment_requests
  set status = 'rejected', reviewed_by = v_staff, reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_request_id;

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_staff, 'repayment_request_rejected', 'repayment_requests', p_request_id,
          jsonb_build_object('vendorId', v_req.vendor_id, 'amountPesewas', v_req.amount_pesewas));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Only signed-in users may call these (each also checks staff/admin itself)
-- ---------------------------------------------------------------------------
revoke all on function public.require_staff_or_admin() from public, anon;
revoke all on function public.approve_vendor_credit_order(uuid, public.fulfillment_type) from public, anon;
revoke all on function public.confirm_vendor_order_payment(uuid, public.pay_method, text, public.fulfillment_type, boolean) from public, anon;
revoke all on function public.record_vendor_repayment(uuid, bigint, public.pay_method, text, text, boolean) from public, anon;
revoke all on function public.confirm_repayment_request(uuid, bigint, public.pay_method, text, boolean) from public, anon;
revoke all on function public.reject_repayment_request(uuid, text) from public, anon;

grant execute on function public.require_staff_or_admin() to authenticated;
grant execute on function public.approve_vendor_credit_order(uuid, public.fulfillment_type) to authenticated;
grant execute on function public.confirm_vendor_order_payment(uuid, public.pay_method, text, public.fulfillment_type, boolean) to authenticated;
grant execute on function public.record_vendor_repayment(uuid, bigint, public.pay_method, text, text, boolean) to authenticated;
grant execute on function public.confirm_repayment_request(uuid, bigint, public.pay_method, text, boolean) to authenticated;
grant execute on function public.reject_repayment_request(uuid, text) to authenticated;