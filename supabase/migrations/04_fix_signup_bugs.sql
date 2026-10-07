-- STRAYMUTANT.DEV — Tamak Bookshop
-- Fix 1: break the infinite recursion in profiles RLS by checking role
-- through a security-definer function instead of a self-referencing subquery.
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "Staff and Admins can view all profiles" on public.profiles;
create policy "Staff and Admins can view all profiles"
  on public.profiles for select
  using (public.current_user_role() in ('staff', 'admin'));

-- Fix 2: qualify the enum types with their schema and pin the trigger
-- function's search_path so it can find them during auth.users inserts.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, vendor_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role),
    case
      when (new.raw_user_meta_data->>'role') = 'vendor' then 'pending'::public.vendor_approval
      else 'not_applicable'::public.vendor_approval
    end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;