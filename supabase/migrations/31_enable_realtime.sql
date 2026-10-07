-- STRAYMUTANT.DEV — Tamak Bookshop
-- Live updates: lets the app hear about changes to these tables the moment they
-- happen, so pages refresh themselves instead of needing a reload.
-- Row Level Security still applies: a user only hears about rows they're allowed to see.
-- Safe to run twice (tables already in the list are skipped).

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders',
    'profiles',
    'books',
    'repayment_requests',
    'credit_repayments',
    'audit_logs'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;