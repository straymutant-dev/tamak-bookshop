-- STRAYMUTANT.DEV — Tamak Bookshop
alter table public.profiles add column if not exists invite_accepted_at timestamptz;

-- existing admins/staff are already active
update public.profiles
set invite_accepted_at = now()
where role in ('admin', 'staff') and invite_accepted_at is null;

create or replace function public.protect_profile_money_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.invite_accepted_at is distinct from old.invite_accepted_at then
    raise exception 'invite_accepted_at can only be changed by a server action';
  end if;

  if (new.vendor_status is distinct from old.vendor_status
      or new.credit_limit_pesewas is distinct from old.credit_limit_pesewas
      or new.outstanding_balance_pesewas is distinct from old.outstanding_balance_pesewas)
     and public.current_user_role() is distinct from 'admin'::public.user_role then
    raise exception 'vendor status and credit fields can only be changed by an admin';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_money_columns on public.profiles;
create trigger protect_profile_money_columns
before update on public.profiles
for each row execute function public.protect_profile_money_columns();