-- STRAYMUTANT.DEV — Tamak Bookshop
-- Fix: missing UPDATE policy on profiles meant self-service profile
-- edits (name/phone) were silently doing nothing. The role-escalation
-- trigger from earlier still protects role/is_super_admin regardless.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Table for rate-limiting failed logins (used below). No RLS policies
-- defined on purpose — only the service-role key can touch this table,
-- never a regular user session.
create table if not exists public.login_attempts (
  email text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);
alter table public.login_attempts enable row level security;