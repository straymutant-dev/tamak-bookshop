-- STRAYMUTANT.DEV — Tamak Bookshop
-- Super-admin-only launch reset. Removes test data and non-super-admin accounts;
-- preserves payment-account configuration and all profiles flagged is_super_admin.

create or replace function public.reset_project_launch_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_super_admin boolean;
  v_deleted_non_super_profiles bigint;
begin
  if p_confirmation <> 'RESET PROJECT' then
    raise exception 'Confirmation code did not match';
  end if;

  select p.is_super_admin into v_is_super_admin
  from public.profiles p
  where p.id = v_actor;

  if coalesce(v_is_super_admin, false) <> true then
    raise exception 'Only the super admin can reset the project';
  end if;

  truncate table
    public.notifications,
    public.receipt_prints,
    public.repayment_requests,
    public.credit_repayments,
    public.order_returns,
    public.cashier_shifts,
    public.book_changes,
    public.audit_logs,
    public.login_attempts,
    public.orders,
    public.books
  restart identity cascade;

  delete from public.profiles where is_super_admin <> true;
  get diagnostics v_deleted_non_super_profiles = row_count;

  return jsonb_build_object(
    'deleted_profiles', v_deleted_non_super_profiles,
    'preserved_super_admins', (select count(*) from public.profiles where is_super_admin = true)
  );
end;
$$;

revoke all on function public.reset_project_launch_data(text) from public;
revoke all on function public.reset_project_launch_data(text) from anon;
grant execute on function public.reset_project_launch_data(text) to authenticated;
