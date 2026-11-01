-- STRAYMUTANT.DEV — Tamak Bookshop
-- Native Supabase Auth password-verification lockout.
-- Must be enabled in the Supabase Dashboard under Auth > Hooks.

create table if not exists public.password_verification_attempts (
  user_id uuid primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);
alter table public.password_verification_attempts enable row level security;
revoke all on public.password_verification_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.password_verification_attempts to supabase_auth_admin;

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_failed integer := 0;
  v_locked_until timestamptz;
begin
  v_user_id := nullif(event->>'user_id', '')::uuid;
  if v_user_id is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  if coalesce((event->>'valid')::boolean, false) then
    delete from public.password_verification_attempts where user_id = v_user_id;
    return jsonb_build_object('decision', 'continue');
  end if;

  select a.failed_count, a.locked_until
  into v_failed, v_locked_until
  from public.password_verification_attempts a
  where a.user_id = v_user_id
  for update;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Too many failed password attempts. Try again later.',
      'should_logout_user', false
    );
  end if;

  v_failed := coalesce(v_failed, 0) + 1;
  if v_failed >= 6 then
    v_locked_until := now() + interval '15 minutes';
    v_failed := 0;

    insert into public.password_verification_attempts
      (user_id, failed_count, locked_until, last_attempt_at)
    values (v_user_id, v_failed, v_locked_until, now())
    on conflict (user_id) do update set
      failed_count = excluded.failed_count,
      locked_until = excluded.locked_until,
      last_attempt_at = excluded.last_attempt_at;

    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Too many failed password attempts. Try again in 15 minutes.',
      'should_logout_user', false
    );
  end if;

  insert into public.password_verification_attempts
    (user_id, failed_count, locked_until, last_attempt_at)
  values (v_user_id, v_failed, null, now())
  on conflict (user_id) do update set
    failed_count = excluded.failed_count,
    locked_until = null,
    last_attempt_at = excluded.last_attempt_at;

  return jsonb_build_object('decision', 'continue');
end;
$$;

revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
