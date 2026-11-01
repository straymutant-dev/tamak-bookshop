-- STRAYMUTANT.DEV — Tamak Bookshop
-- Block vendor deletion when posted debt or pending credit orders exist.

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
  v_pending_credit bigint := 0;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;

  select role, outstanding_balance_pesewas
  into v_role, v_outstanding
  from public.profiles
  where id = v_actor
  for update;

  if v_role is null then raise exception 'Account profile not found'; end if;
  if v_role not in ('client', 'vendor') then
    raise exception 'Clients and vendors only can delete their own account';
  end if;

  if v_role = 'vendor' then
    select coalesce(sum(total_pesewas), 0)
    into v_pending_credit
    from public.orders
    where user_id = v_actor
      and payment_method = 'credit'
      and payment_status = 'credit_pending';

    if coalesce(v_outstanding, 0) <> 0 or coalesce(v_pending_credit, 0) <> 0 then
      raise exception 'Account deletion is blocked while outstanding or pending vendor credit remains';
    end if;
  end if;

  delete from public.profiles where id = v_actor;
  return jsonb_build_object('deleted_profile_id', v_actor, 'role', v_role);
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
