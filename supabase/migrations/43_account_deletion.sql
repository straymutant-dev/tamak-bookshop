-- STRAYMUTANT.DEV — Tamak Bookshop
-- Safe self-service account deletion for client/vendor accounts.
-- The public profile is deleted inside the database guard; the server action
-- then deletes the matching Supabase Auth identity.

alter table public.credit_repayments
  alter column vendor_id drop not null;
alter table public.credit_repayments drop constraint if exists credit_repayments_vendor_id_fkey;
alter table public.credit_repayments
  add constraint credit_repayments_vendor_id_fkey
  foreign key (vendor_id) references public.profiles(id) on delete set null;

alter table public.credit_repayments
  alter column received_by_staff_id drop not null;
alter table public.credit_repayments drop constraint if exists credit_repayments_received_by_staff_id_fkey;
alter table public.credit_repayments
  add constraint credit_repayments_received_by_staff_id_fkey
  foreign key (received_by_staff_id) references public.profiles(id) on delete set null;

alter table public.cashier_shifts alter column staff_id drop not null;
alter table public.cashier_shifts drop constraint if exists cashier_shifts_staff_id_fkey;
alter table public.cashier_shifts
  add constraint cashier_shifts_staff_id_fkey
  foreign key (staff_id) references public.profiles(id) on delete set null;

alter table public.order_returns alter column staff_id drop not null;
alter table public.order_returns drop constraint if exists order_returns_staff_id_fkey;
alter table public.order_returns
  add constraint order_returns_staff_id_fkey
  foreign key (staff_id) references public.profiles(id) on delete set null;

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_outstanding bigint;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select role, outstanding_balance_pesewas
  into v_role, v_outstanding
  from public.profiles
  where id = v_actor;

  if v_role is null then
    raise exception 'Account profile not found';
  end if;
  if v_role not in ('client', 'vendor') then
    raise exception 'Clients and vendors only can delete their own account';
  end if;
  if v_role = 'vendor' and coalesce(v_outstanding, 0) <> 0 then
    raise exception 'Account deletion is blocked while your outstanding credit balance is greater than zero';
  end if;

  delete from public.profiles where id = v_actor;

  return jsonb_build_object(
    'deleted_profile_id', v_actor,
    'role', v_role
  );
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
