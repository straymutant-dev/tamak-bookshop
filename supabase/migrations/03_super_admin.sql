-- STRAYMUTANT.DEV — Tamak Bookshop
alter table profiles
  add column if not exists is_super_admin boolean not null default false;

-- Prevent any authenticated client (even an admin's own session) from
-- changing role or is_super_admin directly — only the service-role key
-- (used server-side in team/actions.ts) can touch these two columns.
create or replace function prevent_role_self_escalation()
returns trigger as $$
begin
  if (new.role is distinct from old.role or new.is_super_admin is distinct from old.is_super_admin)
     and auth.role() != 'service_role' then
    raise exception 'role and is_super_admin can only be changed by a server action';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_role_self_escalation on profiles;
create trigger trg_prevent_role_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();