-- STRAYMUTANT.DEV — Tamak Bookshop
-- Receipt emails.
--  * profiles.contact_email : optional email for people who signed up by phone (receipts go here).
--  * orders.contact_email   : where THIS order's receipt goes (guests can type one at checkout).
--  * placed_email_sent_at / paid_email_sent_at : so each email is sent only once, even on retries.
-- Run once. If you already have a migration numbered 36, rename this file to the next number.

alter table public.profiles
  add column if not exists contact_email text;

alter table public.orders
  add column if not exists contact_email text,
  add column if not exists placed_email_sent_at timestamptz,
  add column if not exists paid_email_sent_at timestamptz;

alter table public.profiles
  add constraint profiles_contact_email_format
  check (contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

alter table public.orders
  add constraint orders_contact_email_format
  check (contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');