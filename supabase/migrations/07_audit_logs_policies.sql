-- STRAYMUTANT.DEV — Tamak Bookshop
create policy "Staff and admins can insert audit logs"
  on public.audit_logs for insert
  with check (
    staff_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );