-- STRAYMUTANT.DEV — Tamak Bookshop
-- Security fix: handle_new_user() used to copy the role from the PUBLIC signup
-- metadata, so anyone could sign up with { data: { role: 'admin' } } and become
-- an admin. Now a self-signup can only ever be 'client' or 'vendor'.
-- Staff/admin roles are granted by the invite server actions (service role),
-- which the prevent_role_self_escalation trigger allows.
--
-- Also saves phone and business_name from signup metadata (they were being lost).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  final_role public.user_role;
begin
  if requested_role = 'vendor' then
    final_role := 'vendor'::public.user_role;
  else
    final_role := 'client'::public.user_role;
  end if;

  insert into public.profiles (id, full_name, phone, business_name, role, vendor_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    nullif(new.raw_user_meta_data->>'phone', ''),
    case when final_role = 'vendor' then nullif(new.raw_user_meta_data->>'business_name', '') end,
    final_role,
    case
      when final_role = 'vendor' then 'pending'::public.vendor_approval
      else 'not_applicable'::public.vendor_approval
    end
  );
  return new;
end;
$$;