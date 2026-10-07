-- STRAYMUTANT.DEV — Tamak Bookshop
drop policy if exists "Admins can upload book covers" on storage.objects;
drop policy if exists "Admins can update book covers" on storage.objects;

create policy "Admins can upload book covers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'book-covers'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update book covers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'book-covers'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    bucket_id = 'book-covers'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );