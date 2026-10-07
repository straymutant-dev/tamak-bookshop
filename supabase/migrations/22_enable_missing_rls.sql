-- STRAYMUTANT.DEV — Tamak Bookshop
-- CRITICAL: audit_logs, credit_repayments, order_returns, and
-- cashier_shifts were created with row level security never enabled.
-- Policies existed for audit_logs (07_audit_logs_policies.sql) but sat
-- completely inert without RLS turned on — meaning any authenticated
-- request could read and write these tables directly via the Supabase
-- client, bypassing every policy. This turns RLS on for all four and
-- adds the missing policies for the three that never had any.

alter table public.audit_logs enable row level security;
alter table public.credit_repayments enable row level security;
alter table public.order_returns enable row level security;
alter table public.cashier_shifts enable row level security;

create policy "Staff and Admins can view credit repayments"
  on public.credit_repayments for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and Admins can record credit repayments"
  on public.credit_repayments for insert
  with check (
    received_by_staff_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and Admins can view order returns"
  on public.order_returns for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and Admins can record order returns"
  on public.order_returns for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff and Admins can view cashier shifts"
  on public.cashier_shifts for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff can log their own cashier shifts"
  on public.cashier_shifts for insert
  with check (
    staff_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Staff can update their own cashier shifts"
  on public.cashier_shifts for update
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());