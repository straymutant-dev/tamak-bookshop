-- STRAYMUTANT.DEV — Tamak Bookshop
-- Book change history ("who changed what, when, from what to what").
--  * book_changes: one row per change, with before/after values. Nobody can edit or delete rows.
--  * A trigger records every catalogue edit (title, author, category, subject, class level, academic year,
--    the three prices, cover, archive/restore) in the same transaction as the edit, so no screen or future
--    import can forget to log it. The editor is whoever is signed in (auth.uid()).
--  * It also writes an audit_logs entry, so the change shows up in the Activity page.
--  * A published book that is edited flips to status 'updated' until an admin marks it reviewed.
--  * Stock is NOT tracked by the trigger (every sale changes stock). Manual stock intake / write-off are
--    logged by the app into book_changes instead.
--  * status also has room for the planned invoice import ('draft_import', 'image_required').
-- Run once. If you already have a migration numbered 38, rename this file to the next number.

alter table public.books
  add column if not exists status text not null default 'published',
  add column if not exists last_edited_at timestamptz,
  add column if not exists last_edited_by uuid references public.profiles(id) on delete set null;

alter table public.books
  add constraint books_status_check
  check (status in ('published', 'updated', 'image_required', 'draft_import'));

create table public.book_changes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  action text not null
    check (action in (
      'created', 'edited', 'archived', 'restored', 'reviewed',
      'stock_intake', 'stock_writeoff', 'stock_returned_to_publisher'
    )),
  -- { "field": { "before": ..., "after": ... } }
  changes jsonb not null default '{}'::jsonb,
  note text
);

create index book_changes_book_idx on public.book_changes (book_id, changed_at desc);

alter table public.book_changes enable row level security;

create policy "Staff and admins can view book changes"
  on public.book_changes for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('staff', 'admin')
    )
  );

-- Only used by the app for manual stock moves; edits are written by the trigger below.
create policy "Admins can add book changes"
  on public.book_changes for insert
  with check (
    changed_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
-- No update or delete policies on purpose: history cannot be rewritten.

-- ---------------------------------------------------------------------------
-- Edits
-- ---------------------------------------------------------------------------
create or replace function public.track_book_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_cols text[] := array['title', 'author', 'category', 'subject', 'class_level', 'academic_year',
                         'buying_cost_pesewas', 'customer_price_pesewas', 'vendor_price_pesewas',
                         'cover_image_url', 'is_active', 'status'];
  v_col text;
  v_changes jsonb := '{}'::jsonb;
  v_action text := 'edited';
  v_editor uuid := auth.uid();
begin
  foreach v_col in array v_cols loop
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      v_changes := v_changes || jsonb_build_object(
        v_col, jsonb_build_object('before', v_old -> v_col, 'after', v_new -> v_col));
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return new; -- nothing we track changed (for example a sale lowered the stock)
  end if;

  if (select count(*) from jsonb_object_keys(v_changes)) = 1 then
    if v_changes ? 'is_active' then
      v_action := case when new.is_active then 'restored' else 'archived' end;
    elsif v_changes ? 'status' and old.status = 'updated' and new.status = 'published' then
      v_action := 'reviewed';
    end if;
  end if;

  -- An edit to a published book marks it "updated" until an admin reviews it.
  if v_action = 'edited' and old.status = 'published' then
    new.status := 'updated';
  end if;
  new.last_edited_at := now();
  new.last_edited_by := v_editor;

  insert into public.book_changes (book_id, changed_by, action, changes)
  values (new.id, v_editor, v_action, v_changes);

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_editor,
          'book_' || case v_action when 'edited' then 'updated' else v_action end,
          'books', new.id,
          jsonb_build_object('title', new.title, 'changes', v_changes));

  return new;
end;
$$;

create trigger books_track_changes
  before update on public.books
  for each row execute function public.track_book_changes();

-- ---------------------------------------------------------------------------
-- New books
-- ---------------------------------------------------------------------------
create or replace function public.track_book_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_cols text[] := array['title', 'author', 'category', 'subject', 'class_level', 'academic_year',
                         'buying_cost_pesewas', 'customer_price_pesewas', 'vendor_price_pesewas', 'cover_image_url'];
  v_col text;
  v_changes jsonb := '{}'::jsonb;
  v_editor uuid := auth.uid();
begin
  foreach v_col in array v_cols loop
    if (v_new -> v_col) <> 'null'::jsonb then
      v_changes := v_changes || jsonb_build_object(
        v_col, jsonb_build_object('before', 'null'::jsonb, 'after', v_new -> v_col));
    end if;
  end loop;
  v_changes := v_changes || jsonb_build_object(
    'stock_quantity', jsonb_build_object('before', 'null'::jsonb, 'after', to_jsonb(new.stock_quantity)));

  insert into public.book_changes (book_id, changed_by, action, changes)
  values (new.id, v_editor, 'created', v_changes);

  insert into public.audit_logs (staff_id, action, entity_type, entity_id, details_json)
  values (v_editor, 'book_created', 'books', new.id,
          jsonb_build_object('title', new.title, 'changes', v_changes));

  return new;
end;
$$;

create trigger books_track_created
  after insert on public.books
  for each row execute function public.track_book_created();